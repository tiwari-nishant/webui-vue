import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import PcieTopology from '@/views/HardwareStatus/PcieTopology/PcieTopology.vue';

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

// Mock store modules to avoid real pinia store actions
const mockGlobalStore = {
  getBootProgress: vi.fn().mockResolvedValue(undefined),
  isInPhypStandby: true,
  isServiceUser: true,
};

const mockPcieTopologyStore = {
  entriesGetter: [
    {
      id: 'link-1',
      resetLinkAvailable: true,
      resetLinkUri: '/redfish/v1/Systems/system/Reset',
      parentId: 'root',
      linkStatus: 'Operational',
      localPortLocation: ['Port 1'],
      remotePortLocation: ['Port 2'],
      linkPropertiesSpeed: '16 GT/s',
      linkPropertiesWidth: 'x16',
      linkPropertiesType: 'PCIe',
      pcieBridge: 'Bridge 1',
      cableLength: '1m',
      cablePartNumber: ['PN12345'],
      cableStatus: 'OK',
      cableType: 'Copper',
      ioSlots: [],
    },
  ],
  refreshPage: vi.fn().mockResolvedValue(undefined),
  getTopologyScreen: vi.fn().mockResolvedValue(undefined),
  savePcie: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/store', () => ({
  default: {
    GlobalStore: () => mockGlobalStore,
    PcieTopologyStore: () => mockPcieTopologyStore,
  },
}));

// Mock usePcieTopology so entries comes from mockPcieTopologyStore
vi.mock('@/api/composables/usePcieTopology', () => ({
  usePcieTopology: () => ({
    entries: ref(mockPcieTopologyStore.entriesGetter),
    refreshTopology: mockPcieTopologyStore.refreshPage,
    saveTopology: mockPcieTopologyStore.savePcie,
  }),
}));

// ---------------------------------------------------------------------------
// Mount helper
// ---------------------------------------------------------------------------

function mountPcieTopology() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const pinia = createPinia();
  setActivePinia(pinia);

  const i18n = createI18n({
    legacy: false,
    locale: 'en-US',
    messages: {
      'en-US': {
        pagePcieTopology: {
          id: 'ID',
          parentId: 'Parent ID',
          linkStatus: 'Link Status',
          localPortLocation: 'Local Port Location',
          remotePortLocation: 'Remote Port Location',
        },
      },
    },
  });

  return mount(PcieTopology, {
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient }], i18n],
      mocks: {
        $t: (key) => key,
      },
      stubs: {
        PageTitle: true,
        Search: true,
        TableCellCount: true,
        TableFilter: true,
        ModalReset: true,
        ModalLeds: true,
        BContainer: { template: '<div><slot /></div>' },
        BRow: { template: '<div><slot /></div>' },
        BCol: { template: '<div><slot /></div>' },
        BButton: { template: '<button><slot /></button>' },
        BFormGroup: { template: '<div><slot /></div>' },
        BFormSelect: { template: '<select><slot /></select>' },
        BPagination: { template: '<div>Pagination</div>' },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PcieTopology.vue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without errors', () => {
    const wrapper = mountPcieTopology();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders page title', () => {
    const wrapper = mountPcieTopology();
    expect(wrapper.findComponent({ name: 'PageTitle' }).exists()).toBe(true);
  });

  it('renders search input component', () => {
    const wrapper = mountPcieTopology();
    expect(wrapper.findComponent({ name: 'Search' }).exists()).toBe(true);
  });

  it('renders the PCIe topology table', () => {
    const wrapper = mountPcieTopology();
    expect(wrapper.find('#table-pcie-topology').exists()).toBe(true);
  });

  it('populates filteredEntries from the store', async () => {
    const wrapper = mountPcieTopology();
    await nextTick();
    expect(wrapper.vm.filteredEntries).toHaveLength(1);
    expect(wrapper.vm.filteredEntries[0].id).toBe('link-1');
  });

  it('client-side pagination is initialized', async () => {
    const wrapper = mountPcieTopology();
    await nextTick();
    expect(wrapper.vm.pagination).toBeDefined();
    expect(wrapper.vm.pagination.paginatedData.value).toHaveLength(1);
  });

  it('triggers startLoader on mount if in phyp standby', async () => {
    mountPcieTopology();
    await flushPromises();
    expect(startLoaderMock).toHaveBeenCalled();
  });
});
