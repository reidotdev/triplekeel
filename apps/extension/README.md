# Chrome extension

A Manifest V3 extension. It connects to a TripleKeel account and shows who is connected and their track. It doesn't score or send anything yet.

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

## Permissions

Host permissions are `claude.ai` and `chatgpt.com` only. The build fails if the manifest lists any other host. The content script uses the site adapters from the REI-246 spike. For now it only counts user messages on the page and reads no prompt text.
