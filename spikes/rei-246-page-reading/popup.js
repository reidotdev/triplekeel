const status = document.querySelector("#status");
const count = document.querySelector("#count");
const messages = document.querySelector("#messages");

document.querySelector("#score").addEventListener("click", async () => {
  status.textContent = "Reading this page…";
  count.textContent = "";
  messages.replaceChildren();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (
    !tab?.id ||
    !/^https:\/\/(claude\.ai|chatgpt\.com)\//.test(tab.url || "")
  ) {
    status.textContent = "Open a Claude or ChatGPT conversation first.";
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "get-user-messages" }, (result) => {
    if (chrome.runtime.lastError || !result) {
      status.textContent =
        "The reader is unavailable. Reload the conversation tab.";
      return;
    }
    if (!result.isConversationPage) {
      status.textContent = "This page does not look like a conversation.";
      return;
    }
    status.textContent =
      result.warning || "Read from the open page. Nothing was sent.";
    count.textContent = `Found ${result.messages.length} user message${result.messages.length === 1 ? "" : "s"}.`;
    for (const [index, message] of result.messages.entries()) {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${message.slice(0, 80)}`;
      messages.append(item);
    }
  });
});
