// Clicking the toolbar button opens the editor in a full tab.
//
// A popup is the obvious thing and the wrong one: it closes the moment focus
// moves, and picking a file moves focus. The editor needs a tab that stays.

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("editor.html");
  const open = await chrome.tabs.query({ url });
  if (open.length) {
    chrome.tabs.update(open[0].id, { active: true });
    chrome.windows.update(open[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url });
  }
});
