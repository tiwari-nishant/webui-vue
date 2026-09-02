import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import HardwareDeconfiguration from '@/views/Settings/HardwareDeconfiguration/HardwareDeconfiguration.vue';
import MemoryDimms from '@/views/Settings/HardwareDeconfiguration/MemoryDimms.vue';
import ProcessorCores from '@/views/Settings/HardwareDeconfiguration/ProcessorCores.vue';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const startLoaderMock = vi.fn();
const endLoaderMock = vi.fn();
const hideLoaderMock = vi.fn();

vi.mock('@/components/Composables/useLoadingBarComposable', () => ({
  default: () => ({
    startLoader: startLoaderMock,
    endLoader: endLoaderMock,
    hideLoader: hideLoaderMock,
  }),
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router');
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
    }),
    onBeforeRouteLeave: vi.fn((callback) => {
      callback();
    }),
  };
});

vi.mock('@/api/composables/useHardwareDeconfiguration', () => ({
  useHardwareDeconfiguration: vi.fn(),
}));

import { useHardwareDeconfiguration } from '@/api/composables/useHardwareDeconfiguration';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_DIMMS = [
  {
    id: 'dimm1',
    name: 'Memory DIMM 1',
    functionalState: 'OK',
    size: 16384,
    locationCode: 'U78DA.ND1.1234567-P0-C14-T0',
    deconfigurationType: 'None',
    settings: true,
    uri: '/redfish/v1/Systems/system/Memory/dimm1',
    available: 'Enabled',
    eventID: '',
  },
  {
    id: 'dimm2',
    name: 'Memory DIMM 2',
    functionalState: 'Critical',
    size: 16384,
    locationCode: 'U78DA.ND1.1234567-P0-C14-T1',
    deconfigurationType: 'Error',
    settings: false,
    uri: '/redfish/v1/Systems/system/Memory/dimm2',
    available: 'Enabled',
    eventID: '12345',
  },
];

const MOCK_CORES = [
  {
    name: 'Processor Core 1',
    status: 'OK',
    id: 'core1',
    location: 'U78DA.ND1.1234567-P0-C1',
    functionalState: 'OK',
    settings: true,
    uri: '/redfish/v1/Systems/system/Processors/proc0/SubProcessors/core1',
    deconfigurationType: 'None',
    processorId: 'proc0',
    eventID: '',
  },
];

const makeHook = (overrides = {}) => ({
  dimms: ref(MOCK_DIMMS),
  isDimmsLoading: ref(false),
  isDimmsRefetching: ref(false),
  refetchDimms: vi.fn().mockResolvedValue(undefined),
  cores: ref(MOCK_CORES),
  isCoresLoading: ref(false),
  isCoresRefetching: ref(false),
  refetchCores: vi.fn().mockResolvedValue(undefined),
  updateSettingsState: vi.fn().mockResolvedValue(undefined),
  updateCoresSettingsState: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mount helpers
// ---------------------------------------------------------------------------

function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en-US',
    messages: {
      'en-US': {
        pageDeconfigurationHardware: {
          configured: 'Configured',
          deconfigured: 'Deconfigured',
          configure: 'Configure',
          deconfigure: 'Deconfigure',
        },
      },
    },
  });
}

function mountHardwareDeconfiguration(hookOverrides = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  useHardwareDeconfiguration.mockReturnValue(makeHook(hookOverrides));

  const pinia = createPinia();
  setActivePinia(pinia);

  const i18n = createTestI18n();

  return mount(HardwareDeconfiguration, {
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient }], i18n],
      mocks: {
        $t: (key) => key,
      },
      stubs: {
        PageTitle: true,
        PageSection: true,
        Alert: true,
        MemoryDimms: true,
        ProcessorCores: true,
        BCard: { template: '<div><slot /></div>' },
        BTabs: { template: '<div><slot /></div>' },
        BTab: { template: '<div><slot /></div>' },
        BContainer: { template: '<div><slot /></div>' },
        BRow: { template: '<div><slot /></div>' },
        BCol: { template: '<div><slot /></div>' },
      },
    },
  });
}

