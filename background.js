// Clicking the toolbar button opens the editor in a full tab.
//
// A popup is the wrong shape: it closes the moment focus moves, and picking
// a file moves focus. The editor needs a tab that stays open.

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("editor.html");
  try {
    const open = await chrome.tabs.query({ url });
    if (open.length && open[0].id != null) {
      await chrome.tabs.update(open[0].id, { active: true });
      if (open[0].windowId != null) {
        await chrome.windows.update(open[0].windowId, { focused: true });
      }
      return;
    }
  } catch (err) {
    // Missing permission or query filter failed — still open a tab.
    console.warn("md-in-chrome: tabs.query failed, opening new tab", err);
  }
  try {
    await chrome.tabs.create({ url });
  } catch (err) {
    console.error("md-in-chrome: could not open editor", err);
  }
});
