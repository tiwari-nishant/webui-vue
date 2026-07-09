import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useCapacityOnDemand } from '@/api/composables/useCapacityOnDemand';

// Mock TanStack Query
vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

// Mock API
vi.mock('@/store/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: vi.fn((key) => key),
    },
  },
}));

// Mock useToast
vi.mock('@/components/Composables/useToastComposable', () => ({
  default: vi.fn(() => ({
    successToast: vi.fn(),
    errorToast: vi.fn(),
  })),
}));

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import api from '@/store/api';
import i18n from '@/i18n';
import useToast from '@/components/Composables/useToastComposable';

describe('useCapacityOnDemand', () => {
  let mockQueryClient;
  let mockSuccessToast;
  let mockErrorToast;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock query client
    mockQueryClient = {
      invalidateQueries: vi.fn(),
    };
    useQueryClient.mockReturnValue(mockQueryClient);

    // Mock toast functions
    mockSuccessToast = vi.fn();
    mockErrorToast = vi.fn();
    useToast.mockReturnValue({
      successToast: mockSuccessToast,
      errorToast: mockErrorToast,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query - Fetching Licenses Data', () => {
    it('returns empty licenses object when data is not available', () => {
      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { licenses } = useCapacityOnDemand();

      expect(licenses.value).toEqual({});
    });

    it('returns licenses data when available', () => {
      const mockLicenses = {
        PermProcs: {
          Id: 'PermProcs',
          Name: 'Permanent Processor Licenses',
          SerialNumber: 'RES123-SEQ456',
          ExpirationDate: '2025-12-31T23:59:59.000Z',
          LicenseScope: { MaxNumberOfDevices: 10 },
        },
        PermMem: {
          Id: 'PermMem',
          Name: 'Permanent Memory Licenses (GB)',
          SerialNumber: 'RES789-SEQ012',
          ExpirationDate: '2025-12-31T23:59:59.000Z',
          LicenseScope: { MaxNumberOfDevices: 256 },
        },
      };

      useQuery.mockReturnValue({
        data: ref(mockLicenses),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { licenses } = useCapacityOnDemand();

      expect(licenses.value).toEqual(mockLicenses);
    });

    it('exposes isFetching state from useQuery', () => {
      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(true),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { isFetching } = useCapacityOnDemand();

      expect(isFetching.value).toBe(true);
    });

    it('exposes isError state from useQuery', () => {
      const mockError = new Error('Network error');

      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(true),
        error: ref(mockError),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { isError, error } = useCapacityOnDemand();

      expect(isError.value).toBe(true);
      expect(error.value).toBe(mockError);
    });

    it('configures useQuery with correct options', () => {
      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      useCapacityOnDemand();

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['redfish', 'licenseService', 'licenses'],
          queryFn: expect.any(Function),
          refetchInterval: 60 * 1000,
          gcTime: 5 * 60 * 1000,
          retry: expect.any(Function),
          retryDelay: expect.any(Function),
        }),
      );
    });

    it('queryFn handles missing Members array', async () => {
      let queryFn;

      useQuery.mockImplementation((options) => {
        queryFn = options.queryFn;
        return {
          data: ref(null),
          isFetching: ref(false),
          isError: ref(false),
          error: ref(null),
          refetch: vi.fn(),
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      // Mock response with no Members
      api.get.mockResolvedValueOnce({ data: {} });

      useCapacityOnDemand();

      const result = await queryFn();

      expect(api.get).toHaveBeenCalledWith(
        '/redfish/v1/LicenseService/Licenses',
      );
      expect(result).toEqual({});
    });

    it('queryFn fetches licenses from API', async () => {
      let queryFn;
      const mockMembers = [
        { '@odata.id': '/redfish/v1/LicenseService/Licenses/PermProcs' },
        { '@odata.id': '/redfish/v1/LicenseService/Licenses/PermMem' },
      ];

      const mockLicenseData = [
        {
          data: {
            Id: 'PermProcs',
            Name: 'Permanent Processor Licenses',
            SerialNumber: 'RES123-SEQ456',
          },
        },
        {
          data: {
            Id: 'PermMem',
            Name: 'Permanent Memory Licenses (GB)',
            SerialNumber: 'RES789-SEQ012',
          },
        },
      ];

      useQuery.mockImplementation((options) => {
        queryFn = options.queryFn;
        return {
          data: ref(null),
          isFetching: ref(false),
          isError: ref(false),
          error: ref(null),
          refetch: vi.fn(),
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      api.get
        .mockResolvedValueOnce({ data: { Members: mockMembers } })
        .mockResolvedValueOnce(mockLicenseData[0])
        .mockResolvedValueOnce(mockLicenseData[1]);

      useCapacityOnDemand();

      const result = await queryFn();

      expect(api.get).toHaveBeenCalledWith(
        '/redfish/v1/LicenseService/Licenses',
      );
      expect(api.get).toHaveBeenCalledWith(
        '/redfish/v1/LicenseService/Licenses/PermProcs',
      );
      expect(api.get).toHaveBeenCalledWith(
        '/redfish/v1/LicenseService/Licenses/PermMem',
      );
      expect(result).toEqual({
        PermProcs: mockLicenseData[0].data,
        PermMem: mockLicenseData[1].data,
      });
    });

    it('retry function returns false for 4xx errors', () => {
      let retryFn;

      useQuery.mockImplementation((options) => {
        retryFn = options.retry;
        return {
          data: ref(null),
          isFetching: ref(false),
          isError: ref(false),
          error: ref(null),
          refetch: vi.fn(),
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      useCapacityOnDemand();

      const error404 = { response: { status: 404 } };
      expect(retryFn(1, error404)).toBe(false);

      const error400 = { response: { status: 400 } };
      expect(retryFn(1, error400)).toBe(false);
    });

    it('retry function returns true for 5xx errors (up to 2 times)', () => {
      let retryFn;

      useQuery.mockImplementation((options) => {
        retryFn = options.retry;
        return {
          data: ref(null),
          isFetching: ref(false),
          isError: ref(false),
          error: ref(null),
          refetch: vi.fn(),
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      useCapacityOnDemand();

      const error500 = { response: { status: 500 } };
      expect(retryFn(0, error500)).toBe(true);
      expect(retryFn(1, error500)).toBe(true);
      expect(retryFn(2, error500)).toBe(false);
    });

    it('retryDelay uses exponential backoff', () => {
      let retryDelayFn;

      useQuery.mockImplementation((options) => {
        retryDelayFn = options.retryDelay;
        return {
          data: ref(null),
          isFetching: ref(false),
          isError: ref(false),
          error: ref(null),
          refetch: vi.fn(),
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      useCapacityOnDemand();

      expect(retryDelayFn(0)).toBe(1000);
      expect(retryDelayFn(1)).toBe(2000);
      expect(retryDelayFn(2)).toBe(4000);
      expect(retryDelayFn(3)).toBe(8000);
      expect(retryDelayFn(4)).toBe(10000);
      expect(retryDelayFn(5)).toBe(10000);
    });
  });

  describe('Computed Properties - License Parsing', () => {
    it('processorInfo parses PermProcs license correctly', () => {
      const mockLicenses = {
        PermProcs: {
          Id: 'PermProcs',
          Name: 'Permanent Processor Licenses',
          SerialNumber: 'RES123-SEQ456',
          ExpirationDate: '2025-12-31T23:59:59.000Z',
          LicenseScope: { MaxNumberOfDevices: 10 },
        },
      };

      useQuery.mockReturnValue({
        data: ref(mockLicenses),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { processorInfo } = useCapacityOnDemand();

      expect(processorInfo.value.licensed).toBe(10);
      expect(processorInfo.value.resourceId).toBe('RES123');
      expect(processorInfo.value.sequenceNumber).toBe('SEQ456');
      expect(processorInfo.value.expirationDate).toBeInstanceOf(Date);
    });

    it('memoryInfo parses PermMem license correctly', () => {
      const mockLicenses = {
        PermMem: {
          Id: 'PermMem',
          Name: 'Permanent Memory Licenses (GB)',
          SerialNumber: 'RES789-SEQ012',
          ExpirationDate: '2025-12-31T23:59:59.000Z',
          LicenseScope: { MaxNumberOfDevices: 256 },
        },
      };

      useQuery.mockReturnValue({
        data: ref(mockLicenses),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { memoryInfo } = useCapacityOnDemand();

      expect(memoryInfo.value.licensed).toBe(256);
      expect(memoryInfo.value.resourceId).toBe('RES789');
      expect(memoryInfo.value.sequenceNumber).toBe('SEQ012');
    });

    it('returns default values when license data is missing', () => {
      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { processorInfo, memoryInfo } = useCapacityOnDemand();

      expect(processorInfo.value.licensed).toBe('--');
      expect(processorInfo.value.resourceId).toBe('--');
      expect(processorInfo.value.sequenceNumber).toBe('--');
      expect(processorInfo.value.expirationDate).toBe('--');

      expect(memoryInfo.value.licensed).toBe('--');
    });

    it('firmwareAccessKeyInfo parses UAK license correctly', () => {
      const mockLicenses = {
        UAK: {
          Id: 'UAK',
          Name: 'Firmware Update Access Key',
          SerialNumber: 'FW123-KEY456',
          ExpirationDate: '2025-12-31T23:59:59.000Z',
        },
      };

      useQuery.mockReturnValue({
        data: ref(mockLicenses),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { firmwareAccessKeyInfo } = useCapacityOnDemand();

      expect(firmwareAccessKeyInfo.value.resourceId).toBe('FW123');
      expect(firmwareAccessKeyInfo.value.sequenceNumber).toBe('KEY456');
    });

    it('aixAccessKeyInfo parses AIXUAK license correctly', () => {
      const mockLicenses = {
        AIXUAK: {
          Id: 'AIXUAK',
          Name: 'AIX Update Access Key',
          SerialNumber: 'AIX123-KEY789',
          ExpirationDate: '2025-12-31T23:59:59.000Z',
        },
      };

      useQuery.mockReturnValue({
        data: ref(mockLicenses),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { aixAccessKeyInfo } = useCapacityOnDemand();

      expect(aixAccessKeyInfo.value.resourceId).toBe('AIX123');
      expect(aixAccessKeyInfo.value.sequenceNumber).toBe('KEY789');
    });

    it('vetCapabilities filters out excluded license names', () => {
      const mockLicenses = {
        PermProcs: {
          Id: 'PermProcs',
          Name: 'Permanent Processor Licenses', // This is excluded
        },
        UAK: {
          Id: 'UAK',
          Name: 'Firmware Update Access Key', // This is excluded
        },
        AIXUAK: {
          Id: 'AIXUAK',
          Name: 'AIX Update Access Key', // This is excluded
        },
        VET: {
          Id: 'VET',
          Name: 'Virtualization Engine Technology', // This is excluded
        },
        CustomLicense: {
          Id: 'CustomLicense',
          Name: 'Custom License', // This is NOT excluded
        },
        AnotherLicense: {
          Id: 'AnotherLicense',
          Name: 'Another Custom License', // This is NOT excluded
        },
      };

      useQuery.mockReturnValue({
        data: ref(mockLicenses),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { vetCapabilities } = useCapacityOnDemand();

      // Should exclude PermProcs, UAK, AIXUAK, and VET (4 excluded, 2 remaining)
      expect(vetCapabilities.value).toHaveLength(2);
      expect(vetCapabilities.value.map((l) => l.Name)).toEqual([
        'Custom License',
        'Another Custom License',
      ]);
    });
  });

  describe('Mutation - Activate License', () => {
    it('activateLicense calls mutation with license key', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: ref(false),
      });

      const { activateLicense } = useCapacityOnDemand();

      await activateLicense('TEST-LICENSE-KEY-123');

      expect(mockMutateAsync).toHaveBeenCalledWith('TEST-LICENSE-KEY-123');
    });

    it('mutationFn posts license key to API', async () => {
      let mutationFn;

      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockImplementation((options) => {
        mutationFn = options.mutationFn;
        return {
          mutateAsync: vi.fn(),
          isPending: ref(false),
        };
      });

      api.post.mockResolvedValue({ data: {} });

      useCapacityOnDemand();

      await mutationFn('TEST-LICENSE-KEY-123');

      expect(api.post).toHaveBeenCalledWith(
        '/redfish/v1/LicenseService/Licenses',
        { LicenseString: 'TEST-LICENSE-KEY-123' },
      );
    });

    it('shows success toast and invalidates queries on successful activation', () => {
      let onSuccessCallback;

      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockImplementation((options) => {
        onSuccessCallback = options.onSuccess;
        return {
          mutateAsync: vi.fn(),
          isPending: ref(false),
        };
      });

      useCapacityOnDemand();

      onSuccessCallback();

      expect(mockSuccessToast).toHaveBeenCalledWith(
        'pageCapacityOnDemand.activation.toast.success',
      );
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['redfish', 'licenseService', 'licenses'],
      });
    });

    it('shows error toast on activation failure', () => {
      let onErrorCallback;
      const mockError = new Error('Activation failed');

      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockImplementation((options) => {
        onErrorCallback = options.onError;
        return {
          mutateAsync: vi.fn(),
          isPending: ref(false),
        };
      });

      useCapacityOnDemand();

      onErrorCallback(mockError);

      expect(mockErrorToast).toHaveBeenCalledWith(
        'pageCapacityOnDemand.activation.toast.error',
      );
    });

    it('exposes isActivating state from mutation', () => {
      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(true),
      });

      const { isActivating } = useCapacityOnDemand();

      expect(isActivating.value).toBe(true);
    });
  });

  describe('Integration - Complete Workflow', () => {
    it('returns all expected properties', () => {
      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const result = useCapacityOnDemand();

      expect(result).toHaveProperty('licenses');
      expect(result).toHaveProperty('vetCapabilities');
      expect(result).toHaveProperty('processorInfo');
      expect(result).toHaveProperty('memoryInfo');
      expect(result).toHaveProperty('firmwareAccessKeyInfo');
      expect(result).toHaveProperty('aixAccessKeyInfo');
      expect(result).toHaveProperty('isFetching');
      expect(result).toHaveProperty('isError');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('refetch');
      expect(result).toHaveProperty('activateLicense');
      expect(result).toHaveProperty('isActivating');
    });

    it('exposes refetch function', () => {
      const mockRefetch = vi.fn();

      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: mockRefetch,
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: ref(false),
      });

      const { refetch } = useCapacityOnDemand();

      expect(refetch).toBe(mockRefetch);
    });
  });
});

// Made with Bob
