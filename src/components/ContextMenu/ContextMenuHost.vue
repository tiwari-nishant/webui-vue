<template>
  <!-- Single right-click context menu for the authenticated app -->
  <context-menu
    ref="contextMenuRef"
    :items="items"
    :footer="$t('global.contextMenu.nativeMenuHint')"
    @action="onAction"
  />

  <!-- Screenshot preview modal -->
  <BModal
    v-model="screenshotModalOpen"
    :title="$t('global.contextMenu.screenshotTitle')"
    ok-only
    :ok-title="$t('global.contextMenu.screenshotDownload')"
    size="xl"
    @ok="downloadScreenshot"
  >
    <img
      v-if="screenshotDataUrl"
      :src="screenshotDataUrl"
      alt="Page screenshot"
      style="width: 100%; height: auto"
    />
  </BModal>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ContextMenu from '@/components/Global/ContextMenu.vue';
import useToastComposable from '@/components/Composables/useToastComposable';
import { getCommonItems, commonActions } from './commonItems';
import { getHeaderItems, headerActions } from './headerItems';
import { mergeWithPageItems, getPageHandler } from './contextMenuRegistry';

// Right-clicks inside these areas keep the native browser menu
const NATIVE_MENU_SELECTOR = '.app-navigation';
const HEADER_SELECTOR = '.app-header';

const { t } = useI18n();
const route = useRoute();
const toast = useToastComposable();

const contextMenuRef = ref(null);
const zone = ref('page');
const openCount = ref(0);
const screenshotModalOpen = ref(false);
const screenshotDataUrl = ref(null);
// Text selected when the menu was opened. Copy is offered only if not empty.
const selectedText = ref('');
// Link under the cursor when the menu was opened, if any.
const linkEl = ref(null);

// Closest real link under the target. javascript: links are not offered.
const getLink = (target) => {
  const a = target.closest?.('a[href]');
  return a && a.protocol !== 'javascript:' ? a : null;
};
const isWebLink = (a) => a.protocol === 'http:' || a.protocol === 'https:';

// Browsers do not let a page open a private/incognito window, so there is
// no "Open link in private window" item.
const getLinkItems = () => {
  const a = linkEl.value;
  if (!a) return [];
  const web = isWebLink(a);
  return [
    ...(web
      ? [
          { key: 'openLink', label: t('global.contextMenu.openLink') },
          {
            key: 'openLinkNewTab',
            label: t('global.contextMenu.openLinkNewTab'),
          },
          {
            key: 'openLinkNewWindow',
            label: t('global.contextMenu.openLinkNewWindow'),
          },
        ]
      : []),
    { key: 'copyLink', label: t('global.contextMenu.copyLinkAddress') },
    { divider: true, key: 'div-link' },
  ];
};

// Text selected on the page, including inside inputs and textareas, which
// window.getSelection() does not report. Password fields are never copied.
const getSelectedText = () => {
  const el = document.activeElement;
  if (el?.matches?.('input, textarea') && el.type !== 'password') {
    try {
      const { selectionStart: start, selectionEnd: end } = el;
      if (start !== null && start !== end) return el.value.slice(start, end);
    } catch {
      // Input types such as number or email do not expose a selection range
    }
  }
  return window.getSelection()?.toString() ?? '';
};

// openCount forces a recompute on every open, so non-reactive state such as
// window.history.length is read fresh.
const items = computed(() => {
  openCount.value;
  const list =
    zone.value === 'header'
      ? getHeaderItems()
      : mergeWithPageItems(getCommonItems());
  return [
    ...getLinkItems(),
    ...(selectedText.value
      ? [
          { key: 'copy', label: t('global.contextMenu.copy') },
          { divider: true, key: 'div-copy' },
        ]
      : []),
    ...list,
  ];
});

const onContextMenu = (event) => {
  if (event.target.closest?.(NATIVE_MENU_SELECTOR)) return;
  zone.value = event.target.closest?.(HEADER_SELECTOR) ? 'header' : 'page';
  // A route can opt out with `meta: { customContextMenu: false }` (see
  // router/routes.js) to keep the native browser menu in the page area.
  if (zone.value === 'page' && route.meta?.customContextMenu === false) return;
  selectedText.value = getSelectedText();
  linkEl.value = getLink(event.target);
  openCount.value++;
  event.preventDefault();
  contextMenuRef.value?.open(event, getKeyboardPosition(event));
};

// Shift+F10 / the Context Menu key fire `contextmenu` too, but some browsers
// report 0,0 for them. Anchor the menu to the focused element instead.
const getKeyboardPosition = (event) => {
  if (event.clientX !== 0 || event.clientY !== 0) return undefined;
  const el = document.activeElement;
  if (!el || el === document.body) return undefined;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + 8, y: rect.bottom };
};

onMounted(() => document.addEventListener('contextmenu', onContextMenu));
onBeforeUnmount(() =>
  document.removeEventListener('contextmenu', onContextMenu),
);

// Clipboard API needs a secure context (https); fall back to execCommand.
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Not available or denied: use the legacy path below
  }
  const previous = document.activeElement;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } finally {
    area.remove();
    previous?.focus?.({ preventScroll: true });
  }
};

const onAction = async (key) => {
  if (key === 'copy') {
    await copyText(selectedText.value);
    return;
  }
  if (key.startsWith('openLink') || key === 'copyLink') {
    onLinkAction(key);
    return;
  }
  if (key === 'screenshot' && !getPageHandler(key)) {
    await captureScreenshot();
    return;
  }
  const handler =
    zone.value === 'header'
      ? (headerActions[key] ?? commonActions[key])
      : (getPageHandler(key) ?? commonActions[key]);
  await handler?.();
};

const onLinkAction = (key) => {
  const a = linkEl.value;
  if (!a) return;
  const href = a.href;
  switch (key) {
    case 'openLink':
      // Click the anchor itself so router-links navigate without a reload
      a.click();
      break;
    case 'openLinkNewTab':
      window.open(href, '_blank', 'noopener,noreferrer');
      break;
    case 'openLinkNewWindow':
      // Window features make the browser open a separate window, not a tab
      window.open(
        href,
        '_blank',
        `noopener,noreferrer,popup=yes,width=${window.outerWidth},height=${window.outerHeight}`,
      );
      break;
    case 'copyLink':
      copyText(href);
      break;
  }
};

const captureScreenshot = async () => {
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      ignoreElements: (element) =>
        element.classList?.contains('context-menu') ||
        element.closest?.('.context-menu') ||
        element.hasAttribute?.('data-html2canvas-ignore'),
    });
    screenshotDataUrl.value = canvas.toDataURL('image/png');
    screenshotModalOpen.value = true;
  } catch {
    toast.infoToast(t('global.contextMenu.screenshotUnavailable'));
  }
};

const downloadScreenshot = () => {
  if (!screenshotDataUrl.value) return;
  const a = document.createElement('a');
  a.href = screenshotDataUrl.value;
  a.download = `${String(route.name || 'page')}-screenshot-${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/:/g, '-')}.png`;
  a.click();
};
</script>
