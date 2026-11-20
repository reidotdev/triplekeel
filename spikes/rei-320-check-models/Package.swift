// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "CheckModels",
    platforms: [.macOS(.v26)],
    targets: [
        .executableTarget(name: "CheckModels")
    ],
    // Swift 5 mode keeps this throwaway spike free of strict concurrency errors.
    swiftLanguageModes: [.v5]
)
