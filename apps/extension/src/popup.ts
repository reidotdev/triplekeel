import { API_BASE, APP_URL } from "./config.js";
import { popupView } from "./popup-view.js";
import { readState, refresh, type SessionState } from "./session.js";

const deps = {
  apiBase: API_BASE,
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  store: chrome.storage.local,
};
const hasServer = Boolean(API_BASE && APP_URL);

function element(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function setText(id: string, text: string | null) {
  const node = element(id);
  node.textContent = text ?? "";
  node.hidden = text === null;
}

function render(state: SessionState) {
  const view = popupView(state, hasServer);
  setText("status", view.status);
  setText("track", view.track);
  setText("note", view.note);
  element("connect").hidden = !view.showConnect;
  element("devices").hidden = !view.showDevices;
}

function openAppPage(path: string) {
  void chrome.tabs.create({ url: `${APP_URL}${path}` });
  window.close();
}

element("connect").addEventListener("click", () => openAppPage("/connect"));
element("devices").addEventListener("click", (event) => {
  event.preventDefault();
  openAppPage("/settings/devices");
});

// Show the saved state first, then check it with the server. A revoked
// device gets a 401 here and the popup goes back to "Not connected".
async function main() {
  const cached = await readState(deps.store);
  render(cached);
  if (hasServer && cached.connected) render(await refresh(deps));
}

void main();
