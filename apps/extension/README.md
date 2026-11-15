# Chrome extension

A Manifest V3 extension. It connects to a Triplekeel account, shows who is connected and their track, scores each prompt you send on claude.ai and chatgpt.com (**live capture**), and scores past chats with **Score this chat**.

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

## Live capture

When you're connected and have a track, each prompt you send on claude.ai or chatgpt.com is scored in the page and adds to your levels. Code: `src/live-capture.ts` (content script), `src/live-send.ts` (background worker), `src/live-store.ts` and `src/settings.ts`.

1. The content script listens for Enter (not Shift+Enter) and clicks on the send button, through the site adapter's `onPromptSubmit`. It never reads fields that `isSafePromptEditor` rejects, like password and payment fields.
2. It counts a prompt only once the site has cleared the prompt box, so Enter pressed while the AI is still answering doesn't count. Enter and a click for the same prompt count once.
3. `routeTrack()` runs first. Personal and off-track prompts are dropped here and never scored. As in Score this chat, a follow-up with no track words, like "fix it", takes the route of the chat's first prompt.
4. `createScorer()` scores it. The prompt is a follow-up if the page already shows one of your messages, and new otherwise.
5. `buildReport()` makes a `source: "live"` report with no `import_key`. The content script saves the prompt and its report in the local history, then sends only the report to the background worker.
6. The background worker queues it and sends the queue to `POST /api/signals`.

Live capture runs only when the device token, your track and its questions are saved. If you choose a track after connecting, open the popup once to load it.

**Where prompt text lives.** In the content script while it scores, and in `liveHistory` in `chrome.storage.local`. Nothing else gets it: the background worker and the server get reports only. The background worker checks each report against the schema before it queues it.

**Batching.** The queue is `liveQueue` in `chrome.storage.local`, so a browser restart loses nothing.

- It sends when 10 reports are waiting, or when the oldest has waited 3 minutes.
- It checks on each new report, when the popup opens, when the browser starts, and on a timer kept by each open claude.ai or chatgpt.com tab while reports wait. A report queued with no tab open goes out on the next of these.
- One request per send, at most 50 reports, and at least a minute between sends. That keeps live capture under the server's 50 reports a minute per device and Cloudflare's 10 requests per 10 seconds.
- On a 429 the reports stay queued. The next send waits for Retry-After, or backs off 1, 2, 4… minutes up to 30 without it. It never waits in the worker or retries in a loop.
- On a 401 the token is forgotten, as everywhere else, and the queue and history are deleted. Capture stops.
- A 400 means the server won't take the batch. It's dropped, not resent, and counted in `liveSendState.rejected`.
- The queue holds at most 200 reports. Past that, the oldest are dropped and counted in `liveSendState.dropped`.
- A report sent but not confirmed, like when the network drops, is sent again, so it can count twice. A live prompt you later score with Score this chat also counts twice, because live reports have no import key.

### Settings (for the popup's toggles, REI-272)

`settings` in `chrome.storage.local`:

```ts
type Settings = {
  paused: boolean; // true stops live capture everywhere
  sites: { claude: boolean; chatgpt: boolean }; // false stops it on that site
};
```

A missing or bad value means capture is on. Use `readSettings()` and `saveSettings()` from `src/settings.ts`. Open tabs pick up a change at once through `chrome.storage.onChanged`, and stop reading the prompt box while capture is off. Pausing doesn't drop reports already queued.

### History (for the "what was sent" view, REI-272)

`liveHistory` in `chrome.storage.local` holds the last 20 scored prompts, newest first. `readHistory()` in `src/live-store.ts` returns them with a status:

```ts
type HistoryItem = {
  id: string; // the same ID as the queued report
  site: "claude" | "chatgpt";
  scoredAt: number; // ms since 1970
  text: string; // the prompt, kept only in this browser
  report: Report; // all that goes to the server
  status: "queued" | "sent" | "not_sent"; // not_sent: dropped or refused
};
```

Dropped prompts (personal or off-track) aren't kept. Disconnecting, a 401 or a new connect deletes `liveHistory`, `liveQueue` and `liveSendState`.

### Manual check

1. Build with `TRIPLEKEEL_API_BASE` set, load `dist/` with **Load unpacked**, connect, and make sure the popup shows your track. Reload any claude.ai or chatgpt.com tabs that were already open.
2. On claude.ai, send 5 product prompts, like "Write a PRD for a checkout page for busy parents". Then send 5 on chatgpt.com.
3. The 10th prompt sends the batch. With fewer, wait 3 minutes with the tab open, or open the popup after 3 minutes.
4. Your levels on `/dashboard` should change.
5. To see the requests, open the service worker's DevTools from `chrome://extensions` (**Inspect views: service worker**) and look at the Network tab. Each `/api/signals` body has `reports` only, with `source: "live"`, and no prompt text.
6. Send a personal prompt, like one about "my doctor". It isn't scored, sent or kept.
7. In the service worker's console, run `chrome.storage.local.set({ settings: { paused: true, sites: { claude: true, chatgpt: true } } })`. New prompts aren't captured. Set `paused: false` to turn it back on.

## Privacy notice

The popup's **Privacy** link opens `/privacy` on the web app (`APP_URL`). The page is public, so it works signed out. For the Chrome Web Store listing, the privacy policy URL is https://triplekeel.rei.dev/privacy.

## Permissions

Host permissions are `claude.ai` and `chatgpt.com` only. The build fails if the manifest lists any other host. The content script uses the site adapters from the REI-246 spike. Live capture needs no new permission: it uses `storage`, which the extension already has, and no `alarms`.
