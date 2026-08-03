/* global browser */
'use strict';

// Minimal background script — message routing is handled in popup.js via
// browser.runtime.onMessage. This file exists so the manifest "background"
// entry is satisfied and the extension can wake up as needed.
browser.runtime.onInstalled.addListener(() => {
  console.log('[A11y Scanner] Extension installed.');
});
