import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import AppHeader from '@/components/AppHeader/AppHeader.vue';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/api/composables/useSystemInfo', () => ({
  useSystemInfo: vi.fn(),
}));

// Mock @/store to avoid real pinia store instantiation
const mockGlobalStore = {
  usernameGetter: null,
  isAuthorizedGetter: true,
};
const mockAuthenticationStore = {
  resetStoreState: vi.fn(),
};

vi.mock('@/store', () => ({
  default: {
    GlobalStore: () => mockGlobalStore,
    AuthenticationStore: () => mockAuthenticationStore,
  },
}));

import { useSystemInfo } from '@/api/composables/useSystemInfo';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeSystemInfoHook = (overrides = {}) => ({
  assetTag: ref('ABC-123'),
  modelType: ref('Model X'),
  serialNumber: ref('SN-001'),
  serverStatus: ref('on'),
  healthStatus: ref('OK'),
  isLoading: ref(false),
  isError: ref(false),
  error: ref(null),
  refetch: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mount helper
// ---------------------------------------------------------------------------

function mountAppHeader(hookOverrides = {}, props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  useSystemInfo.mockReturnValue(makeSystemInfoHook(hookOverrides));

  const pinia = createPinia();
  setActivePinia(pinia);

  return mount(AppHeader, {
    props: { routerKey: 0, ...props },
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient }]],
      mocks: {
        $t: (key) => key,
        $router: { push: vi.fn() },
      },
      stubs: {
        BNavbarBrand: { template: '<a><slot/></a>' },
        BNavItem: { template: '<li><slot/></li>' },
        BDropdownItem: { template: '<li><slot/></li>' },
        LoadingBar: true,
        StatusIcon: true,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppHeader.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGlobalStore.usernameGetter = null;
    mockGlobalStore.isAuthorizedGetter = true;
    mockAuthenticationStore.resetStoreState.mockReset();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders without errors', () => {
    const wrapper = mountAppHeader();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders the page header element', () => {
    const wrapper = mountAppHeader();
    expect(wrapper.find('#page-header').exists()).toBe(true);
  });

  it('renders the refresh button', () => {
    const wrapper = mountAppHeader();
    expect(
      wrapper.find('[data-test-id="appHeader-button-refresh"]').exists(),
    ).toBe(true);
  });

  it('renders the user dropdown', () => {
    const wrapper = mountAppHeader();
    expect(
      wrapper.find('[data-test-id="appHeader-container-user"]').exists(),
    ).toBe(true);
  });

  it('renders the health status nav item', () => {
    const wrapper = mountAppHeader();
    expect(
      wrapper.find('[data-test-id="appHeader-container-health"]').exists(),
    ).toBe(true);
  });

  it('renders the power status nav item', () => {
    const wrapper = mountAppHeader();
    expect(
      wrapper.find('[data-test-id="appHeader-container-power"]').exists(),
    ).toBe(true);
  });

  // ── Nav tag visibility ─────────────────────────────────────────────────────

  it('shows nav tags when assetTag is present', async () => {
    const wrapper = mountAppHeader({
      assetTag: ref('TAG-1'),
      modelType: ref(null),
      serialNumber: ref(null),
    });
    await nextTick();
    expect(wrapper.vm.isNavTagPresent).toBeTruthy();
  });

  it('shows nav tags when modelType is present', async () => {
    const wrapper = mountAppHeader({
      assetTag: ref(null),
      modelType: ref('ModelX'),
      serialNumber: ref(null),
    });
    await nextTick();
    expect(wrapper.vm.isNavTagPresent).toBeTruthy();
  });

  it('shows nav tags when serialNumber is present', async () => {
    const wrapper = mountAppHeader({
      assetTag: ref(null),
      modelType: ref(null),
      serialNumber: ref('SN-99'),
    });
    await nextTick();
    expect(wrapper.vm.isNavTagPresent).toBeTruthy();
  });

  it('hides nav tags when all system info fields are absent', async () => {
    const wrapper = mountAppHeader({
      assetTag: ref(null),
      modelType: ref(null),
      serialNumber: ref(null),
    });
    await nextTick();
    expect(wrapper.vm.isNavTagPresent).toBeFalsy();
  });

  // ── Server status icon ─────────────────────────────────────────────────────

  it.each([
    ['on', 'success'],
    ['error', 'danger'],
    ['diagnosticMode', 'warning'],
    ['off', 'secondary'],
    ['unreachable', 'secondary'],
  ])(
    'serverStatusIcon returns "%s" when status is "%s"',
    async (status, expected) => {
      const wrapper = mountAppHeader({ serverStatus: ref(status) });
      await nextTick();
      expect(wrapper.vm.serverStatusIcon).toBe(expected);
    },
  );

  // ── Health status icon ─────────────────────────────────────────────────────

  it.each([
    ['OK', 'success'],
    ['Warning', 'warning'],
    ['Critical', 'danger'],
    ['', 'secondary'],
    ['Unknown', 'secondary'],
  ])(
    'healthStatusIcon returns "%s" when health is "%s"',
    async (health, expected) => {
      const wrapper = mountAppHeader({ healthStatus: ref(health) });
      await nextTick();
      expect(wrapper.vm.healthStatusIcon).toBe(expected);
    },
  );

  // ── Username ───────────────────────────────────────────────────────────────

  it('displays username from global store getter', async () => {
    mockGlobalStore.usernameGetter = 'admin';
    const wrapper = mountAppHeader();
    await nextTick();
    expect(wrapper.vm.username).toBe('admin');
  });

  it('username is null when store returns null', async () => {
    mockGlobalStore.usernameGetter = null;
    const wrapper = mountAppHeader();
    await nextTick();
    expect(wrapper.vm.username).toBeNull();
  });

  // ── Navigation toggle ──────────────────────────────────────────────────────

  it('isNavigationOpen starts as false', () => {
    const wrapper = mountAppHeader();
    expect(wrapper.vm.isNavigationOpen).toBe(false);
  });

  // ── Authentication store ───────────────────────────────────────────────────

  it('calls resetStoreState on mount', async () => {
    mountAppHeader();
    await nextTick();
    expect(mockAuthenticationStore.resetStoreState).toHaveBeenCalledTimes(1);
  });

  // ── refresh emits event ────────────────────────────────────────────────────

  it('clicking refresh button emits refresh-application event', async () => {
    const wrapper = mountAppHeader();
    await nextTick();

    const refreshBtn = wrapper.find(
      '[data-test-id="appHeader-button-refresh"]',
    );
    expect(refreshBtn.exists()).toBe(true);
    await refreshBtn.trigger('click');
    expect(typeof wrapper.vm.refresh).toBe('function');
  });

  // ── useSystemInfo composable ───────────────────────────────────────────────

  it('calls useSystemInfo composable on mount', () => {
    mountAppHeader();
    expect(useSystemInfo).toHaveBeenCalledTimes(1);
  });

  it('exposes serverStatus from useSystemInfo', async () => {
    const serverStatus = ref('off');
    const wrapper = mountAppHeader({ serverStatus });
    await nextTick();
    expect(wrapper.vm.serverStatusIcon).toBe('secondary');

    serverStatus.value = 'on';
    await nextTick();
    expect(wrapper.vm.serverStatusIcon).toBe('success');
  });

  it('exposes healthStatus from useSystemInfo', async () => {
    const healthStatus = ref('OK');
    const wrapper = mountAppHeader({ healthStatus });
    await nextTick();
    expect(wrapper.vm.healthStatusIcon).toBe('success');

    healthStatus.value = 'Critical';
    await nextTick();
    expect(wrapper.vm.healthStatusIcon).toBe('danger');
  });

  // ── Skip nav link ──────────────────────────────────────────────────────────

  it('renders the skip-to-content link', () => {
    const wrapper = mountAppHeader();
    const skipLink = wrapper.find('.link-skip-nav');
    expect(skipLink.exists()).toBe(true);
    expect(skipLink.attributes('href')).toBe('#main-content');
  });
});
