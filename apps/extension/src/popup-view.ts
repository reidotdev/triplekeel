import type { SessionState } from "./session.js";

export type PopupView = {
  status: string;
  track: string | null;
  note: string | null;
  showConnect: boolean;
  showDevices: boolean;
};

/** Turns the session state into the popup's text. */
export function popupView(state: SessionState, hasServer: boolean): PopupView {
  if (!hasServer) {
    return {
      status: "This build has no server address.",
      track: null,
      note: "Build it again with TRIPLEKEEL_API_BASE set.",
      showConnect: false,
      showDevices: false,
    };
  }
  if (!state.connected) {
    return {
      status: "Not connected.",
      track: null,
      note: "Connect to link this browser to your account.",
      showConnect: true,
      showDevices: false,
    };
  }
  const email = state.me?.email;
  const trackName = state.me?.track?.name;
  return {
    status: email ? `Connected as ${email}` : "Connected",
    track: state.me
      ? trackName
        ? `Track: ${trackName}`
        : "Track: not chosen yet"
      : null,
    note: state.stale ? "Can't reach TripleKeel. Showing saved info." : null,
    showConnect: false,
    showDevices: true,
  };
}
