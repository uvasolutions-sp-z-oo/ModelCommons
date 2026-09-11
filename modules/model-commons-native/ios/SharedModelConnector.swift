import CryptoKit
import Foundation

enum SharedModelConnectorError: LocalizedError {
  case invalidConnection
  case invalidGroup
  case invalidRelativePath
  case accessDenied
  case notDirectory
  case notRegularFile
  case activeLeases
  case unknownLease
  case unmanagedPath
  case invalidFileURL
  case invalidMetadata

  var errorDescription: String? {
    switch self {
    case .invalidConnection: return "PERMISSION_REQUIRED: Shared model connection is unknown or corrupt."
    case .invalidGroup: return "PERMISSION_REQUIRED: The App Group is unavailable or not provisioned for this target."
    case .invalidRelativePath: return "INTEGRITY_FAILED: Model path must remain below the connected directory."
    case .accessDenied: return "PERMISSION_REQUIRED: Security-scoped directory access was denied, revoked, or is not local."
    case .notDirectory: return "MODEL_NOT_READY: The selected resource is not a directory."
    case .notRegularFile: return "MODEL_NOT_READY: The model resource is missing or is not a regular file."
    case .activeLeases: return "RUNTIME_UNAVAILABLE: Release model leases before disconnecting the directory."
    case .unknownLease: return "PERMISSION_REQUIRED: Model file lease is unknown or already released."
    case .unmanagedPath: return "PERMISSION_REQUIRED: File operation is outside the authorized model area."
    case .invalidFileURL: return "INTEGRITY_FAILED: Only local file URLs are accepted."
    case .invalidMetadata: return "INTEGRITY_FAILED: Shared metadata is invalid or too large."
    }
  }
}

struct SharedConnectionDescriptor: Codable {
  enum Kind: String, Codable {
    case securityScoped = "security-scoped"
    case appGroup = "app-group"
  }

  let id: String
  let kind: Kind
  var displayName: String
  var bookmarkBase64: String?
  var groupIdentifier: String?

  func dictionary() -> [String: Any] {
    var value: [String: Any] = [
      "id": id,
      "kind": kind.rawValue,
      "displayName": displayName,
    ]
    if let groupIdentifier {
      value["groupIdentifier"] = groupIdentifier
    }
    return value
  }
}

struct ModelLeaseDescriptor {
  let id: String
  let connectionId: String
  let url: URL

  func dictionary() -> [String: Any] {
    ["id": id, "connectionId": connectionId, "uri": url.absoluteString, "coordinationVersion": 1]
  }
}

final class SharedModelConnector {
  private struct ActiveRoot {
    let url: URL
    /** The exact URL instance on which startAccessingSecurityScopedResource succeeded. */
    let scopedURL: URL?
    var leaseCount: Int
  }

  private struct LeaseRecord {
    let connectionId: String
    let url: URL
    let read: CoordinatedModelRead
  }

  private let fileManager = FileManager.default
  private let defaults = UserDefaults.standard
  private let lock = NSLock()
  private var connections: [String: SharedConnectionDescriptor] = [:]
  private var activeRoots: [String: ActiveRoot] = [:]
  private var leases: [String: LeaseRecord] = [:]
  private var ioPins: [String: Int] = [:]
  private var releasing = Set<String>()

  init() {
    if let data = defaults.data(forKey: Self.connectionsKey),
       let decoded = try? JSONDecoder().decode([SharedConnectionDescriptor].self, from: data) {
      // Duplicate/corrupt persisted identifiers must not crash module initialization.
      for descriptor in decoded where !descriptor.id.isEmpty {
        connections[descriptor.id] = descriptor
      }
    }
  }

