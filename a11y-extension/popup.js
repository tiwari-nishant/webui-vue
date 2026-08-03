/* global browser */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let scanResults = []; // [{ url, status, violations, potentialviolations, recommendations, issues }]
let scanning    = false;

// ── DOM refs ───────────────────────────────────────────────────────────────
const urlInput       = document.getElementById('url-input');
const scanBtn        = document.getElementById('scan-btn');
const clearBtn       = document.getElementById('clear-btn');
const downloadBtn    = document.getElementById('download-btn');
const progressWrap   = document.getElementById('progress-bar-wrap');
const progressBar    = document.getElementById('progress-bar');
const statusLine     = document.getElementById('status-line');
const resultsList    = document.getElementById('results-list');
const resultsPanel   = document.getElementById('results-panel');

// ── Helpers ────────────────────────────────────────────────────────────────
function setStatus(msg) {
  statusLine.textContent = msg;
  statusLine.classList.remove('hidden');
}

function setProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  progressBar.style.width = `${pct}%`;
}

function parseUrls() {
  return urlInput.value
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://')));
}

// ── Scan orchestration ─────────────────────────────────────────────────────
scanBtn.addEventListener('click', async () => {
  if (scanning) return;
  const urls = parseUrls();
  if (urls.length === 0) {
    setStatus('⚠ Enter at least one valid URL (must start with http:// or https://).');
    statusLine.classList.remove('hidden');
    return;
  }

  scanning     = true;
  scanResults  = [];
  resultsList.innerHTML = '';
  resultsPanel.classList.remove('hidden');
  progressWrap.classList.remove('hidden');
  statusLine.classList.remove('hidden');
  scanBtn.disabled  = true;
  downloadBtn.disabled = true;

  setProgress(0, urls.length);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    setStatus(`Scanning ${i + 1} / ${urls.length}: ${url}`);

    // Add a pending card immediately
    const card = addRouteCard(url, 'scanning');

    try {
      const result = await runScanInTab(url);
      const issues  = result || [];
      const summary = categorise(issues);
      updateRouteCard(card, url, 'done', summary, issues);
      scanResults.push({ url, status: 'done', ...summary, issues });
    } catch (err) {
      updateRouteCard(card, url, 'error', null, null, String(err));
      scanResults.push({ url, status: 'error', error: String(err), violations: 0, potentialviolations: 0, recommendations: 0, issues: [] });
    }

    setProgress(i + 1, urls.length);
  }

  setStatus(`✔ Scan complete — ${urls.length} page${urls.length > 1 ? 's' : ''} scanned.`);
  downloadBtn.disabled = false;
  scanning = false;
  scanBtn.disabled = false;
});

clearBtn.addEventListener('click', () => {
  urlInput.value = '';
  resultsList.innerHTML = '';
  resultsPanel.classList.add('hidden');
  progressWrap.classList.add('hidden');
  statusLine.classList.add('hidden');
  scanResults = [];
});

// ── Open a tab, inject ace.js + content script, get results ───────────────
function runScanInTab(url) {
  return new Promise((resolve, reject) => {
    let tabId;

    // Register the message listener BEFORE injecting the content script so
    // we never miss a message that arrives immediately after injection.
    // Match on tabId embedded in the message itself — sender.tab can be null
    // when the message comes from a script injected via executeScript in
    // Firefox's sidebar context.
    function onMessage(message) {
      if (message.tabId !== tabId) return;
      clearTimeout(scanTimeout);
      browser.runtime.onMessage.removeListener(onMessage);
      if (message.type === 'a11y-results') {
        resolve(message.issues);
      } else if (message.type === 'a11y-error') {
        reject(new Error(message.error));
      }
    }

    let scanTimeout;

    browser.tabs.create({ url, active: false })
      .then((tab) => {
        tabId = tab.id;
        // Start listening now, before any injection
        browser.runtime.onMessage.addListener(onMessage);
        return waitForTabLoad(tabId);
      })
      .then(() => {
        // 1. Inject ace engine
        return browser.tabs.executeScript(tabId, { file: 'ace.js' });
      })
      .then(() => {
        // 2. Stamp the tabId onto the page so content.js can read it
        return browser.tabs.executeScript(tabId, {
          code: `window.__a11yScanTabId = ${tabId};`,
        });
      })
      .then(() => {
        // 3. Arm the timeout then inject the checker
        scanTimeout = setTimeout(() => {
          browser.runtime.onMessage.removeListener(onMessage);
          reject(new Error('Scan response timed out (120 s)'));
        }, 120000);
        return browser.tabs.executeScript(tabId, { file: 'content.js' });
      })
      .catch((err) => {
        clearTimeout(scanTimeout);
        browser.runtime.onMessage.removeListener(onMessage);
        if (tabId) browser.tabs.remove(tabId).catch(() => {});
        reject(err);
      });

    // Tab cleanup is triggered inside onMessage resolve/reject
    const origResolve = resolve;
    const origReject  = reject;
    resolve = (v) => { browser.tabs.remove(tabId).catch(() => {}); origResolve(v); };
    reject  = (e) => { if (tabId) browser.tabs.remove(tabId).catch(() => {}); origReject(e); };
  });
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timed out'));
    }, 30000);

    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        // Small delay so the page JS has time to settle
        setTimeout(resolve, 2000);
      }
    }
    browser.tabs.onUpdated.addListener(listener);
  });
}

// ── Result categorisation ──────────────────────────────────────────────────
function categorise(issues) {
  return {
    violations:          issues.filter((i) => i.level === 'violation').length,
    potentialviolations: issues.filter((i) => i.level === 'potentialviolation').length,
    recommendations:     issues.filter((i) => i.level === 'recommendation' || i.level === 'potentialrecommendation' || i.level === 'manual').length,
  };
}

