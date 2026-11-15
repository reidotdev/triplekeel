// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MacOverlay",
    // macOS 26 for Apple's on-device model (Foundation Models).
    platforms: [.macOS(.v26)],
    targets: [
        .executableTarget(name: "MacOverlay")
    ],
    // Swift 5 mode keeps this throwaway spike free of strict concurrency errors.
    swiftLanguageModes: [.v5]
)
