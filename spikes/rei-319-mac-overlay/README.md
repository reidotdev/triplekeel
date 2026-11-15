# REI-319 Mac overlay spike

A menu bar app that tests the Grammarly-like part of the Mac coach, with no models:

1. **Read** the text of the focused text field through the Accessibility API.
2. **Underline** a piece of it on screen.
3. **Show a card** on hover, with a hint, a suggested fix and an **Approve** button that unlocks after a short reading delay.
4. **Replace** the text on Approve.

The suggestions are hardcoded. Type `make it better`, `fix it` or `build an app` to get a real-looking one. Any other text gets a test underline over the first few words.

## Privacy

The app reads only the focused field of the app in front. It skips password fields. It never logs or stores prompt text, only counts, field roles and which write method worked. It has no network code.

## Requirements

- macOS 14 or later.
- The Command Line Tools (`xcode-select --install`).
- Accessibility permission for your terminal app. The app runs inside the terminal, so macOS asks on behalf of Terminal (or iTerm, Warp and so on).

## Run it

```bash
cd spikes/rei-319-mac-overlay
swift run
```

On the first run, macOS asks for Accessibility permission. Allow your terminal app in **System Settings → Privacy & Security → Accessibility**, then stop the app with **Ctrl+C** and run it again.

An orange **TK** appears in the menu bar. Its menu shows what the app sees in the current field, and has **Pause**, **Copy report** and **Quit**.

## Test checklist

Do this in each app: **Claude desktop**, **Cursor** and **Chrome** on claude.ai and chatgpt.com.

1. Click into the prompt box and type `please make it better`.
2. **Read:** the TK menu shows the app, the field role and a character count.
3. **Underline:** an orange line appears under "make it better".
4. **Alignment:** scroll the page, resize the window and add text before the phrase. Does the line follow?
5. **Card:** hover over the line. The card appears, and Approve unlocks after about a second.
6. **Replace:** click Approve. Does the text change? The terminal prints which method worked.
7. **Undo:** press **Cmd+Z**. Does it undo the change in one step?

Then choose **Copy report** from the TK menu and paste it into REI-319, with notes on steps 4 and 7.

## How it works

- Polls the focused element of the app in front every 0.3 s.
- Chrome and Electron apps build their Accessibility tree only for assistive technology, so the app sets `AXManualAccessibility` and, for Chrome, `AXEnhancedUserInterface`.
- Screen positions come from `kAXBoundsForRangeParameterizedAttribute`. Wrapped text gets an underline on the first line only.
- Writing back tries the Accessibility API first: select the range, then set the selected text. If the field doesn't change, it selects the range, pastes through the clipboard and restores the clipboard afterwards.

## Caveats

- Written on Linux, so the first build on a Mac may need small fixes. Paste any build error into the session.
- Polling is simple but wasteful. A real app would use `AXObserver` notifications.
