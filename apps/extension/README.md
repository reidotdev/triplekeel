# Chrome extension

A Manifest V3 extension. It connects to a TripleKeel account, shows who is connected and their track, and scores past chats with **Score this chat**.

## Build

`pnpm build:extension` writes the unpacked extension to `apps/extension/dist/` and a zip to `apps/extension/triplekeel-extension.zip`.

- `TRIPLEKEEL_API_BASE` is the server address. The build reads it from the environment. Without it the build still works, but the extension can't connect.
- `EXTENSION_APP_URL` is optional. Set it only if the web app is on a different address from the API.

## Install

1. Download `triplekeel-extension` from a CI run and unzip it, or build it yourself.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and pick the unzipped folder.
4. Open the popup and click **Connect**. Sign in. The popup then shows "Connected as" and your email.

## Extension ID

The `key` in `manifest.json` is a public key. It pins the extension ID to `pdnjcggmbannclgepccjfphlfchijfln` for every install. The web app reads the same ID from `NEXT_PUBLIC_EXTENSION_ID`. The private key isn't in the repo and isn't needed to build.

## How connect works

- The popup opens `/connect` in the web app.
- The signed-in page creates a device token and sends it to the extension with `chrome.runtime.sendMessage`. Only the web app's address is listed in `externally_connectable`.
- The extension keeps the token in `chrome.storage.local` and sends it as `Authorization: Bearer tkd_...`.
- `GET /api/me` returns the email and track. `GET /api/questions` returns the track's question set, which is cached for 12 hours.
- A 401 means the device was revoked. The extension then forgets the token.

## Score this chat

Open a past chat on claude.ai or chatgpt.com and open the popup. When you're connected, it shows **Score this chat**. Shared chat links (`/share/...`) can't be scored, because they may show someone else's prompts.

1. The content script reads the user's own messages from the page, oldest first, up to the last 20. It reads only what the page shows and never calls the site's APIs.
2. `routeTrack()` drops messages outside your track. A message with no track words, like "fix it", takes the route of the chat's first message. Personal messages are always dropped.
3. Each remaining message goes through `createScorer()`. The popup shows "Scoring 7 of 14…".
4. The content script sends the popup only the answers, the length and an import key for each message. The popup builds the reports with `buildReport()`.
5. The popup sends the reports to `POST /api/signals` in batches of 50, with the device token. Then it links to `/dashboard`.

**Where prompt text lives.** Only in the content script, while it scores. It isn't stored, logged or sent in any message, to the popup or anywhere else.

**Import keys.** Each report has an `import_key`, so scoring the same chat again doesn't count twice. It is HMAC-SHA256 over the site, the conversation ID from the URL, the message's position and its text. The HMAC key is 32 random bytes made once per install and kept in `chrome.storage.local` as `importKeySecret`. A plain hash of a short prompt could be guessed, so it isn't used. A reinstall makes a new key, so a chat scored before and after a reinstall counts twice.

**Limits.** On a 429 the popup waits (Retry-After if given, up to 60 seconds) and tries once more. Closing the popup while it waits cancels the send. Scoring again is safe. A 401 forgets the token, as everywhere else.

### Manual check

1. Build with `TRIPLEKEEL_API_BASE` set, load `dist/` with **Load unpacked**, and connect.
2. Open a past chat with some product prompts. Reload the tab if it was open before you loaded the extension.
3. Click **Score this chat**. You should see "Done: N prompts scored." and **Open your skills**.
4. Click it again. It should say you scored this chat before.
5. In DevTools, check the `/api/signals` request body. It has reports only, no prompt text.

## Permissions

Host permissions are `claude.ai` and `chatgpt.com` only. The build fails if the manifest lists any other host. The content script uses the site adapters from the REI-246 spike.
