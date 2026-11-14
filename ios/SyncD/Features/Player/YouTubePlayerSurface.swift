import SwiftUI
import UIKit

/// Shows YouTube's embedded player (`YouTubeEmbedEngine.webView`) in the
/// layout. YouTube requires its player to be visible while it plays, so any
/// screen that presents a YouTube room track should include this.
///
/// The web view is shared: the most recently shown surface owns it, and when
/// that surface leaves the screen the engine parks it so audio continues.
struct YouTubePlayerSurface: View {
    var cornerRadius: CGFloat = Theme.Radius.lg

    @Environment(AppDependencies.self) private var dependencies

    var body: some View {
        WebViewHost(engine: dependencies.youTubePlayer)
            .aspectRatio(16 / 9, contentMode: .fit)
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .accessibilityLabel("YouTube video")
    }
}

private struct WebViewHost: UIViewRepresentable {
    let engine: YouTubeEmbedEngine

    func makeUIView(context: Context) -> HostView {
        let host = HostView()
        host.engine = engine
        host.backgroundColor = .black
        return host
    }

    func updateUIView(_ host: HostView, context: Context) {
        host.claim()
    }

    static func dismantleUIView(_ host: HostView, coordinator: ()) {
        host.release()
    }

    final class HostView: UIView {
        weak var engine: YouTubeEmbedEngine?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window != nil { claim() } else { release() }
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            if let webView = engine?.webView, webView.superview === self {
                webView.frame = bounds
            }
        }

        func claim() {
            guard let webView = engine?.webView, window != nil, webView.superview !== self else { return }
            Self.visibleHosts.removeAll { $0.host == nil || $0.host === self }
            Self.visibleHosts.append(WeakHost(host: self))
            webView.removeFromSuperview()
            webView.alpha = 1
            webView.frame = bounds
            webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(webView)
        }

        func release() {
            Self.visibleHosts.removeAll { $0.host == nil || $0.host === self }
            guard let engine, engine.webView.superview === self else { return }
            // Hand the player to another surface still on screen (e.g. the
            // room card under a dismissed sheet), else park it in the window.
            // Either way media never leaves the view tree.
            if let next = Self.visibleHosts.last(where: { $0.host?.window != nil })?.host {
                next.claim()
            } else {
                engine.webView.removeFromSuperview()
                engine.parkIfDetached()
            }
        }

        private struct WeakHost { weak var host: HostView? }
        private static var visibleHosts: [WeakHost] = []
    }
}
