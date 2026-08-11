import SwiftUI
import WebKit

struct WebView: NSViewRepresentable {
    let url: URL
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Enable developer tools (Web Inspector)
        configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.uiDelegate = context.coordinator
        webView.wantsLayer = true
        return webView
    }
    
    func updateNSView(_ nsView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
        nsView.load(request)
    }
    
    class Coordinator: NSObject, WKUIDelegate {
        // macOS 12.0+ media capture permission grant
        @available(macOS 12.0, *)
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            // Automatically grant mic permission for localhost
            decisionHandler(.grant)
        }
    }
}

struct ContentView: View {
    @State private var serverReady = false
    private let targetURL = URL(string: "http://localhost:3000")!
    
    var body: some View {
        ZStack {
            if serverReady {
                WebView(url: targetURL)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 16) {
                    ProgressView()
                        .controlSize(.large)
                    
                    Text("INITIALISING SYSTEMS...")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(Theme.textSecondary)
                    
                    Text("Starting local servers at http://localhost:3000")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(Theme.textMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.bgBase)
            }
        }
        .onAppear {
            checkServerStatus()
        }
    }
    
    private func checkServerStatus() {
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
            var request = URLRequest(url: targetURL)
            request.httpMethod = "HEAD"
            request.timeoutInterval = 1.0
            
            URLSession.shared.dataTask(with: request) { _, response, _ in
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    DispatchQueue.main.async {
                        self.serverReady = true
                        timer.invalidate()
                    }
                }
            }
            .resume()
        }
    }
}
