// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ChatY",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "ChatY", targets: ["ChatY"])
    ],
    targets: [
        .executableTarget(
            name: "ChatY",
            path: "Sources/ChatY"
        )
    ]
)
