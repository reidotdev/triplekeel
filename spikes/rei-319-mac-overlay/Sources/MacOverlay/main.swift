import AppKit

// REI-319: menu bar spike that tests reading, underlining and replacing
// prompt text in other apps through the Accessibility API. No models.
let app = NSApplication.shared
let coach = Coach()
app.delegate = coach
app.setActivationPolicy(.accessory)
app.run()
