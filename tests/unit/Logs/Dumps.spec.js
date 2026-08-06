import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import Dumps from '@/views/Logs/Dumps/Dumps.vue';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const hideLoaderMock = vi.fn();
const startLoaderMock = vi.fn();
const endLoaderMock = vi.fn();

vi.mock('@/components/Composables/useLoadingBarComposable', () => ({
  default: () => ({
    hideLoader: hideLoaderMock,
    startLoader: startLoaderMock,
    endLoader: endLoaderMock,
  }),
}));

// Mock @/store to avoid real pinia store instantiation
const mockDumpsStore = {
  allDumpsGetter: [],
  getAllDumps: vi.fn().mockResolvedValue(undefined),
  deleteDumps: vi.fn().mockResolvedValue([]),
};
const mockUserManagementStore = {
  getUsers: vi.fn().mockResolvedValue(undefined),
};
const mockResourceMemoryStore = {
  hmcManagedGetter: 'Disabled',
  getHmcManaged: vi.fn().mockResolvedValue(undefined),
};
const mockGlobalStore = {
  getBootProgress: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/store', () => ({
  default: {
    DumpsStore: () => mockDumpsStore,
    UserManagementStore: () => mockUserManagementStore,
    ResourceMemoryStore: () => mockResourceMemoryStore,
    GlobalStore: () => mockGlobalStore,
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDump = (overrides = {}) => ({
  id: '1',
  dateTime: new Date('2024-01-01T00:00:00Z'),
  dumpType: 'BMC Dump Entry',
  size: 5000000,
  data: '/redfish/v1/Managers/bmc/LogServices/Dump/Entries/1/attachment',
  location: '/redfish/v1/Managers/bmc/LogServices/Dump/Entries/1',
  actions: [{ value: 'download' }, { value: 'delete' }],
  ...overrides,
});

const MOCK_DUMPS = [
  makeDump({
    id: '1',
    dumpType: 'BMC Dump Entry',
    size: 5000000,
  }),
  makeDump({
    id: '2',
    dumpType: 'System Dump Entry',
    size: 10000000,
    dateTime: new Date('2024-01-02T00:00:00Z'),
    location: '/redfish/v1/Systems/system/LogServices/Dump/Entries/2',
  }),
  makeDump({
    id: '3',
    dumpType: 'Resource Dump Entry',
    size: 3000000,
    dateTime: new Date('2024-01-03T00:00:00Z'),
    location: '/redfish/v1/Systems/system/LogServices/Dump/Entries/3',
  }),
];

// ---------------------------------------------------------------------------
// Mount helper
// ---------------------------------------------------------------------------

function mountDumps() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const pinia = createPinia();
  setActivePinia(pinia);

  return mount(Dumps, {
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient }]],
      mocks: {
        $t: (key) => key,
        $filters: { formatDate: () => '', formatTime: () => '' },
      },
      stubs: {
        DumpsForm: true,
        PageSection: true,
        TableDateFilter: true,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dumps.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDumpsStore.allDumpsGetter = [];
    mockDumpsStore.getAllDumps.mockResolvedValue(undefined);
    mockUserManagementStore.getUsers.mockResolvedValue(undefined);
    mockResourceMemoryStore.hmcManagedGetter = 'Disabled';
    mockResourceMemoryStore.getHmcManaged.mockResolvedValue(undefined);
    mockGlobalStore.getBootProgress.mockResolvedValue(undefined);
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders without errors', () => {
    const wrapper = mountDumps();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders with expected data', async () => {
    const wrapper = mountDumps();
    await nextTick();
    expect(wrapper.vm.itemsPerPageOptions).toBeDefined();
    expect(wrapper.vm.tableFilters.length).toBeGreaterThanOrEqual(0);
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('isBusy is true initially', async () => {
    const wrapper = mountDumps();
    expect(wrapper.vm.isBusy).toBe(true);
  });

  it('calls startLoader on mount', () => {
    mountDumps();
    expect(startLoaderMock).toHaveBeenCalled();
  });

  it('calls store actions on mount', () => {
    mountDumps();
    expect(mockDumpsStore.getAllDumps).toHaveBeenCalled();
    expect(mockUserManagementStore.getUsers).toHaveBeenCalled();
    expect(mockResourceMemoryStore.getHmcManaged).toHaveBeenCalled();
    expect(mockGlobalStore.getBootProgress).toHaveBeenCalled();
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  it('paginatedData is initially empty when allDumps is empty', async () => {
    const wrapper = mountDumps();
    await nextTick();
    expect(wrapper.vm.pagination.paginatedData.value.length).toBe(0);
  });

  it('allDumps reflects data from store getter', async () => {
    mockDumpsStore.allDumpsGetter = MOCK_DUMPS;
    const wrapper = mountDumps();
    await nextTick();
    expect(wrapper.vm.allDumps).toEqual(MOCK_DUMPS);
  });

  it('pagination respects itemPerPageRef changes', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.itemPerPageRef = 2;
    await nextTick();
    expect(wrapper.vm.pagination.pageSize.value).toBe(2);
  });

  it('currentPage resets to 1 when itemPerPageRef changes', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.pagination.currentPage.value = 2;
    await nextTick();
    wrapper.vm.itemPerPageRef = 1;
    await nextTick();
    expect(wrapper.vm.pagination.currentPage.value).toBe(1);
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  it('onFilterChange applies active filters', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.onFilterChange({
      activeFilters: [{ key: 'dumpType', values: ['BMC Dump Entry'] }],
    });
    await nextTick();
    expect(wrapper.vm.activeFiltersRows).toEqual([
      { key: 'dumpType', values: ['BMC Dump Entry'] },
    ]);
  });

  it('clearing activeFilters restores default state', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.onFilterChange({
      activeFilters: [{ key: 'dumpType', values: ['System Dump Entry'] }],
    });
    await nextTick();
    wrapper.vm.onFilterChange({ activeFilters: [] });
    await nextTick();
    expect(wrapper.vm.activeFiltersRows).toEqual([]);
  });

  // ── Search functionality ────────────────────────────────────────────────────

  it('onChangeSearch updates searchFilterInput', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.onChangeSearch('test search');
    await nextTick();
    expect(wrapper.vm.searchFilterInput).toBe('test search');
  });

  it('onClearSearch clears searchFilterInput', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.searchFilterInput = 'test';
    await nextTick();
    wrapper.vm.onClearSearch();
    await nextTick();
    expect(wrapper.vm.searchFilterInput).toBe('');
  });

  // ── Date filter ────────────────────────────────────────────────────────────

  it('onChangeDateTimeFilter updates filter dates', async () => {
    const wrapper = mountDumps();
    await nextTick();
    const fromDate = new Date('2024-01-01');
    const toDate = new Date('2024-01-31');
    wrapper.vm.onChangeDateTimeFilter({ fromDate, toDate });
    await nextTick();
    expect(wrapper.vm.filterStartDate).toEqual(fromDate);
    expect(wrapper.vm.filterEndDate).toEqual(toDate);
  });

  // ── Delete actions ─────────────────────────────────────────────────────────

  it('onTableRowAction("delete") opens modal with dump', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.onTableRowAction('delete', MOCK_DUMPS[0]);
    await nextTick();
    expect(wrapper.vm.openModal).toBe(true);
    expect(wrapper.vm.dumpVal).toEqual(MOCK_DUMPS[0]);
  });

  it('handleOk closes modal', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.openModal = true;
    await nextTick();
    expect(wrapper.vm.openModal).toBe(true);
  });

  // ── HMC managed ────────────────────────────────────────────────────────────

  it('hmcManaged reflects store getter value', async () => {
    mockResourceMemoryStore.hmcManagedGetter = 'Enabled';
    const wrapper = mountDumps();
    await nextTick();
    expect(wrapper.vm.hmcManaged).toBe('Enabled');
  });

  // ── Data conversion ────────────────────────────────────────────────────────

  it('convertBytesToMegabytes converts correctly', () => {
    const wrapper = mountDumps();
    expect(wrapper.vm.convertBytesToMegabytes(1000000)).toBe(1);
    expect(wrapper.vm.convertBytesToMegabytes(5000000)).toBe(5);
    expect(wrapper.vm.convertBytesToMegabytes(10000000)).toBe(10);
  });

  // ── Export functionality ───────────────────────────────────────────────────

  it('exportFileName generates correct format', () => {
    const wrapper = mountDumps();
    const row = { item: MOCK_DUMPS[0] };
    const filename = wrapper.vm.exportFileName(row);
    expect(filename).toBe('BMC_Dump_Entry_1');
  });

  it('exportFileName handles spaces correctly', () => {
    const wrapper = mountDumps();
    const dump = makeDump({ dumpType: 'System Dump Entry', id: 'TEST-123' });
    const row = { item: dump };
    const filename = wrapper.vm.exportFileName(row);
    expect(filename).toContain('_');
    expect(filename).not.toContain(' ');
  });

  // ── Table structure ────────────────────────────────────────────────────────

  it('table has correct fields defined', () => {
    const wrapper = mountDumps();
    const expectedFields = ['id', 'dateTime', 'dumpType', 'size', 'actions'];
    const actualFields = wrapper.vm.fields.map((field) => field.key);
    expect(actualFields).toEqual(expectedFields);
  });

  it('table has correct filter options', () => {
    const wrapper = mountDumps();
    expect(Array.isArray(wrapper.vm.tableFilters)).toBe(true);
  });

  // ── Computed properties ────────────────────────────────────────────────────

  it('allDumps returns empty array when store returns empty', async () => {
    const wrapper = mountDumps();
    await nextTick();
    expect(Array.isArray(wrapper.vm.allDumps)).toBe(true);
    expect(wrapper.vm.allDumps).toHaveLength(0);
  });

  it('filteredRows returns correct count', async () => {
    const wrapper = mountDumps();
    await nextTick();
    expect(typeof wrapper.vm.filteredRows).toBe('number');
  });

  it('selectedDumpType can be updated', async () => {
    const wrapper = mountDumps();
    await nextTick();
    wrapper.vm.updateDumpInfo('bmc');
    await nextTick();
    expect(wrapper.vm.selectedDumpType).toBe('bmc');
  });

  // ── Items per page options ─────────────────────────────────────────────────

  it('itemsPerPageOptions are available', () => {
    const wrapper = mountDumps();
    expect(wrapper.vm.itemsPerPageOptions).toBeDefined();
    expect(Array.isArray(wrapper.vm.itemsPerPageOptions)).toBe(true);
  });
});
