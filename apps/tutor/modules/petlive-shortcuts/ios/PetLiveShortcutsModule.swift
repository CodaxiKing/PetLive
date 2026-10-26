import ExpoModulesCore
import UIKit

private enum ShortcutState {
  private static let lock = NSLock()
  static let event = Notification.Name("PetLiveShortcut")
  static var pending: (action: String, date: Date)?

  static func receive(_ item: UIApplicationShortcutItem) -> Bool {
    let actions = ["app.petlive.atalho.sos": "sos", "app.petlive.atalho.peso": "peso", "app.petlive.atalho.passeio": "passeio"]
    guard let action = actions[item.type] else { return false }
    lock.lock()
    pending = (action, Date())
    lock.unlock()
    NotificationCenter.default.post(name: event, object: nil)
    return true
  }

  static func consume() -> String? {
    lock.lock()
    defer { pending = nil; lock.unlock() }
    guard let value = pending, Date().timeIntervalSince(value.date) < 600 else { return nil }
    return value.action
  }
}

public class PetLiveShortcutsSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    if let item = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem { _ = ShortcutState.receive(item) }
    return true
  }

  public func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
    // Expo SDK 58 encaminha também o atalho recebido na conexão inicial da Scene.
    completionHandler(ShortcutState.receive(shortcutItem))
  }
}

public class PetLiveShortcutsModule: Module {
  private var observer: NSObjectProtocol?
  public func definition() -> ModuleDefinition {
    Name("PetLiveShortcuts")
    Events("acao")
    Function("consumir") { () -> String? in ShortcutState.consume() }
    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(forName: ShortcutState.event, object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("acao", [:])
      }
    }
    OnStopObserving {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }
    OnDestroy {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
    }
  }
}
