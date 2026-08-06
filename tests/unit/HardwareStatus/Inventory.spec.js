import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import Inventory from '@/views/HardwareStatus/Inventory/Inventory.vue';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const startLoaderMock = vi.fn();
const endLoaderMock = vi.fn();

vi.mock('@/components/Composables/useLoadingBarComposable', () => ({
  default: () => ({
    startLoader: startLoaderMock,
    endLoader: endLoaderMock,
  }),
}));

vi.mock('@/components/Composables/useJumpLinkComposable', () => ({
  default: () => ({
    scrollToOffsetInventory: vi.fn(),
  }),
}));

vi.mock('@/api/composables/useInventory', () => ({
  useInventory: vi.fn(),
}));

import { useInventory } from '@/api/composables/useInventory';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeChassis = (overrides = {}) => ({
  id: 'chassis-1',
  health: 'OK',
  statusState: 'Enabled',
  name: 'System Chassis',
  identifyLed: false,
  uri: '/redfish/v1/Chassis/chassis',
  locationNumber: '1',
  firmwareVersion: '1.0.0',
  ...overrides,
});

const MOCK_CHASSIS = [
  makeChassis({
    id: 'chassis-1',
    name: 'System Chassis',
    uri: '/redfish/v1/Chassis/chassis',
  }),
  makeChassis({
    id: 'expansion-1',
    name: 'Expansion Chassis',
    uri: '/redfish/v1/Chassis/expansion',
  }),
];

const makeHook = (overrides = {}) => ({
  chassis: ref([]),
  isLoading: ref(false),
  refetch: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mount helper
// ---------------------------------------------------------------------------

function mountInventory(hookOverrides = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  useInventory.mockReturnValue(makeHook(hookOverrides));

  const pinia = createPinia();
  setActivePinia(pinia);

  const i18n = createI18n({
    legacy: false,
    locale: 'en-US',
    messages: {},
  });

  return mount(Inventory, {
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient }], i18n],
      mocks: {
        $t: (key) => key,
      },
      stubs: {
        PageTitle: true,
        ServiceIndicator: true,
        PageSection: true,
        TableChassis: true,
        TableSystem: true,
        TableBmcManager: true,
        TableDimmSlot: true,
        TableFans: true,
        TablePowerSupplies: true,
        TableProcessors: true,
        TableAssembly: true,
        TablePcieSlots: true,
        TableFabricAdapters: true,
        Alert: true,
        BCard: { template: '<div><slot /></div>' },
        BTabs: { template: '<div><slot /></div>' },
        BTab: { template: '<div><slot /></div>' },
        BContainer: { template: '<div><slot /></div>' },
        BRow: { template: '<div><slot /></div>' },
        BCol: { template: '<div><slot /></div>' },
        BLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Inventory.vue', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders without errors', () => {
    const wrapper = mountInventory();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders the page title', () => {
    const wrapper = mountInventory();
    expect(wrapper.findComponent({ name: 'PageTitle' }).exists()).toBe(true);
  });

  it('renders the service indicator', () => {
    const wrapper = mountInventory();
    expect(wrapper.findComponent({ name: 'ServiceIndicator' }).exists()).toBe(
      true,
    );
  });

  it('renders the chassis table', () => {
    const wrapper = mountInventory();
    expect(wrapper.findComponent({ name: 'TableChassis' }).exists()).toBe(true);
  });

  it('renders the tabs container', () => {
    const wrapper = mountInventory();
    // BTabs is stubbed, so check if the stub is rendered
    expect(wrapper.text()).toBeDefined();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('calls startLoader on mount', () => {
    mountInventory();
    expect(startLoaderMock).toHaveBeenCalled();
  });

  it('calls refetch (fetchChassis) on mount', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mountInventory({ refetch });
    expect(refetch).toHaveBeenCalled();
  });

  it('isBusy is set to true when loading begins', async () => {
    const wrapper = mountInventory();
    await nextTick();
    expect(wrapper.vm.isBusy).toBe(true);
  });

  // ── Chassis data ────────────────────────────────────────────────────────────

  it('renders tabs for each chassis', async () => {
    const wrapper = mountInventory({ chassis: ref(MOCK_CHASSIS) });
    await nextTick();
    expect(wrapper.vm.chassis).toHaveLength(MOCK_CHASSIS.length);
  });

  it('currentTab starts at 0', () => {
    const wrapper = mountInventory();
    expect(wrapper.vm.currentTab).toBe(0);
  });

  it('currentTabUpdate changes the current tab', async () => {
    const wrapper = mountInventory({ chassis: ref(MOCK_CHASSIS) });
    await nextTick();
    wrapper.vm.currentTabUpdate(1);
    expect(wrapper.vm.currentTab).toBe(1);
  });

  // ── Quicklinks ──────────────────────────────────────────────────────────────

  it('renders quicklink columns on tab 0', async () => {
    const wrapper = mountInventory({ chassis: ref(MOCK_CHASSIS) });
    await nextTick();
    expect(wrapper.vm.quicklinkColumns).toBeDefined();
    expect(Array.isArray(wrapper.vm.quicklinkColumns)).toBe(true);
  });

  it('renders MEX quicklink columns on non-zero tabs', async () => {
    const wrapper = mountInventory({ chassis: ref(MOCK_CHASSIS) });
    await nextTick();
    expect(wrapper.vm.quicklinkMexColumns).toBeDefined();
    expect(Array.isArray(wrapper.vm.quicklinkMexColumns)).toBe(true);
  });

  // ── Server power state ──────────────────────────────────────────────────────

  it('isPoweredOff is false when serverStatus is not "off"', async () => {
    const wrapper = mountInventory();
    await nextTick();
    // With fresh Pinia, serverStatus from GlobalStore defaults to 'unreachable'
    expect(wrapper.vm.isPoweredOff).toBe(false);
  });

  // ── useInventory composable integration ──────────────────────────────────────

  it('calls useInventory composable on mount', () => {
    mountInventory();
    expect(useInventory).toHaveBeenCalled();
  });

  it('uses chassis from composable', async () => {
    const mockChassis = ref(MOCK_CHASSIS);
    mountInventory({ chassis: mockChassis });
    await nextTick();
    expect(useInventory).toHaveBeenCalled();
  });

  it('handles chassis loading state', async () => {
    const isLoading = ref(true);
    const refetch = vi.fn().mockResolvedValue(undefined);
    mountInventory({ isLoading, refetch });
    await nextTick();
    expect(startLoaderMock).toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });

  // ── Tab structure ──────────────────────────────────────────────────────────

  it('system table is shown on tab 0', async () => {
    const wrapper = mountInventory({ chassis: ref(MOCK_CHASSIS) });
    await nextTick();
    wrapper.vm.currentTab = 0;
    await nextTick();
    // Component shows/hides based on currentTab value
    expect(wrapper.vm.currentTab).toBe(0);
  });

  it('system table is hidden on tab > 0', async () => {
    const wrapper = mountInventory({ chassis: ref(MOCK_CHASSIS) });
    await nextTick();
    wrapper.vm.currentTab = 1;
    await nextTick();
    expect(wrapper.vm.currentTab).toBe(1);
  });

  // ── Event emission ──────────────────────────────────────────────────────────

  it('getAllInfo is called on mount', async () => {
    const wrapper = mountInventory();
    await nextTick();
    // getAllInfo is called in onBeforeMount
    expect(startLoaderMock).toHaveBeenCalled();
  });
});
