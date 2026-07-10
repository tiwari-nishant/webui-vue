import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useFieldCoreOverride } from '@/api/composables/useFieldCoreOverride';

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
    patch: vi.fn(),
  },
}));

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import api from '@/store/api';

describe('useFieldCoreOverride', () => {
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

  describe('Query - Fetching BIOS Attributes', () => {
    it('returns default values when BIOS data is not available', () => {
      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { configuredCores, isPending, isEnabled } = useFieldCoreOverride();

      expect(configuredCores.value).toBe(0);
      expect(isPending.value).toBe(false);
      expect(isEnabled.value).toBe(false);
    });

    it('returns BIOS attributes when available', () => {
      const mockBiosData = {
        hb_field_core_override: 8,
        hb_field_core_override_current: 8,
      };

      useQuery.mockReturnValue({
        data: ref(mockBiosData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { configuredCores, isPending, isEnabled } = useFieldCoreOverride();

      expect(configuredCores.value).toBe(8);
      expect(isPending.value).toBe(false);
      expect(isEnabled.value).toBe(true);
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

      const { isFetching } = useFieldCoreOverride();

      expect(isFetching.value).toBe(true);
    });

    it('exposes isError state from useQuery', () => {
      const mockError = new Error('Network error');

      useQuery.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(true),
        error: ref(mockError),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { isError, error } = useFieldCoreOverride();

      expect(isError.value).toBe(true);
      expect(error.value).toBe(mockError);
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

      useFieldCoreOverride();

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['redfish', 'systems', 'system', 'bios'],
          queryFn: expect.any(Function),
          staleTime: 0,
          refetchInterval: 60000,
          gcTime: 5 * 60 * 1000,
          retry: expect.any(Function),
          retryDelay: expect.any(Function),
        }),
      );
    });

    it('queryFn fetches BIOS attributes from API', async () => {
      let queryFn;
      const mockBiosResponse = {
        Attributes: {
          hb_field_core_override: 8,
          hb_field_core_override_current: 8,
          other_attribute: 'value',
        },
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

      api.get.mockResolvedValue({ data: mockBiosResponse });

      useFieldCoreOverride();

      const result = await queryFn();

      expect(api.get).toHaveBeenCalledWith('/redfish/v1/Systems/system/Bios');
      expect(result).toEqual(mockBiosResponse.Attributes);
    });

    it('queryFn returns empty object when Attributes is missing', async () => {
      let queryFn;

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

      api.get.mockResolvedValue({ data: {} });

      useFieldCoreOverride();

      const result = await queryFn();

      expect(result).toEqual({});
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

      useFieldCoreOverride();

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
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      useFieldCoreOverride();

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
        };
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      useFieldCoreOverride();

      expect(retryDelayFn(0)).toBe(1000);
      expect(retryDelayFn(1)).toBe(2000);
      expect(retryDelayFn(2)).toBe(4000);
      expect(retryDelayFn(3)).toBe(8000);
      expect(retryDelayFn(4)).toBe(10000);
      expect(retryDelayFn(5)).toBe(10000);
    });
  });

  describe('Computed Properties - Core Override Logic', () => {
    it('isPending is false when pending equals current', () => {
      const mockBiosData = {
        hb_field_core_override: 8,
        hb_field_core_override_current: 8,
      };

      useQuery.mockReturnValue({
        data: ref(mockBiosData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { isPending } = useFieldCoreOverride();

      expect(isPending.value).toBe(false);
    });

    it('isPending is true when pending differs from current', () => {
      const mockBiosData = {
        hb_field_core_override: 12,
        hb_field_core_override_current: 8,
      };

      useQuery.mockReturnValue({
        data: ref(mockBiosData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { isPending } = useFieldCoreOverride();

      expect(isPending.value).toBe(true);
    });

    it('configuredCores returns current value when not pending', () => {
      const mockBiosData = {
        hb_field_core_override: 8,
        hb_field_core_override_current: 8,
      };

      useQuery.mockReturnValue({
        data: ref(mockBiosData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { configuredCores } = useFieldCoreOverride();

      expect(configuredCores.value).toBe(8);
    });

    it('configuredCores returns pending value when pending', () => {
      const mockBiosData = {
        hb_field_core_override: 12,
        hb_field_core_override_current: 8,
      };

      useQuery.mockReturnValue({
        data: ref(mockBiosData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { configuredCores } = useFieldCoreOverride();

      expect(configuredCores.value).toBe(12);
    });

    it('isEnabled is false when current value is 0', () => {
      const mockBiosData = {
        hb_field_core_override: 0,
        hb_field_core_override_current: 0,
      };

      useQuery.mockReturnValue({
        data: ref(mockBiosData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { isEnabled } = useFieldCoreOverride();

      expect(isEnabled.value).toBe(false);
    });

    it('isEnabled is true when current value is greater than 0', () => {
      const mockBiosData = {
        hb_field_core_override: 8,
        hb_field_core_override_current: 8,
      };

      useQuery.mockReturnValue({
        data: ref(mockBiosData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { isEnabled } = useFieldCoreOverride();

      expect(isEnabled.value).toBe(true);
    });

    it('isEnabled uses pending value when pending', () => {
      const mockBiosData = {
        hb_field_core_override: 12,
        hb_field_core_override_current: 0,
      };

      useQuery.mockReturnValue({
        data: ref(mockBiosData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const { isEnabled } = useFieldCoreOverride();

      expect(isEnabled.value).toBe(true);
    });
  });

  describe('Mutation - Set Field Core Override', () => {
    it('setFieldCoreOverride calls mutation with core count', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      const { setFieldCoreOverride } = useFieldCoreOverride();

      await setFieldCoreOverride(12);

      expect(mockMutateAsync).toHaveBeenCalledWith(12);
    });

    it('mutationFn patches BIOS settings with core override', async () => {
      let mutationFn;

      useQuery.mockReturnValue({
        data: ref({}),
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

      api.patch.mockResolvedValue({ data: {} });

      useFieldCoreOverride();

      await mutationFn(12);

      expect(api.patch).toHaveBeenCalledWith(
        '/redfish/v1/Systems/system/Bios/Settings',
        { Attributes: { hb_field_core_override: 12 } },
      );
    });

    it('mutationFn converts string to number', async () => {
      let mutationFn;

      useQuery.mockReturnValue({
        data: ref({}),
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

      api.patch.mockResolvedValue({ data: {} });

      useFieldCoreOverride();

      await mutationFn('12');

      expect(api.patch).toHaveBeenCalledWith(
        '/redfish/v1/Systems/system/Bios/Settings',
        { Attributes: { hb_field_core_override: 12 } },
      );
    });

    it('invalidates BIOS query on successful update', () => {
      let onSuccessCallback;

      useQuery.mockReturnValue({
        data: ref({}),
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

      useFieldCoreOverride();

      onSuccessCallback();

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['redfish', 'systems', 'system', 'bios'],
      });
    });

    it('setFieldCoreOverride handles errors correctly', async () => {
      const mockError = new Error('Update failed');
      const mockMutateAsync = vi.fn().mockRejectedValue(mockError);

      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      const { setFieldCoreOverride } = useFieldCoreOverride();

      await expect(setFieldCoreOverride(12)).rejects.toThrow('Update failed');
    });
  });

  describe('Integration - Complete Workflow', () => {
    it('returns all expected properties', () => {
      useQuery.mockReturnValue({
        data: ref({}),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      useMutation.mockReturnValue({
        mutateAsync: vi.fn(),
      });

      const result = useFieldCoreOverride();

      expect(result).toHaveProperty('isFetching');
      expect(result).toHaveProperty('isError');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('isPending');
      expect(result).toHaveProperty('configuredCores');
      expect(result).toHaveProperty('isEnabled');
      expect(result).toHaveProperty('setFieldCoreOverride');
    });

    it('handles complete update workflow', async () => {
      const initialData = {
        hb_field_core_override: 8,
        hb_field_core_override_current: 8,
      };

      const updatedData = {
        hb_field_core_override: 12,
        hb_field_core_override_current: 8,
      };

      const biosDataRef = ref(initialData);

      useQuery.mockReturnValue({
        data: biosDataRef,
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      const mockMutateAsync = vi.fn().mockImplementation(async () => {
        biosDataRef.value = updatedData;
      });

      useMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      const { setFieldCoreOverride, isPending, configuredCores } =
        useFieldCoreOverride();

      // Initial state
      expect(isPending.value).toBe(false);
      expect(configuredCores.value).toBe(8);

      // Update
      await setFieldCoreOverride(12);

      // After update
      expect(mockMutateAsync).toHaveBeenCalledWith(12);
      expect(isPending.value).toBe(true);
      expect(configuredCores.value).toBe(12);
    });
  });
});
