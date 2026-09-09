import Foundation
import CryptoKit

private func privateFailure(_ code: String = "STORAGE_UNAVAILABLE") -> NSError {
  NSError(domain: "ModelCommons", code: 1, userInfo: [NSLocalizedDescriptionKey: "\(code): Private model operation failed."])
}

final class PrivateModelFiles {
  private let manager = FileManager.default
  private let lock = NSLock()
  private var downloads: [String: PrivateDownload] = [:]
  private var copies: [String: Bool] = [:]

  private func root() throws -> URL {
    var url = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask,
                              appropriateFor: nil, create: true).appendingPathComponent("ModelCommonsPrivate", isDirectory: true)
    try manager.createDirectory(at: url, withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var attributes = URLResourceValues()
    attributes.isExcludedFromBackup = true
    try url.setResourceValues(attributes)
    return url.standardizedFileURL.resolvingSymlinksInPath()
  }
  private func file(_ path: String) throws -> URL {
    guard !path.isEmpty, path.utf8.count <= 1024, !path.contains("\\"), !path.contains("%"), !path.contains(":"),
      !path.unicodeScalars.contains(where: { $0.value < 32 }),
      path.split(separator: "/", omittingEmptySubsequences: false).allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." })
    else { throw privateFailure("INTEGRITY_FAILED") }
    let base = try root()
    let result = base.appendingPathComponent(path).standardizedFileURL.resolvingSymlinksInPath()
    guard result.path.hasPrefix(base.path + "/") else { throw privateFailure("INTEGRITY_FAILED") }
    return result
  }
  func operation(_ operation: String, path: String, value: String) throws -> Any? {
    if operation == "identity" { return try root().absoluteString }
    if operation == "free" {
      return (try manager.attributesOfFileSystem(forPath: root().path)[.systemFreeSize] as? NSNumber)?.doubleValue ?? 0
    }
    if operation == "cancel" || operation == "progress" {
      lock.lock(); let download = downloads[path]
      if operation == "cancel", copies[path] != nil { copies[path] = true }
      lock.unlock()
      if operation == "cancel" { download?.cancel(); return nil }
      return download?.progress ?? 0
    }
    let target = try file(path)
    switch operation {
    case "uri": return target.absoluteString
    case "stat":
      guard manager.fileExists(atPath: target.path) else { return nil }
      let info = try target.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
      return ["size": info.fileSize ?? 0, "regular": info.isRegularFile == true] as [String: Any]
    case "read":
      guard manager.fileExists(atPath: target.path) else { return nil }
      let handle = try FileHandle(forReadingFrom: target)
      defer { try? handle.close() }
      let data = try handle.read(upToCount: 1024 * 1024 + 1) ?? Data()
      guard data.count <= 1024 * 1024, let text = String(data: data, encoding: .utf8) else { throw privateFailure("INTEGRITY_FAILED") }
      return text
    case "write":
      let data = Data(value.utf8)
      guard data.count <= 1024 * 1024 else { throw privateFailure("INTEGRITY_FAILED") }
      try manager.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
      try data.write(to: target, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      return nil
    case "mkdir":
      try manager.createDirectory(at: target, withIntermediateDirectories: true,
        attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
      return nil
    case "remove":
      // Reject escaping descendants before any recursive removal.
      if manager.fileExists(atPath: target.path) {
        if let entries = manager.enumerator(at: target, includingPropertiesForKeys: [.isSymbolicLinkKey]) {
          for case let entry as URL in entries {
            guard entry.resolvingSymlinksInPath().path.hasPrefix(target.path + "/") else { throw privateFailure("INTEGRITY_FAILED") }
          }
        }
        try manager.removeItem(at: target)
      }
      return nil
    case "move":
      let destination = try file(value)
      guard !manager.fileExists(atPath: destination.path) else { throw privateFailure("INTEGRITY_FAILED") }
      try manager.moveItem(at: target, to: destination)
      return nil
    case "sha256":
      let handle = try FileHandle(forReadingFrom: target)
      defer { try? handle.close() }
      var hash = SHA256()
      while let chunk = try handle.read(upToCount: 1024 * 1024), !chunk.isEmpty { hash.update(data: chunk) }
      return hash.finalize().map { String(format: "%02x", $0) }.joined()
    default: throw privateFailure("FEATURE_UNSUPPORTED")
    }
  }

  func download(id: String, source: String, path: String, expected: Double, origins: [String],
                completion: @escaping (Error?) -> Void) throws {
    guard path.hasSuffix(".part"), expected > 0, expected <= 32 * 1024 * 1024 * 1024,
          let url = URL(string: source), id.utf8.count <= 128 else { throw privateFailure("INTEGRITY_FAILED") }
    let destination = try file(path)
    lock.lock()
    guard downloads.isEmpty && copies.isEmpty else { lock.unlock(); throw privateFailure("RUNTIME_UNAVAILABLE") }
    let item = PrivateDownload(url: url, destination: destination, expected: Int64(expected), origins: origins) { error in
      self.lock.lock(); self.downloads.removeValue(forKey: id); self.lock.unlock()
      completion(error)
    }
    downloads[id] = item
    lock.unlock()
    item.start()
  }

  /** Fresh picker source, streamed directly into staging. No persistent bookmark
   * or cache copy is retained for an app-contained import. */
  func copySelected(id: String, source: URL, path: String, expected: Double) throws {
    guard source.isFileURL, path.hasSuffix(".part"), id.utf8.count <= 128,
          expected > 0, expected <= 32 * 1024 * 1024 * 1024 else { throw privateFailure("INTEGRITY_FAILED") }
    let destination = try file(path)
    lock.lock()
    guard downloads.isEmpty && copies.isEmpty else { lock.unlock(); throw privateFailure("RUNTIME_UNAVAILABLE") }
    copies[id] = false
    lock.unlock()
    defer { lock.lock(); copies.removeValue(forKey: id); lock.unlock() }
    let scoped = source.startAccessingSecurityScopedResource()
    defer { if scoped { source.stopAccessingSecurityScopedResource() } }
    var coordinationError: NSError?
    var copyError: Error?
    NSFileCoordinator().coordinate(readingItemAt: source, options: .withoutChanges, error: &coordinationError) { readable in
      do {
        let info = try readable.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey, .isUbiquitousItemKey])
        guard info.isRegularFile == true, info.isUbiquitousItem != true,
          Double(info.fileSize ?? -1) == expected else { throw privateFailure("INTEGRITY_FAILED") }
        let input = try FileHandle(forReadingFrom: readable)
        defer { try? input.close() }
        guard self.manager.createFile(atPath: destination.path, contents: nil,
          attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]) else { throw privateFailure() }
        let output = try FileHandle(forWritingTo: destination)
        defer { try? output.close() }
        try output.truncate(atOffset: 0)
        var total: Int64 = 0
        while true {
          self.lock.lock(); let stopped = self.copies[id] == true; self.lock.unlock()
          if stopped { throw privateFailure("USER_CANCELLED") }
          let chunk = try input.read(upToCount: 256 * 1024) ?? Data()
          if chunk.isEmpty { break }
          total += Int64(chunk.count)
          guard total <= Int64(expected) else { throw privateFailure("INTEGRITY_FAILED") }
          try output.write(contentsOf: chunk)
        }
        guard total == Int64(expected) else { throw privateFailure("INTEGRITY_FAILED") }
        try output.synchronize()
      } catch { copyError = error }
    }
    if let error = copyError ?? coordinationError { throw error }
  }
}

