// Owner-run on macOS with the two production Swift files; no model/device data.
// This exercises Foundation coordination, not UIKit grants or actual llama mmap.
import Foundation

@main
struct SharedReadChecks {
  static func require(_ value: Bool, _ message: String) {
    if !value { fatalError(message) }
  }

  static func main() throws {
    let manager = FileManager.default
    let root = manager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    try manager.createDirectory(at: root, withIntermediateDirectories: false)
    defer { try? manager.removeItem(at: root) }
    let url = root.appendingPathComponent("synthetic.gguf")
    try Data("abc".utf8).write(to: url)
    let finished = DispatchSemaphore(value: 0)
    let lease = CoordinatedModelRead()
    lease.start(url: url, validate: { _ in }, finished: { finished.signal() })
    require(try lease.awaitURL() == url, "Must return accessor URL")
    require(finished.wait(timeout: .now() + 0.05) == .timedOut, "Accessor exited before context release")
    let writerStarted = DispatchSemaphore(value: 0), writerEntered = DispatchSemaphore(value: 0)
    Thread.detachNewThread {
      var error: NSError?
      writerStarted.signal()
      NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &error) { _ in writerEntered.signal() }
    }
    require(writerStarted.wait(timeout: .now() + 2) == .success, "Writer did not start")
    require(writerEntered.wait(timeout: .now() + 0.1) == .timedOut, "Cooperative writer entered during read lease")
    try lease.release()
    try lease.release()
    require(finished.wait(timeout: .now() + 2) == .success, "Release did not drain accessor")
    require(writerEntered.wait(timeout: .now() + 2) == .success, "Writer remained blocked after release")

    // Timeout while native validation is in progress: delayed work cannot
    // publish a usable URL after the failed acquisition.
    let validating = DispatchSemaphore(value: 0), resume = DispatchSemaphore(value: 0)
    let timed = CoordinatedModelRead()
    timed.start(url: url, validate: { _ in validating.signal(); resume.wait() }, finished: {})
    require(validating.wait(timeout: .now() + 2) == .success, "Validation did not start")
    do { _ = try timed.awaitURL(timeout: 0.02); fatalError("Expected timeout") } catch {}
    resume.signal()
    try timed.release()
    do { _ = try timed.awaitURL(timeout: 0.02); fatalError("Late activation") } catch {}

    for path in ["../model.gguf", "a/../../model.gguf", "%2e%2e/model.gguf", "a\\b", "/absolute"] {
      do { try SharedModelConnector.validateRelativePath(path); fatalError("Unsafe relative path admitted") } catch {}
    }
    let link = root.appendingPathComponent("escape")
    try manager.createSymbolicLink(at: link, withDestinationURL: root.deletingLastPathComponent())
    require(!SharedModelConnector.isDescendant(link.appendingPathComponent("outside.gguf"), of: root), "Symlink escaped root")
    print("Foundation shared-read checks passed; iOS device gates remain unverified.")
  }
}
