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

  var errorDescription: String? {
    switch self {
    case .invalidConnection: return "Shared model connection is unknown or corrupt."
    case .invalidGroup: return "The App Group is invalid, unavailable, or not provisioned for this target."
    case .invalidRelativePath: return "Model path must be a safe relative path below the connected directory."
    case .accessDenied: return "Security-scoped directory access was denied or revoked."
    case .notDirectory: return "The selected resource is not a directory."
    case .notRegularFile: return "The model resource is not a regular file."
    case .activeLeases: return "Release all model leases before disconnecting the directory."
    case .unknownLease: return "Model file lease is unknown or already released."
    case .unmanagedPath: return "File operation is outside app-owned or actively leased storage."
    case .invalidFileURL: return "Only absolute paths and file URLs are accepted."
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
    ["id": id, "connectionId": connectionId, "uri": url.absoluteString]
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
  }

  private let fileManager = FileManager.default
  private let defaults = UserDefaults.standard
  private let lock = NSLock()
  private var connections: [String: SharedConnectionDescriptor] = [:]
  private var activeRoots: [String: ActiveRoot] = [:]
  private var leases: [String: LeaseRecord] = [:]

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
      displayName: url.lastPathComponent.isEmpty ? "ModelCommons" : url.lastPathComponent,
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
    guard groupIdentifier.hasPrefix("group."),
          let root = fileManager.containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier) else {
      throw SharedModelConnectorError.invalidGroup
    }
    let descriptor = SharedConnectionDescriptor(
      id: UUID().uuidString,
      kind: .appGroup,
      displayName: root.lastPathComponent,
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
    try Self.validateRelativePath(relativePath)
    lock.lock()
    defer { lock.unlock() }
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
              let groupRoot = fileManager.containerURL(forSecurityApplicationGroupIdentifier: group) else {
          throw SharedModelConnectorError.invalidGroup
        }
        root = Self.canonical(groupRoot)
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
      let values = try modelURL.resourceValues(forKeys: [.isRegularFileKey])
      guard values.isRegularFile == true else { throw SharedModelConnectorError.notRegularFile }
      let leaseId = UUID().uuidString
      leases[leaseId] = LeaseRecord(connectionId: connectionId, url: modelURL)
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
    defer { lock.unlock() }
    guard let lease = leases.removeValue(forKey: leaseId),
          var root = activeRoots[lease.connectionId] else {
      throw SharedModelConnectorError.unknownLease
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
    lock.lock()
    defer { lock.unlock() }
    guard let url = leases[leaseId]?.url else {
      throw SharedModelConnectorError.unknownLease
    }
    return try Self.sha256(url: url)
  }

  func sha256ManagedFile(uri: String) throws -> String {
    let url = try parseFileURL(uri)
    lock.lock()
    defer { lock.unlock() }
    guard isManagedLocked(url) else { throw SharedModelConnectorError.unmanagedPath }
    return try Self.sha256(url: url)
  }

  func atomicReplace(stagedUri: String, destinationUri: String) throws {
    let staged = Self.canonical(try parseFileURL(stagedUri))
    let destination = Self.canonical(try parseFileURL(destinationUri))
    guard staged.deletingLastPathComponent() == destination.deletingLastPathComponent(), staged != destination else {
      throw SharedModelConnectorError.unmanagedPath
    }
    lock.lock()
    defer { lock.unlock() }
    guard isManagedLocked(staged), isManagedLocked(destination) else {
      throw SharedModelConnectorError.unmanagedPath
    }
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
    for root in activeRoots.values {
      root.scopedURL?.stopAccessingSecurityScopedResource()
    }
    activeRoots.removeAll()
    leases.removeAll()
  }

  /** Caller must hold `lock`, keeping any security-scoped root active through I/O. */
  private func isManagedLocked(_ input: URL) -> Bool {
    let url = Self.canonical(input)
    var roots = [Self.canonical(URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true))]
    roots.append(contentsOf: activeRoots.values.map(\.url))
    for connection in connections.values where connection.kind == .appGroup {
      if let group = connection.groupIdentifier,
         let root = fileManager.containerURL(forSecurityApplicationGroupIdentifier: group) {
        roots.append(Self.canonical(root))
      }
    }
    return roots.contains { Self.isDescendant(url, of: $0) || url == $0 }
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

  private static func validateRelativePath(_ value: String) throws {
    guard !value.isEmpty,
          !value.hasPrefix("/"),
          !value.contains("\\"),
          !value.utf8.contains(0) else {
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

  private static func isDescendant(_ candidate: URL, of root: URL) -> Bool {
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
