/* global ace, browser */
'use strict';

// ace.js has been injected before this script runs.
// Run the accessibility check against the current page's live DOM.
// tabId is injected as a variable by the caller via executeScript so the
// sidebar can match the response even when sender.tab is unavailable.
(async () => {
  // Retrieve the tabId that was stored on the window by the injected preamble
  const tabId = window.__a11yScanTabId;
  try {
    const checker = new ace.Checker();
    const report  = await checker.check(document, ['IBM_Accessibility']);

    // Filter to only the levels we care about
    const keep = ['violation', 'potentialviolation', 'recommendation', 'potentialrecommendation', 'manual'];
    const issues = (report.results || []).filter((r) => keep.includes(r.level));

    browser.runtime.sendMessage({ type: 'a11y-results', tabId, issues });
  } catch (err) {
    browser.runtime.sendMessage({ type: 'a11y-error', tabId, error: String(err) });
  }
})();