  func createSecurityScopedConnection(url: URL) throws -> SharedConnectionDescriptor {
    guard url.startAccessingSecurityScopedResource() else {
      throw SharedModelConnectorError.accessDenied
    }
    defer { url.stopAccessingSecurityScopedResource() }
    try Self.validateLocalDocumentsRoot(url)
    let values = try url.resourceValues(forKeys: [.isDirectoryKey])
    guard values.isDirectory == true else { throw SharedModelConnectorError.notDirectory }
    let bookmark = try url.bookmarkData(
      options: .minimalBookmark,
      includingResourceValuesForKeys: nil,
      relativeTo: nil
    )
    let descriptor = SharedConnectionDescriptor(
      id: UUID().uuidString,
      kind: .securityScoped,
      displayName: "ModelCommons (Files)",
      bookmarkBase64: bookmark.base64EncodedString(),
      groupIdentifier: nil
    )
    lock.lock()
    defer { lock.unlock() }
    connections[descriptor.id] = descriptor
    try persistLocked()
    return descriptor
  }

  func createAppGroupConnection(groupIdentifier: String) throws -> SharedConnectionDescriptor {
    guard Self.configuredGroups.contains(groupIdentifier),
          let root = fileManager.containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier) else {
      throw SharedModelConnectorError.invalidGroup
    }
    let descriptor = SharedConnectionDescriptor(
      id: UUID().uuidString,
      kind: .appGroup,
      displayName: "ModelCommons (App Group)",
      bookmarkBase64: nil,
      groupIdentifier: groupIdentifier
    )
    lock.lock()
    defer { lock.unlock() }
    connections[descriptor.id] = descriptor
    try persistLocked()
    return descriptor
  }

  func listConnections() -> [SharedConnectionDescriptor] {
    lock.lock()
    defer { lock.unlock() }
    return connections.values.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
  }

  func disconnect(connectionId: String) throws {
    lock.lock()
    defer { lock.unlock() }
    guard connections[connectionId] != nil else { throw SharedModelConnectorError.invalidConnection }
    guard activeRoots[connectionId] == nil else { throw SharedModelConnectorError.activeLeases }
    connections.removeValue(forKey: connectionId)
    try persistLocked()
  }

  func acquire(connectionId: String, relativePath: String) throws -> ModelLeaseDescriptor {
    let descriptor = try reserve(connectionId: connectionId, relativePath: relativePath)
    lock.lock()
    let record = leases[descriptor.id]!
    let root = activeRoots[connectionId]!.url
    lock.unlock()
    record.read.start(url: record.url, validate: { url in
      guard Self.isDescendant(Self.canonical(url), of: root) else {
        throw SharedModelConnectorError.unmanagedPath
      }
      let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isUbiquitousItemKey])
      guard values.isUbiquitousItem != true else { throw SharedModelConnectorError.accessDenied }
      guard values.isRegularFile == true else { throw SharedModelConnectorError.notRegularFile }
    }, finished: { self.finishLease(leaseId: descriptor.id) })
    let url = try record.read.awaitURL()
    lock.lock()
    leases[descriptor.id] = LeaseRecord(connectionId: connectionId, url: url, read: record.read)
    lock.unlock()
    return ModelLeaseDescriptor(id: descriptor.id, connectionId: connectionId, url: url)
  }

  private func reserve(connectionId: String, relativePath: String) throws -> ModelLeaseDescriptor {
    try Self.validateRelativePath(relativePath)
    lock.lock()
    defer { lock.unlock() }
    guard leases.count < 8 else { throw SharedModelConnectorError.activeLeases }
    guard var connection = connections[connectionId] else {
      throw SharedModelConnectorError.invalidConnection
    }

    var newlyStarted = false
    var root: URL
    if let active = activeRoots[connectionId] {
      root = active.url
    } else {
      switch connection.kind {
      case .appGroup:
        guard let group = connection.groupIdentifier,
              Self.configuredGroups.contains(group),
              let groupRoot = fileManager.containerURL(forSecurityApplicationGroupIdentifier: group) else {
          throw SharedModelConnectorError.invalidGroup
        }
        root = Self.canonical(groupRoot.appendingPathComponent("ModelCommons", isDirectory: true))
        activeRoots[connectionId] = ActiveRoot(url: root, scopedURL: nil, leaseCount: 0)
      case .securityScoped:
        guard let encoded = connection.bookmarkBase64,
              let data = Data(base64Encoded: encoded) else {
          throw SharedModelConnectorError.invalidConnection
        }
        var stale = false
        let resolvedURL = try URL(
          resolvingBookmarkData: data,
          options: [.withoutUI],
          relativeTo: nil,
          bookmarkDataIsStale: &stale
        )
        guard resolvedURL.startAccessingSecurityScopedResource() else {
          throw SharedModelConnectorError.accessDenied
        }
        newlyStarted = true
        root = Self.canonical(resolvedURL)
        do {
          try Self.validateLocalDocumentsRoot(resolvedURL)
          if stale {
            let refreshed = try resolvedURL.bookmarkData(
              options: .minimalBookmark,
              includingResourceValuesForKeys: nil,
              relativeTo: nil
            )
            connection.bookmarkBase64 = refreshed.base64EncodedString()
            connections[connectionId] = connection
            try persistLocked()
          }
          activeRoots[connectionId] = ActiveRoot(url: root, scopedURL: resolvedURL, leaseCount: 0)
        } catch {
          resolvedURL.stopAccessingSecurityScopedResource()
          throw error
        }
      }
    }

    do {
      let modelURL = Self.canonical(root.appendingPathComponent(relativePath, isDirectory: false))
      guard Self.isDescendant(modelURL, of: root) else {
        throw SharedModelConnectorError.invalidRelativePath
      }
      guard fileManager.fileExists(atPath: modelURL.path) else { throw SharedModelConnectorError.notRegularFile }
      let values = try modelURL.resourceValues(forKeys: [.isRegularFileKey, .isUbiquitousItemKey])
      guard values.isUbiquitousItem != true else { throw SharedModelConnectorError.accessDenied }
      guard values.isRegularFile == true else { throw SharedModelConnectorError.notRegularFile }
      let leaseId = UUID().uuidString
      leases[leaseId] = LeaseRecord(connectionId: connectionId, url: modelURL, read: CoordinatedModelRead())
      var active = activeRoots[connectionId]!
      active.leaseCount += 1
      activeRoots[connectionId] = active
      return ModelLeaseDescriptor(id: leaseId, connectionId: connectionId, url: modelURL)
    } catch {
      if newlyStarted {
        activeRoots.removeValue(forKey: connectionId)?.scopedURL?.stopAccessingSecurityScopedResource()
      } else if activeRoots[connectionId]?.leaseCount == 0 {
        activeRoots.removeValue(forKey: connectionId)
      }
      throw error
    }
  }

  func release(leaseId: String) throws {
    lock.lock()
    guard (ioPins[leaseId] ?? 0) == 0 else {
      lock.unlock(); throw SharedModelConnectorError.activeLeases
    }
    let read = leases[leaseId]?.read
    if read != nil { releasing.insert(leaseId) }
    lock.unlock()
    // Idempotent after successful worker cleanup; never stop a scope here.
    try read?.release()
  }

  private func finishLease(leaseId: String) {
    lock.lock()
    defer { lock.unlock() }
    ioPins.removeValue(forKey: leaseId)
    releasing.remove(leaseId)
    guard let lease = leases.removeValue(forKey: leaseId),
          var root = activeRoots[lease.connectionId] else {
      return
    }
    root.leaseCount = max(0, root.leaseCount - 1)
    if root.leaseCount == 0 {
      activeRoots.removeValue(forKey: lease.connectionId)
      root.scopedURL?.stopAccessingSecurityScopedResource()
    } else {
      activeRoots[lease.connectionId] = root
    }
  }

  func sha256(leaseId: String) throws -> String {
    try withLeaseRead(leaseId) { try Self.sha256(url: $0) }
  }

  func readMetadata(leaseId: String) throws -> String {
    try withLeaseRead(leaseId) { url in
      let handle = try FileHandle(forReadingFrom: url)
      defer { try? handle.close() }
      let data = try handle.read(upToCount: 1024 * 1024 + 1) ?? Data()
      guard data.count <= 1024 * 1024, let text = String(data: data, encoding: .utf8) else {
        throw SharedModelConnectorError.invalidMetadata
      }
      return text
    }
  }

  func stat(leaseId: String) throws -> [String: Any] {
    try withLeaseRead(leaseId) { url in
      let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isUbiquitousItemKey])
      // Avoid triggering cloud materialization during local inference.
      guard values.isUbiquitousItem != true else { throw SharedModelConnectorError.accessDenied }
      return ["size": values.fileSize ?? 0, "regular": values.isRegularFile == true]
    }
  }

  private func withLeaseRead<T>(_ leaseId: String, read: (URL) throws -> T) throws -> T {
    lock.lock()
    guard !releasing.contains(leaseId), let lease = leases[leaseId], let root = activeRoots[lease.connectionId],
          Self.isDescendant(Self.canonical(lease.url), of: root.url) else {
      lock.unlock(); throw SharedModelConnectorError.unknownLease
    }
    ioPins[leaseId, default: 0] += 1
    lock.unlock()
    defer {
      lock.lock(); ioPins[leaseId, default: 1] -= 1; lock.unlock()
    }
    // The original accessor is still open. Nesting another coordination here
    // can deadlock behind a waiting writer. Use the accessor-provided URL.
    return try read(lease.url)
  }

  func sha256ManagedFile(uri: String) throws -> String {
    let url = try parseFileURL(uri)
    guard isOwnerModelPath(url) else { throw SharedModelConnectorError.unmanagedPath }
    return try Self.sha256(url: url)
  }

  func atomicReplace(stagedUri: String, destinationUri: String) throws {
    let staged = Self.canonical(try parseFileURL(stagedUri))
    let destination = Self.canonical(try parseFileURL(destinationUri))
    guard staged.deletingLastPathComponent() == destination.deletingLastPathComponent(), staged != destination else {
      throw SharedModelConnectorError.unmanagedPath
    }
    guard isOwnerModelPath(staged), isOwnerModelPath(destination) else {
      throw SharedModelConnectorError.unmanagedPath
    }
    var coordinationError: NSError?
    var result: Result<Void, Error>?
    NSFileCoordinator().coordinate(writingItemAt: destination, options: .forReplacing, error: &coordinationError) { coordinated in
      result = Result {
        guard Self.canonical(coordinated) == destination else { throw SharedModelConnectorError.unmanagedPath }
        try self.replaceOwnerFile(staged: staged, destination: destination)
      }
    }
    if let coordinationError { throw coordinationError }
    guard let result else { throw SharedModelConnectorError.accessDenied }
    try result.get()
  }

  private func replaceOwnerFile(staged: URL, destination: URL) throws {
    let stagedValues = try staged.resourceValues(forKeys: [.isRegularFileKey])
    guard stagedValues.isRegularFile == true else { throw SharedModelConnectorError.notRegularFile }
    if fileManager.fileExists(atPath: destination.path) {
      let destinationValues = try destination.resourceValues(forKeys: [.isDirectoryKey])
      guard destinationValues.isDirectory != true else { throw SharedModelConnectorError.notRegularFile }
    }
    let handle = try FileHandle(forWritingTo: staged)
    try handle.synchronize()
    try handle.close()
    if fileManager.fileExists(atPath: destination.path) {
      _ = try fileManager.replaceItemAt(
        destination,
        withItemAt: staged,
        backupItemName: nil,
        options: []
      )
    } else {
      try fileManager.moveItem(at: staged, to: destination)
    }
  }

  func closeAll() {
    lock.lock()
    defer { lock.unlock() }
    // A JS/Expo teardown is not proof that llama has destroyed its mmap. Keep
    // outstanding scopes until explicit context-then-lease release or process
    // exit. Premature stopAccessing here can invalidate a live native context.
    guard leases.isEmpty else { return }
    for root in activeRoots.values {
      root.scopedURL?.stopAccessingSecurityScopedResource()
    }
    activeRoots.removeAll()
    leases.removeAll()
  }

  /** Legacy owner operations are confined to model areas. A shared read lease
   * never grants mutation authority or access to unrelated application files. */
  private func isOwnerModelPath(_ input: URL) -> Bool {
    let url = Self.canonical(input)
    let home = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
    var roots = [home.appendingPathComponent("Documents/ModelCommons", isDirectory: true),
                 home.appendingPathComponent("Library/Application Support/ModelCommonsPrivate", isDirectory: true)]
    if let group = Bundle.main.object(forInfoDictionaryKey: "ModelCommonsOwnerAppGroup") as? String,
       Self.configuredGroups.contains(group),
       let groupRoot = fileManager.containerURL(forSecurityApplicationGroupIdentifier: group) {
      roots.append(groupRoot.appendingPathComponent("ModelCommons", isDirectory: true))
    }
    return roots.contains { Self.isDescendant(url, of: Self.canonical($0)) }
  }

  private func parseFileURL(_ value: String) throws -> URL {
    if value.hasPrefix("file://") {
      guard let url = URL(string: value), url.isFileURL else {
        throw SharedModelConnectorError.invalidFileURL
      }
      return url
    }
    guard value.hasPrefix("/") else { throw SharedModelConnectorError.invalidFileURL }
    return URL(fileURLWithPath: value)
  }

  private func persistLocked() throws {
    let data = try JSONEncoder().encode(Array(connections.values))
    defaults.set(data, forKey: Self.connectionsKey)
  }

  private static var configuredGroups: [String] {
    Bundle.main.object(forInfoDictionaryKey: "ModelCommonsAppGroups") as? [String] ?? []
  }

  func ownerAppGroupRoot() throws -> String {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "ModelCommonsOwnerAppGroup") as? String,
          Self.configuredGroups.contains(group),
          let container = fileManager.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw SharedModelConnectorError.invalidGroup
    }
    return container.appendingPathComponent("ModelCommons", isDirectory: true).absoluteString
  }

  /// Conservative alpha admission, BEFORE coordinating or opening metadata.
  /// Direct sibling application Documents/ModelCommons only. Cloud and third-
  /// party provider containers (including locally cached ones) fail closed.
  /// This is a layout restriction, not a provider identity API or authority grant.
  private static func validateLocalDocumentsRoot(_ url: URL) throws {
    let candidate = canonical(url)
    let applications = canonical(URL(fileURLWithPath: NSHomeDirectory())).deletingLastPathComponent()
    guard url.isFileURL, isDescendant(candidate, of: applications) else {
      throw SharedModelConnectorError.accessDenied
    }
    let suffix = Array(candidate.pathComponents.dropFirst(applications.pathComponents.count))
    guard suffix.count == 3, UUID(uuidString: suffix[0]) != nil,
          suffix[1] == "Documents", suffix[2] == "ModelCommons" else {
      throw SharedModelConnectorError.accessDenied
    }
    let values = try candidate.resourceValues(forKeys: [.isDirectoryKey, .isUbiquitousItemKey])
    guard values.isDirectory == true, values.isUbiquitousItem != true else {
      throw SharedModelConnectorError.accessDenied
    }
  }

  static func validateRelativePath(_ value: String) throws {
    guard !value.isEmpty,
          value.utf8.count <= 1024,
          !value.hasPrefix("/"),
          !value.contains("\\"),
          !value.contains("%"), !value.contains(":"),
          !value.unicodeScalars.contains(where: { $0.value < 32 }) else {
      throw SharedModelConnectorError.invalidRelativePath
    }
    let components = value.split(separator: "/", omittingEmptySubsequences: false)
    guard components.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }) else {
      throw SharedModelConnectorError.invalidRelativePath
    }
  }

  private static func canonical(_ url: URL) -> URL {
    url.standardizedFileURL.resolvingSymlinksInPath()
  }

  static func isDescendant(_ candidate: URL, of root: URL) -> Bool {
    let rootPath = canonical(root).path.hasSuffix("/") ? canonical(root).path : canonical(root).path + "/"
    return canonical(candidate).path.hasPrefix(rootPath)
  }

  private static func sha256(url: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    var hasher = SHA256()
    while let data = try handle.read(upToCount: 1024 * 1024), !data.isEmpty {
      hasher.update(data: data)
    }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }

  private static let connectionsKey = "org.modelcommons.shared-connections.v1"
}
