import ExpoModulesCore
import Foundation
import UniformTypeIdentifiers
import UIKit

private final class DirectoryPickerDelegate: NSObject, UIDocumentPickerDelegate {
  private var completed = false
  private let completion: (Result<URL, Error>) -> Void

  init(completion: @escaping (Result<URL, Error>) -> Void) {
    self.completion = completion
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    finish(urls.first.map(Result.success) ?? Result.failure(SharedModelConnectorError.invalidConnection))
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    finish(.failure(SharedModelConnectorError.accessDenied))
  }

  private func finish(_ result: Result<URL, Error>) {
    guard !completed else { return }
    completed = true
    completion(result)
  }
}

public final class ModelCommonsNativeModule: Module {
  private let connector = SharedModelConnector()
  private var pickerDelegate: DirectoryPickerDelegate?

  public func definition() -> ModuleDefinition {
    Name("ModelCommonsNative")

    AsyncFunction("getAvailability") {
      [
        "available": true,
        "platform": "ios",
        "androidHubConnected": false,
        "iosSharedModels": true,
      ] as [String: Any]
    }

    AsyncFunction("getDeviceProfile") {
      let processInfo = ProcessInfo.processInfo
      let os = processInfo.operatingSystemVersion
      return [
        "physicalMemoryBytes": Double(processInfo.physicalMemory),
        "osVersion": "\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)",
        "accelerators": [
          [
            "id": "cpu",
            "kind": "cpu",
            "name": "Apple CPU (\(processInfo.processorCount) logical cores)",
          ],
        ],
      ] as [String: Any]
    }

    AsyncFunction("connectSharedDirectory") { (promise: Promise) in
      guard self.pickerDelegate == nil else {
        promise.reject("ERR_MODELCOMMONS_PICKER", "A directory picker is already active.")
        return
      }
      guard let viewController = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_MODELCOMMONS_PICKER", "No view controller is available to present the directory picker.")
        return
      }
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
      let delegate = DirectoryPickerDelegate { result in
        defer { self.pickerDelegate = nil }
        switch result {
        case .success(let url):
          do {
            promise.resolve(try self.connector.createSecurityScopedConnection(url: url).dictionary())
          } catch {
            promise.reject("ERR_MODELCOMMONS_BOOKMARK", error.localizedDescription)
          }
        case .failure(let error):
          promise.reject("ERR_MODELCOMMONS_PICKER", error.localizedDescription)
        }
      }
      self.pickerDelegate = delegate
      picker.delegate = delegate
      viewController.present(picker, animated: true)
    }.runOnQueue(.main)

    AsyncFunction("connectAppGroup") { (groupIdentifier: String) in
      try self.connector.createAppGroupConnection(groupIdentifier: groupIdentifier).dictionary()
    }

    AsyncFunction("listSharedConnections") {
      self.connector.listConnections().map { $0.dictionary() }
    }

    AsyncFunction("disconnectSharedDirectory") { (connectionId: String) in
      try self.connector.disconnect(connectionId: connectionId)
    }

    AsyncFunction("acquireModelLease") { (connectionId: String, relativePath: String) in
      try self.connector.acquire(connectionId: connectionId, relativePath: relativePath).dictionary()
    }

    AsyncFunction("releaseModelLease") { (leaseId: String) in
      try self.connector.release(leaseId: leaseId)
    }

    AsyncFunction("sha256Lease") { (leaseId: String) in
      try self.connector.sha256(leaseId: leaseId)
    }

    AsyncFunction("sha256File") { (uri: String) in
      try self.connector.sha256ManagedFile(uri: uri)
    }

    AsyncFunction("atomicReplaceFile") { (stagedUri: String, destinationUri: String) in
      try self.connector.atomicReplace(stagedUri: stagedUri, destinationUri: destinationUri)
    }

    OnDestroy {
      self.connector.closeAll()
      self.pickerDelegate = nil
    }

    OnAppContextDestroys {
      self.connector.closeAll()
      self.pickerDelegate = nil
    }
  }
}
