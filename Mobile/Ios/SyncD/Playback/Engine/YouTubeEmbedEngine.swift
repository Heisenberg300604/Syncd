import Observation
import UIKit
import WebKit

/// `AudioEngine` backed by YouTube's official IFrame player in a `WKWebView`.
///
/// This is the only way SyncD plays YouTube audio: the video is rendered by
/// YouTube's own player, never extracted. Consequences, by policy:
/// - foreground only (no lock screen / Control Center),
/// - no fine-grained rate control, so drift is corrected by seeking.
///
/// The web view lives for the whole app session. Views show it through
/// `YouTubePlayerSurface`; when none is on screen it is parked in the key
/// window so playback isn't torn down by navigation.
@MainActor
@Observable
final class YouTubeEmbedEngine: NSObject, AudioEngine {
    private(set) var state: EngineState = .idle {
        didSet {
            guard state != oldValue else { return }
            onStateChange?(state)
        }
    }
    private(set) var currentItem: PlaybackItem?
    private(set) var duration: TimeInterval?
    private(set) var rate: Double = 1

    /// Extrapolated between the player's ~4 Hz reports so drift checks see a
    /// smooth clock instead of a staircase.
    var currentTime: TimeInterval {
        guard state == .playing else { return reportedTime }
        let elapsed = Date().timeIntervalSince(reportedAt)
        // WebKit may throttle the page's timer; allow a few seconds of gap.
        return reportedTime + min(max(0, elapsed), 3)
    }

    var supportsRateAdjustment: Bool { false }

    @ObservationIgnored var onStateChange: ((EngineState) -> Void)?

    /// The player surface. Only `YouTubePlayerSurface` should reparent it.
    @ObservationIgnored let webView: WKWebView

    @ObservationIgnored private var reportedTime: TimeInterval = 0
    @ObservationIgnored private var reportedAt = Date()
    @ObservationIgnored private var isPlayerReady = false
    @ObservationIgnored private var readyWaiters: [CheckedContinuation<Void, Never>] = []
    @ObservationIgnored private var cueWaiter: CheckedContinuation<Result<Void, PlaybackError>, Never>?
    @ObservationIgnored private var loadGeneration = 0
    /// True once the cued video has started playing at least once. Before
    /// that, `seekTo` would start playback, so seeks are deferred to `play()`.
    @ObservationIgnored private var hasStarted = false
    @ObservationIgnored private var pendingStart: TimeInterval = 0
    @ObservationIgnored private var wantsToPlay = false