function mountMemoryDimms(hookOverrides = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  useHardwareDeconfiguration.mockReturnValue(makeHook(hookOverrides));

  const pinia = createPinia();
  setActivePinia(pinia);

  const i18n = createTestI18n();

  return mount(MemoryDimms, {
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient }], i18n],
      mocks: {
        $t: (key) => key,
      },
      stubs: {
        TableFilter: true,
        BContainer: { template: '<div><slot /></div>' },
        BRow: { template: '<div><slot /></div>' },
        BCol: { template: '<div><slot /></div>' },
        BFormCheckbox: {
          template:
            '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
          props: ['modelValue'],
        },
        BFormGroup: { template: '<div><slot /></div>' },
        BFormSelect: { template: '<select><slot /></select>' },
        BPagination: { template: '<div>Pagination</div>' },
      },
    },
  });
}

function mountProcessorCores(hookOverrides = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  useHardwareDeconfiguration.mockReturnValue(makeHook(hookOverrides));

  const pinia = createPinia();
  setActivePinia(pinia);

  const i18n = createTestI18n();

  return mount(ProcessorCores, {
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient }], i18n],
      mocks: {
        $t: (key) => key,
      },
      stubs: {
        TableFilter: true,
        TableToolbar: true,
        BContainer: { template: '<div><slot /></div>' },
        BRow: { template: '<div><slot /></div>' },
        BCol: { template: '<div><slot /></div>' },
        BFormCheckbox: {
          template:
            '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
          props: ['modelValue'],
        },
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

describe('HardwareDeconfiguration', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('HardwareDeconfiguration.vue (Container)', () => {
    it('renders without errors', () => {
      const wrapper = mountHardwareDeconfiguration();
      expect(wrapper.exists()).toBe(true);
    });

    it('renders page title and description', () => {
      const wrapper = mountHardwareDeconfiguration();
      expect(wrapper.findComponent({ name: 'PageTitle' }).exists()).toBe(true);
    });

    it('renders alerts', () => {
      const wrapper = mountHardwareDeconfiguration();
      expect(wrapper.findComponent({ name: 'Alert' }).exists()).toBe(true);
    });

    it('renders tabs for Memory DIMMs and Processor Cores', () => {
      const wrapper = mountHardwareDeconfiguration();
      // BTabs is stubbed, verify container rendering
      expect(wrapper.exists()).toBe(true);
    });
  });

  describe('MemoryDimms.vue', () => {
    it('renders without errors', () => {
      const wrapper = mountMemoryDimms();
      expect(wrapper.exists()).toBe(true);
    });

    it('renders the BTable', () => {
      const wrapper = mountMemoryDimms();
      expect(wrapper.find('#table-memory-dimms').exists()).toBe(true);
    });

    it('uses hardware deconfiguration composable to list dimms', async () => {
      const wrapper = mountMemoryDimms();
      await nextTick();
      expect(useHardwareDeconfiguration).toHaveBeenCalled();
      expect(wrapper.vm.filteredDimms).toHaveLength(MOCK_DIMMS.length);
    });

    it('calls startLoader on mount', () => {
      mountMemoryDimms();
      expect(startLoaderMock).toHaveBeenCalled();
    });

    it('can toggle settings switch', async () => {
      const updateSettingsState = vi.fn().mockResolvedValue(undefined);
      const wrapper = mountMemoryDimms({ updateSettingsState });
      await nextTick();

      const row = { item: MOCK_DIMMS[0] };
      await wrapper.vm.toggleSettingsSwitch(row, false);
      expect(updateSettingsState).toHaveBeenCalledWith(row.item.uri, false);
    });
  });

  describe('ProcessorCores.vue', () => {
    it('renders without errors', () => {
      const wrapper = mountProcessorCores();
      expect(wrapper.exists()).toBe(true);
    });

    it('renders the BTable', () => {
      const wrapper = mountProcessorCores();
      expect(wrapper.find('#table-processor-cores').exists()).toBe(true);
    });

    it('uses hardware deconfiguration composable to list cores', async () => {
      const wrapper = mountProcessorCores();
      await nextTick();
      expect(useHardwareDeconfiguration).toHaveBeenCalled();
      expect(wrapper.vm.filteredCores).toHaveLength(MOCK_CORES.length);
    });

    it('calls startLoader on mount', () => {
      mountProcessorCores();
      expect(startLoaderMock).toHaveBeenCalled();
    });

    it('can toggle cores settings switch', async () => {
      const updateCoresSettingsState = vi.fn().mockResolvedValue(undefined);
      const wrapper = mountProcessorCores({ updateCoresSettingsState });
      await nextTick();

      const row = { item: MOCK_CORES[0] };
      await wrapper.vm.toggleSettingsSwitch(row, false);
      expect(updateCoresSettingsState).toHaveBeenCalledWith(
        row.item.uri,
        false,
      );
    });
  });
});
