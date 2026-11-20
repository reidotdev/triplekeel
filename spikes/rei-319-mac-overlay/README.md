# REI-319 and REI-321 Mac coach prototype

A menu bar app that coaches prompts like Grammarly:

1. **Reads** the prompt box you're typing in, through the Accessibility API.
2. **Checks** the prompt with Apple's on-device model when you pause typing for about a second. The model picks up to two weak spots and writes a senior rewrite of each.
3. **Underlines** those spots on screen.
4. **Shows a card** on hover: the habit, why it matters, and the rewrite. **Approve** unlocks after a short reading delay.
5. **Replaces** the text on Approve. Cmd+Z undoes it.

Rewrites put details only you know in square brackets, like `[your users]`, so you fill them in yourself.

It only acts on multi-line prompt boxes (`AXTextArea`), so address bars and search fields are ignored. If Apple's model isn't available, it falls back to hardcoded fixes for "make it better" and "fix it".

REI-319 tested the overlay with hardcoded suggestions. REI-321 plugged in the model.

## Privacy

The app reads only the focused field of the app in front. It skips password fields. It never logs or stores prompt text, only counts, field roles and which write method worked. It has no network code.

## Requirements

- macOS 26 on Apple silicon, with Apple Intelligence turned on.
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