    static let messageHandlerName = "syncd"
    static let cueTimeout: Duration = .seconds(20)

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsPictureInPictureMediaPlayback = false
        webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 320, height: 180), configuration: configuration)
        super.init()

        configuration.userContentController.add(WeakScriptMessageHandler(self), name: Self.messageHandlerName)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isUserInteractionEnabled = false
        webView.isInspectable = true
        webView.loadHTMLString(Self.html(origin: Self.origin), baseURL: URL(string: Self.origin))
    }

    // MARK: AudioEngine

    func load(_ item: PlaybackItem) async throws(PlaybackError) {
        guard case let .youtube(videoId) = item.source else {
            throw .unsupportedSource("This source can't play in the YouTube player.")
        }
        loadGeneration += 1
        let generation = loadGeneration
        resolveCue(.failure(.unknown("Superseded")))

        wantsToPlay = false
        hasStarted = false
        pendingStart = 0
        currentItem = item
        duration = item.duration
        setReportedTime(0)
        state = .loading
        parkIfDetached()

        await waitUntilReady()
        guard generation == loadGeneration else { return }

        let result = await withCheckedContinuation { (continuation: CheckedContinuation<Result<Void, PlaybackError>, Never>) in
            cueWaiter = continuation
            run("cue(\(Self.jsString(videoId)))")
            Task { [weak self] in
                try? await Task.sleep(for: Self.cueTimeout)
                guard let self, generation == self.loadGeneration else { return }
                self.resolveCue(.failure(.network))
            }
        }
        guard generation == loadGeneration else { return }

        switch result {
        case .success:
            if state == .loading { state = .ready }
        case let .failure(error):
            state = .failed(error)
            throw error
        }
    }

    func play() {
        guard currentItem != nil, isPlayerReady else { return }
        wantsToPlay = true
        if !hasStarted {
            run("player.seekTo(\(pendingStart), true); player.playVideo();")
        } else {
            run("player.playVideo()")
        }
    }

    func pause() {
        wantsToPlay = false
        guard currentItem != nil else { return }
        run("player.pauseVideo()")
        if state != .ended, !isFailed, state != .loading {
            state = hasStarted ? .paused : .ready
        }
    }

    @discardableResult
    func seek(to position: TimeInterval) async -> Bool {
        guard currentItem != nil, position.isFinite else { return false }
        let target = max(0, position)
        setReportedTime(target)
        if !hasStarted {
            pendingStart = target
            return true
        }
        run("player.seekTo(\(target), true)")
        return true
    }

    /// The IFrame player only supports a few discrete rates; drift is
    /// corrected by seeking instead (`supportsRateAdjustment == false`).
    func setRate(_ rate: Double) {}

    func setVolume(_ volume: Float) {
        run("player.setVolume(\(Int(min(max(volume, 0), 1) * 100)))")
    }

    func stop() {
        loadGeneration += 1
        resolveCue(.failure(.unknown("Stopped")))
        wantsToPlay = false
        hasStarted = false
        pendingStart = 0
        if isPlayerReady { run("player.stopVideo()") }
        currentItem = nil
        duration = nil
        setReportedTime(0)
        state = .idle
    }

    // MARK: Hosting

    /// Keeps the web view in a window when no `YouTubePlayerSurface` shows
    /// it; WebKit won't start media in a view that isn't in a window.
    func parkIfDetached() {
        guard webView.window == nil, let window = Self.keyWindow else { return }
        webView.removeFromSuperview()
        webView.frame = CGRect(x: 0, y: 0, width: 2, height: 2)
        webView.alpha = 0.01
        window.insertSubview(webView, at: 0)
    }

    private static var keyWindow: UIWindow? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? scenes.first?.windows.first
    }

    // MARK: Bridge

    fileprivate func handle(_ body: Any) {
        guard let message = body as? [String: Any], let type = message["type"] as? String else { return }
        // Before the first play the player reports 0; keep the deferred seek target instead.
        if hasStarted, let time = message["time"] as? Double, time.isFinite { setReportedTime(time) }
        if let total = message["duration"] as? Double, total.isFinite, total > 0 { duration = total }

        switch type {
        case "ready":
            isPlayerReady = true
            readyWaiters.forEach { $0.resume() }
            readyWaiters = []
        case "state":
            guard currentItem != nil, let code = message["state"] as? Int else { return }
            handlePlayerState(code)
        case "error":
            let code = message["code"] as? Int ?? -1
            let error = Self.map(errorCode: code)
            Log.playback.error("YouTube player error \(code, privacy: .public)")
            if cueWaiter != nil {
                resolveCue(.failure(error))
            } else if currentItem != nil {
                wantsToPlay = false
                state = .failed(error)
            }
        default:
            break
        }
    }

    /// YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused,
    /// 3 buffering, 5 cued.
    private func handlePlayerState(_ code: Int) {
        switch code {
        case 5:
            resolveCue(.success(()))
        case 1:
            hasStarted = true
            if wantsToPlay {
                state = .playing
            } else {
                // The player started on its own (e.g. a seek on a cued video).
                run("player.pauseVideo()")
            }
        case 2:
            guard hasStarted else { return }
            wantsToPlay = false
            if !isFailed, state != .ended { state = .paused }
        case 3:
            if hasStarted, wantsToPlay { state = .buffering }
        case 0:
            wantsToPlay = false
            if let duration { setReportedTime(duration) }
            state = .ended
        default:
            break
        }
    }

    private func waitUntilReady() async {
        guard !isPlayerReady else { return }
        await withCheckedContinuation { readyWaiters.append($0) }
    }

    private func resolveCue(_ result: Result<Void, PlaybackError>) {
        guard let waiter = cueWaiter else { return }
        cueWaiter = nil
        waiter.resume(returning: result)
    }

    private func setReportedTime(_ time: TimeInterval) {
        reportedTime = time
        reportedAt = Date()
    }

    private var isFailed: Bool {
        if case .failed = state { return true }
        return false
    }

    private func run(_ script: String) {
        webView.evaluateJavaScript("try { \(script) } catch (e) {}", completionHandler: nil)
    }

    private static func map(errorCode: Int) -> PlaybackError {
        switch errorCode {
        case 100: .sourceUnavailable
        case 101, 150, 152, 153:
            .unsupportedSource("The owner of this video doesn't allow it to play outside YouTube.")
        case 5: .unplayableFormat
        default: .unknown("YouTube couldn't play this track.")
        }
    }

    // MARK: Page

    /// YouTube requires an identifiable embedding origin (missing or `about:`
    /// origins fail with error 152/153). The bundle id is a stable choice.
    static let origin = "https://" + (Bundle.main.bundleIdentifier ?? "com.syncd.ios").lowercased()

    private static func jsString(_ value: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [value])
        let array = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(array.dropFirst().dropLast())
    }

    private static func html(origin: String) -> String {
        """
        <!DOCTYPE html>
        <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}#player{position:absolute;inset:0;width:100%;height:100%}</style>
        </head><body>
        <div id="player"></div>
        <script>
        var player = null;
        function send(m) { window.webkit.messageHandlers.\(messageHandlerName).postMessage(m); }
        function snapshot(extra) {
          var m = extra || {};
          try { m.time = player.getCurrentTime(); m.duration = player.getDuration(); } catch (e) {}
          return m;
        }
        function cue(id) { player.cueVideoById({ videoId: id, startSeconds: 0 }); }
        function onYouTubeIframeAPIReady() {
          player = new YT.Player('player', {
            width: '100%', height: '100%',
            playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0,
                          iv_load_policy: 3, modestbranding: 1, enablejsapi: 1,
                          origin: '\(origin)', widget_referrer: '\(origin)' },
            events: {
              onReady: function () {
                send({ type: 'ready' });
                setInterval(function () { send(snapshot({ type: 'time' })); }, 250);
              },
              onStateChange: function (e) { send(snapshot({ type: 'state', state: e.data })); },
              onError: function (e) { send({ type: 'error', code: e.data }); }
            }
          });
        }
        </script>
        <script src="https://www.youtube.com/iframe_api"></script>
        </body></html>
        """
    }
}

/// `WKUserContentController` retains its handlers; this breaks the cycle.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var engine: YouTubeEmbedEngine?

    init(_ engine: YouTubeEmbedEngine) { self.engine = engine }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body
        MainActor.assumeIsolated { engine?.handle(body) }
    }
}