/** Streams directly into private staging; no multi-GB Data or cache-file copy. */
private final class PrivateDownload: NSObject, URLSessionDataDelegate {
  private let url: URL
  private let destination: URL
  private let expected: Int64
  private let origins: [String]
  private let completion: (Error?) -> Void
  private var handle: FileHandle?
  private var session: URLSession?
  private var task: URLSessionDataTask?
  private var failure: Error?
  private var redirects = 0
  private let stateLock = NSLock()
  private var written: Int64 = 0
  private var cancelled = false
  var progress: Double { stateLock.lock(); defer { stateLock.unlock() }; return Double(written) }
  init(url: URL, destination: URL, expected: Int64, origins: [String], completion: @escaping (Error?) -> Void) {
    self.url = url; self.destination = destination; self.expected = expected
    self.origins = origins; self.completion = completion
  }
  private func allowed(_ url: URL) -> Bool {
    guard url.scheme == "https", url.user == nil, url.password == nil, let host = url.host else { return false }
    let port = url.port.flatMap { $0 == 443 ? nil : ":\($0)" } ?? ""
    return origins.contains("https://" + host + port)
  }
  func start() {
    guard allowed(url) else { completion(privateFailure("PERMISSION_REQUIRED")); return }
    do {
      guard FileManager.default.createFile(atPath: destination.path, contents: nil,
        attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]) else { throw privateFailure() }
      handle = try FileHandle(forWritingTo: destination)
      try handle?.truncate(atOffset: 0)
      let configuration = URLSessionConfiguration.ephemeral
      configuration.urlCache = nil
      configuration.httpCookieStorage = nil
      configuration.urlCredentialStorage = nil
      configuration.timeoutIntervalForRequest = 30
      configuration.timeoutIntervalForResource = 3600
      let queue = OperationQueue(); queue.maxConcurrentOperationCount = 1
      let created = URLSession(configuration: configuration, delegate: self, delegateQueue: queue)
      session = created
      var request = URLRequest(url: url); request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
      let createdTask = created.dataTask(with: request)
      stateLock.lock(); task = createdTask; let stopped = cancelled; stateLock.unlock()
      createdTask.resume()
      if stopped { createdTask.cancel() }
    } catch { try? handle?.close(); completion(privateFailure()) }
  }
  func cancel() {
    stateLock.lock(); cancelled = true; let active = task; stateLock.unlock()
    active?.cancel()
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    redirects += 1
    guard redirects <= 5, let target = request.url, allowed(target) else {
      failure = privateFailure("PERMISSION_REQUIRED"); completionHandler(nil); task.cancel(); return
    }
    completionHandler(request)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    guard (response as? HTTPURLResponse)?.statusCode == 200,
      response.expectedContentLength < 0 || response.expectedContentLength == expected else {
      failure = privateFailure("INTEGRITY_FAILED"); completionHandler(.cancel); return
    }
    completionHandler(.allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    stateLock.lock(); written += Int64(data.count); let total = written; stateLock.unlock()
    guard total <= expected else { failure = privateFailure("INTEGRITY_FAILED"); dataTask.cancel(); return }
    do { try handle?.write(contentsOf: data) }
    catch { failure = privateFailure(); dataTask.cancel() }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    stateLock.lock(); let stopped = cancelled; let total = written; stateLock.unlock()
    do { try handle?.synchronize(); try handle?.close() } catch { failure = privateFailure() }
    session.finishTasksAndInvalidate()
    self.session = nil
    completion(stopped ? privateFailure("USER_CANCELLED") : failure ?? (error != nil || total != expected ? privateFailure() : nil))
  }
}
