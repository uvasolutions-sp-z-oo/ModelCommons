import Foundation

/// One bounded-admission worker holds the accessor through native context teardown.
/// Release never needs that worker, the Expo module queue, or a connector lock.
final class CoordinatedModelRead {
  private let condition = NSCondition()
  private let coordinator = NSFileCoordinator()
  private var stopped = false
  private var finished = false
  private var result: Result<URL, Error>?

  func start(url: URL, validate: @escaping (URL) throws -> Void, finished onFinish: @escaping () -> Void) {
    Thread.detachNewThread {
      var coordinationError: NSError?
      self.coordinator.coordinate(readingItemAt: url, options: .withoutChanges, error: &coordinationError) { coordinatedURL in
        self.condition.lock()
        if self.stopped { self.condition.unlock(); return }
        self.condition.unlock()
        let result = Result { try validate(coordinatedURL); return coordinatedURL }
        self.condition.lock()
        // A timed-out acquisition must never become active afterwards.
        if !self.stopped {
          self.result = result
          self.condition.broadcast()
          if case .success = result {
            while !self.stopped { self.condition.wait() }
          }
        }
        self.condition.unlock()
      }
      // Scope release follows accessor exit, including failed/pending acquisition.
      onFinish()
      self.condition.lock()
      if self.result == nil {
        self.result = .failure(coordinationError ?? (SharedModelConnectorError.accessDenied as NSError))
      }
      self.finished = true
      self.condition.broadcast()
      self.condition.unlock()
    }
  }

  func awaitURL(timeout: TimeInterval = 15) throws -> URL {
    condition.lock()
    let deadline = Date(timeIntervalSinceNow: timeout)
    while result == nil && !finished && !stopped {
      if !condition.wait(until: deadline) { break }
    }
    if let result, !stopped {
      condition.unlock()
      return try result.get()
    }
    stopped = true
    condition.broadcast()
    condition.unlock()
    coordinator.cancel()
    throw SharedModelConnectorError.accessDenied
  }

  func release() throws {
    condition.lock()
    stopped = true
    condition.broadcast()
    let deadline = Date(timeIntervalSinceNow: 5)
    while !finished {
      if !condition.wait(until: deadline) { break }
    }
    let done = finished
    condition.unlock()
    // Failure keeps admission/scope retained until the worker actually exits.
    guard done else { throw SharedModelConnectorError.activeLeases }
  }
}
