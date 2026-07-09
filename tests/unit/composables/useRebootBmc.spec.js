import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useRebootBmc } from '@/api/composables/useRebootBmc';

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

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import api from '@/store/api';

describe('useRebootBmc', () => {
  let mockQueryClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock query client
    mockQueryClient = {
      invalidateQueries: vi.fn(),
    };
    useQueryClient.mockReturnValue(mockQueryClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query - Fetching BMC Manager Data', () => {
    it('returns null lastBmcRebootTime when data is not available', () => {
      // Mock useQuery to return no data
      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      // Mock useMutation
      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { lastBmcRebootTime } = useRebootBmc();

      expect(lastBmcRebootTime.value).toBeNull();
    });

    it('transforms LastResetTime to Date object', () => {
      const mockDate = '2024-01-15T10:30:00.000Z';
      const mockManagerData = {
        '@odata.id': '/redfish/v1/Managers/bmc',
        LastResetTime: mockDate,
        Status: { Health: 'OK' },
      };

      // Mock useQuery to return manager data
      useQuery.mockReturnValue({
        data: ref(mockManagerData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      // Mock useMutation
      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { lastBmcRebootTime } = useRebootBmc();

      expect(lastBmcRebootTime.value).toBeInstanceOf(Date);
      expect(lastBmcRebootTime.value.toISOString()).toBe(mockDate);
    });

    it('returns null when LastResetTime is missing', () => {
      const mockManagerData = {
        '@odata.id': '/redfish/v1/Managers/bmc',
        Status: { Health: 'OK' },
        // No LastResetTime
      };

      useQuery.mockReturnValue({
        data: ref(mockManagerData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { lastBmcRebootTime } = useRebootBmc();

      expect(lastBmcRebootTime.value).toBeNull();
    });

    it('exposes isFetching state from useQuery', () => {
      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(true),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { isFetching } = useRebootBmc();

      expect(isFetching.value).toBe(true);
    });

    it('exposes isError state from useQuery', () => {
      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(true),
        error: ref(new Error('Network error')),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { isError, error } = useRebootBmc();

      expect(isError.value).toBe(true);
      expect(error.value).toBeInstanceOf(Error);
      expect(error.value.message).toBe('Network error');
    });

    it('configures useQuery with correct options', () => {
      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      useRebootBmc();

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['redfish', 'managers', 'bmc'],
          queryFn: expect.any(Function),
          staleTime: 60 * 1000, // 1 minute
          gcTime: 5 * 60 * 1000, // 5 minutes
          retry: expect.any(Function),
          retryDelay: expect.any(Function),
        }),
      );
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
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      useRebootBmc();

      // Test 404 error
      const error404 = { response: { status: 404 } };
      expect(retryFn(1, error404)).toBe(false);

      // Test 400 error
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
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      useRebootBmc();

      const error500 = { response: { status: 500 } };
      expect(retryFn(0, error500)).toBe(true);
      expect(retryFn(1, error500)).toBe(true);
      expect(retryFn(2, error500)).toBe(false); // Max retries reached
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
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      useRebootBmc();

      expect(retryDelayFn(0)).toBe(1000); // 1s
      expect(retryDelayFn(1)).toBe(2000); // 2s
      expect(retryDelayFn(2)).toBe(4000); // 4s
      expect(retryDelayFn(3)).toBe(8000); // 8s
      expect(retryDelayFn(4)).toBe(10000); // Capped at 10s
      expect(retryDelayFn(5)).toBe(10000); // Still capped
    });

    it('queryFn fetches BMC manager data from API', async () => {
      let queryFn;
      const mockManagerData = {
        '@odata.id': '/redfish/v1/Managers/bmc',
        LastResetTime: '2024-01-15T10:30:00.000Z',
        Status: { Health: 'OK' },
      };

      useQuery.mockImplementation((options) => {
        queryFn = options.queryFn;
        return {
          data: ref(null),
          isFetching: ref(false),
          isError: ref(false),
          error: ref(null),
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      api.get.mockResolvedValue({ data: mockManagerData });

      useRebootBmc();

      // Call the queryFn to test the actual API call
      const result = await queryFn();

      expect(api.get).toHaveBeenCalledWith('/redfish/v1/Managers/bmc');
      expect(result).toEqual(mockManagerData);
    });
  });

  describe('Mutation - Rebooting BMC', () => {
    it('exposes rebootBmc function from mutation', () => {
      const mockMutateAsync = vi.fn();

      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      const { rebootBmc } = useRebootBmc();

      expect(rebootBmc).toBe(mockMutateAsync);
    });

    it('configures useMutation with correct mutation function', async () => {
      let mutationFn;

      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockImplementation((options) => {
        mutationFn = options.mutationFn;
        return {
          mutateAsync: vi.fn(),
        };
      });

      api.post.mockResolvedValue({ data: {} });

      useRebootBmc();

      // Call the mutation function
      await mutationFn();

      expect(api.post).toHaveBeenCalledWith(
        '/redfish/v1/Managers/bmc/Actions/Manager.Reset',
        { ResetType: 'GracefulRestart' },
      );
    });

    it('invalidates BMC query on successful reboot', () => {
      let onSuccessCallback;

      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockImplementation((options) => {
        onSuccessCallback = options.onSuccess;
        return {
          mutateAsync: vi.fn(),
        };
      });

      useRebootBmc();

      // Trigger onSuccess callback
      onSuccessCallback();

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['redfish', 'managers', 'bmc'],
      });
    });

    it('rebootBmc calls mutation with correct parameters', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      const { rebootBmc } = useRebootBmc();

      await rebootBmc();

      expect(mockMutateAsync).toHaveBeenCalled();
    });

    it('rebootBmc handles errors correctly', async () => {
      const mockError = new Error('Reboot failed');
      const mockMutateAsync = vi.fn().mockRejectedValue(mockError);

      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      const { rebootBmc } = useRebootBmc();

      await expect(rebootBmc()).rejects.toThrow('Reboot failed');
    });
  });

  describe('Integration - Query and Mutation', () => {
    it('returns all expected properties', () => {
      const mockMutateAsync = vi.fn();

      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      const result = useRebootBmc();

      expect(result).toHaveProperty('lastBmcRebootTime');
      expect(result).toHaveProperty('isFetching');
      expect(result).toHaveProperty('isError');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('rebootBmc');
    });

    it('handles complete reboot workflow', async () => {
      const initialDate = '2024-01-15T10:00:00.000Z';
      const updatedDate = '2024-01-15T11:00:00.000Z';

      // Initial query returns old reboot time
      const managerData = ref({
        '@odata.id': '/redfish/v1/Managers/bmc',
        LastResetTime: initialDate,
      });

      useQuery.mockReturnValue({
        data: managerData,
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      const mockMutateAsync = vi.fn().mockImplementation(async () => {
        // Simulate successful reboot
        api.post.mockResolvedValue({ data: {} });

        // Simulate cache invalidation triggering refetch
        managerData.value = {
          '@odata.id': '/redfish/v1/Managers/bmc',
          LastResetTime: updatedDate,
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      const { lastBmcRebootTime, rebootBmc } = useRebootBmc();

      // Initial state
      expect(lastBmcRebootTime.value.toISOString()).toBe(initialDate);

      // Perform reboot
      await rebootBmc();

      // After reboot, time should be updated
      expect(lastBmcRebootTime.value.toISOString()).toBe(updatedDate);
    });
  });
});

// Made with Bob