// ── DOM: route cards ───────────────────────────────────────────────────────
function addRouteCard(url, status) {
  const card = document.createElement('div');
  card.className = 'route-card';
  card.dataset.url = url;

  card.innerHTML = `
    <div class="route-card-header">
      <span class="chevron">▶</span>
      <span class="route-url" title="${esc(url)}">${esc(url)}</span>
      <span class="scan-status">${status === 'scanning' ? 'Scanning…' : ''}</span>
    </div>
    <div class="route-body"></div>
  `;

  card.querySelector('.route-card-header').addEventListener('click', () => toggleCard(card));
  resultsList.appendChild(card);
  return card;
}

function updateRouteCard(card, url, status, summary, issues, errorMsg) {
  const header = card.querySelector('.route-card-header');
  const body   = card.querySelector('.route-body');
  const stat   = card.querySelector('.scan-status');

  if (status === 'error') {
    stat.textContent = '✕ Error';
    stat.className   = 'scan-status error';
    body.innerHTML   = `<div class="issue-row"><span class="issue-msg">${esc(errorMsg)}</span></div>`;
    return;
  }

  stat.textContent = '✔ Done';
  stat.className   = 'scan-status done';

  // Inject badges into header
  const badgesHtml = `
    ${summary.violations > 0          ? `<span class="badge badge-violation">${summary.violations} V</span>` : ''}
    ${summary.potentialviolations > 0 ? `<span class="badge badge-potential">${summary.potentialviolations} NR</span>` : ''}
    ${summary.recommendations > 0     ? `<span class="badge badge-recommendation">${summary.recommendations} R</span>` : ''}
    ${summary.violations === 0 && summary.potentialviolations === 0 && summary.recommendations === 0
        ? `<span class="badge badge-ok">✔</span>` : ''}
  `;
  header.querySelector('.scan-status').insertAdjacentHTML('beforebegin', badgesHtml);

  // Build issues body
  const groups = [
    { key: 'violation',             label: 'Violations' },
    { key: 'potentialviolation',    label: 'Needs Review' },
    { key: 'recommendation',        label: 'Recommendations' },
    { key: 'potentialrecommendation', label: 'Recommendations' },
    { key: 'manual',                label: 'Recommendations' },
  ];

  const grouped = {
    'Violations':     issues.filter((i) => i.level === 'violation'),
    'Needs Review':   issues.filter((i) => i.level === 'potentialviolation'),
    'Recommendations': issues.filter((i) => ['recommendation', 'potentialrecommendation', 'manual'].includes(i.level)),
  };

  let html = '';
  for (const [groupName, groupIssues] of Object.entries(grouped)) {
    if (groupIssues.length === 0) continue;
    html += `<div class="issue-group-title">${groupName} (${groupIssues.length})</div>`;
    for (const issue of groupIssues) {
      html += `
        <div class="issue-row">
          <div class="issue-rule">${esc(issue.ruleId)}</div>
          <div class="issue-msg">${esc(issue.message)}</div>
          <div class="issue-snippet" title="${esc(issue.snippet)}">${esc(issue.snippet || '')}</div>
          ${issue.help ? `<div class="issue-help"><a href="${esc(issue.help)}" target="_blank" rel="noopener">View rule ↗</a></div>` : ''}
        </div>`;
    }
  }

  if (!html) {
    html = '<div class="issue-row"><span class="issue-msg">No violations, needs-review, or recommendations found.</span></div>';
  }

  body.innerHTML = html;

  // Suppress void groups variable
  void groups;
}

function toggleCard(card) {
  const body    = card.querySelector('.route-body');
  const chevron = card.querySelector('.chevron');
  const isOpen  = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  chevron.classList.toggle('open', !isOpen);
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Excel export ───────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!scanResults.length) return;

  /* global XLSX */
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ────────────────────────────────────────────────────
  const summaryRows = [
    ['URL', 'Status', 'Violations', 'Needs Review', 'Recommendations'],
    ...scanResults.map((r) => [
      r.url,
      r.status,
      r.violations ?? 0,
      r.potentialviolations ?? 0,
      r.recommendations ?? 0,
    ]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  styleHeaderRow(wsSummary, summaryRows[0].length);
  wsSummary['!cols'] = [{ wch: 55 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Sheet 2+: Per-page detail ────────────────────────────────────────────
  for (const r of scanResults) {
    if (!r.issues || r.issues.length === 0) continue;

    const sheetName = urlToSheetName(r.url);
    const rows = [
      ['Level', 'Rule ID', 'Message', 'Snippet', 'DOM Path', 'Help URL'],
      ...r.issues
        .filter((i) => ['violation', 'potentialviolation', 'recommendation', 'potentialrecommendation', 'manual'].includes(i.level))
        .map((i) => [
          levelLabel(i.level),
          i.ruleId,
          i.message,
          i.snippet || '',
          i.path?.dom || '',
          i.help || '',
        ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    styleHeaderRow(ws, rows[0].length);
    ws['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 60 }, { wch: 50 }, { wch: 40 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, `a11y-report-${timestamp()}.xlsx`);
});

function styleHeaderRow(ws, colCount) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '161616' } } };
  }
}

function levelLabel(level) {
  const map = {
    violation: 'Violation',
    potentialviolation: 'Needs Review',
    recommendation: 'Recommendation',
    potentialrecommendation: 'Recommendation',
    manual: 'Recommendation',
  };
  return map[level] || level;
}

function urlToSheetName(url) {
  // Excel sheet names: max 31 chars, no special chars
  let name = url.replace(/^https?:\/\//, '').replace(/[/?*[\]:\\]/g, '_');
  return name.length > 31 ? name.slice(name.length - 31) : name;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
