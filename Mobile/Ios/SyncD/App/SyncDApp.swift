import ClerkKit
import SwiftData
import SwiftUI

@main
struct SyncDApp: App {
    private enum Bootstrap {
        case ready(AppDependencies)
        case misconfigured(ConfigurationError)
        /// Hosting unit tests: don't configure Clerk or touch the network.
        case testing
    }

    @State private var bootstrap: Bootstrap

    init() {
        if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil {
            _bootstrap = State(initialValue: .testing)
            return
        }
        do {
            let configuration = try AppConfiguration.load()
            let clerk = Clerk.configure(publishableKey: configuration.clerkPublishableKey)
            let dependencies = AppDependencies(configuration: configuration, clerk: clerk)
            _bootstrap = State(initialValue: .ready(dependencies))
        } catch {
            _bootstrap = State(initialValue: .misconfigured(error))
        }
    }

    var body: some Scene {
        WindowGroup {
            switch bootstrap {
            case let .ready(dependencies):
                RootView()
                    .environment(dependencies)
                    .environment(dependencies.session)
                    .environment(dependencies.playback)
                    .environment(dependencies.rooms)
                    .environment(dependencies.clerk)
                    .modelContainer(dependencies.modelContainer)
                    .task { dependencies.start() }
            case let .misconfigured(error):
                ConfigurationErrorView(error: error)
            case .testing:
                Color.clear
            }
        }
    }
}
