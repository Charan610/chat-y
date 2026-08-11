import SwiftUI
import AppKit

class ServerManager {
    static let shared = ServerManager()
    
    private var backendProcess: Process?
    private var frontendProcess: Process?
    
    private init() {}
    
    func startServers() {
        // Resolve workspace path dynamically relative to the bundle
        let workspace: String
        let bundleURL = Bundle.main.bundleURL
        let potentialWorkspace = bundleURL.deletingLastPathComponent().deletingLastPathComponent().path
        if FileManager.default.fileExists(atPath: "\(potentialWorkspace)/backend") &&
           FileManager.default.fileExists(atPath: "\(potentialWorkspace)/frontend") {
            workspace = potentialWorkspace
        } else {
            workspace = "/Users/charan/CHAT-Y" // Fallback
        }
        
        print("Using workspace: \(workspace)")
        
        // Setup environment PATH with common developer paths
        var env = ProcessInfo.processInfo.environment
        let homeDir = NSHomeDirectory()
        let searchPaths = [
            "\(homeDir)/.local/bin",
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin"
        ]
        let existingPath = env["PATH"] ?? ""
        env["PATH"] = searchPaths.joined(separator: ":") + (existingPath.isEmpty ? "" : ":" + existingPath)
        
        // Start Backend (Uvicorn FastAPI)
        let bp = Process()
        bp.executableURL = URL(fileURLWithPath: "/bin/zsh")
        // Use exec to replace shell with python process and redirect stdout/stderr to a log file to avoid pipe buffer blocking
        bp.arguments = ["-c", "cd \(workspace)/backend && exec .venv/bin/python -m uvicorn main:app --port 8000 > backend.log 2>&1"]
        bp.environment = env
        
        do {
            try bp.run()
            backendProcess = bp
            print("✓ FastAPI Backend process launched")
        } catch {
            print("Error starting backend: \(error.localizedDescription)")
        }
        
        // Start Frontend (Next.js dev server)
        let fp = Process()
        fp.executableURL = URL(fileURLWithPath: "/bin/zsh")
        // Use exec to replace shell with npm process and redirect stdout/stderr to a log file to avoid pipe buffer blocking
        fp.arguments = ["-c", "cd \(workspace)/frontend && exec npm run dev > frontend.log 2>&1"]
        fp.environment = env
        
        do {
            try fp.run()
            frontendProcess = fp
            print("✓ Next.js Frontend process launched")
        } catch {
            print("Error starting frontend: \(error.localizedDescription)")
        }
    }
    
    func stopServers() {
        print("Stopping J.A.R.V.I.S. servers...")
        backendProcess?.terminate()
        frontendProcess?.terminate()
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Start background servers
        ServerManager.shared.startServers()
        
        // Register status item in menu bar
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem?.button {
            if let image = NSImage(systemSymbolName: "triangle.circle.fill", accessibilityDescription: "CHAT-Y") {
                image.isTemplate = true
                button.image = image
            } else {
                button.title = "▲"
            }
            button.action = #selector(menuBarClicked)
            button.target = self
        }
        
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        
        DispatchQueue.main.async {
            for window in NSApp.windows {
                window.titlebarAppearsTransparent = true
                window.titleVisibility = .visible
                window.styleMask.insert([.titled, .closable, .miniaturizable, .resizable])
            }
        }
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        // Kill background servers on exit
        ServerManager.shared.stopServers()
    }
    
    @objc func menuBarClicked() {
        NSApp.activate(ignoringOtherApps: true)
        if let window = NSApp.windows.first {
            if window.isVisible {
                if window.isMiniaturized {
                    window.deminiaturize(nil)
                }
                window.orderFront(nil)
            } else {
                window.makeKeyAndOrderFront(nil)
            }
        }
    }
}

@main
struct ChatYApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    init() {
        NSWindow.allowsAutomaticWindowTabbing = false
    }

    var body: some Scene {
        WindowGroup("CHAT-Y") {
            ContentView()
                .frame(minWidth: 1020, minHeight: 680)
                .background(Theme.bgBase)
                .preferredColorScheme(.dark)
        }
    }
}
