import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import {
  usePowerControl,
  usePowerPerformanceMode,
  useIdlePowerSaver,
} from '@/api/composables/usePowerControl';

// Mock dependencies
vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('@/api/composables/useRedfishCollection', () => ({
  useRedfishResource: vi.fn(),
}));

vi.mock('@/api/composables/usePatchResource', () => ({
  usePatchResource: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: vi.fn((key) => key),
    },
  },
}));

vi.mock('@/components/Composables/useToastComposable', () => ({
  default: vi.fn(() => ({
    successToast: vi.fn(),
    errorToast: vi.fn(),
  })),
}));

import { useRedfishResource } from '@/api/composables/useRedfishCollection';
import { usePatchResource } from '@/api/composables/usePatchResource';
import useToast from '@/components/Composables/useToastComposable';

describe('usePowerControl', () => {
  let mockSuccessToast;
  let mockErrorToast;
  let mockPatchResource;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSuccessToast = vi.fn();
    mockErrorToast = vi.fn();
    useToast.mockReturnValue({
      successToast: mockSuccessToast,
      errorToast: mockErrorToast,
    });

    mockPatchResource = vi.fn();
    usePatchResource.mockReturnValue({
      patchResource: mockPatchResource,
      isPending: ref(false),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Power Control Data', () => {
    it('returns null values when data is not available', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      const {
        powerConsumption,
        powerControlMode,
        isPowerCapEnabled,
        powerCap,
        powerCapMin,
        powerCapMax,
      } = usePowerControl();

      expect(powerConsumption.value).toBeNull();
      expect(powerControlMode.value).toBeNull();
      expect(isPowerCapEnabled.value).toBe(false);
      expect(powerCap.value).toBeNull();
      expect(powerCapMin.value).toBeNull();
      expect(powerCapMax.value).toBeNull();
    });

    it('returns power control data when available', () => {
      const mockData = {
        PowerWatts: { Reading: 500 },
        PowerLimitWatts: {
          ControlMode: 'Automatic',
          SetPoint: 600,
          AllowableMin: 300,
          AllowableMax: 1000,
        },
      };

      useRedfishResource.mockReturnValue({
        data: ref(mockData),
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      const {
        powerConsumption,
        powerControlMode,
        isPowerCapEnabled,
        powerCap,
        powerCapMin,
        powerCapMax,
      } = usePowerControl();

      expect(powerConsumption.value).toBe(500);
      expect(powerControlMode.value).toBe('Automatic');
      expect(isPowerCapEnabled.value).toBe(true);
      expect(powerCap.value).toBe(600);
      expect(powerCapMin.value).toBe(300);
      expect(powerCapMax.value).toBe(1000);
    });

    it('isPowerCapEnabled is false when mode is not Automatic', () => {
      const mockData = {
        PowerLimitWatts: {
          ControlMode: 'Manual',
        },
      };

      useRedfishResource.mockReturnValue({
        data: ref(mockData),
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      const { isPowerCapEnabled } = usePowerControl();

      expect(isPowerCapEnabled.value).toBe(false);
    });

    it('calls useRedfishResource with correct path and refetchInterval', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      usePowerControl();

      expect(useRedfishResource).toHaveBeenCalledWith(
        '/redfish/v1/Chassis/chassis/EnvironmentMetrics',
        { refetchInterval: 60 * 1000 },
      );
    });
  });

  describe('setPowerCap', () => {
    it('calls patchResource with correct parameters', async () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      mockPatchResource.mockResolvedValue(undefined);

      const { setPowerCap } = usePowerControl();

      await setPowerCap({
        powerControlMode: 'Automatic',
        powerCap: 700,
      });

      expect(mockPatchResource).toHaveBeenCalledWith({
        endpoint: '/redfish/v1/Chassis/chassis/EnvironmentMetrics',
        field: 'PowerLimitWatts',
        value: {
          ControlMode: 'Automatic',
          SetPoint: 700,
        },
        invalidateQueries: [
          [
            'redfish',
            'resource',
            '/redfish/v1/Chassis/chassis/EnvironmentMetrics',
          ],
        ],
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      });
    });
  });

  describe('Loading and Error States', () => {
    it('exposes loading states', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isLoading: ref(true),
        isFetching: ref(true),
        isError: ref(false),
        error: ref(null),
      });

      const { isPowerControlLoading, isPowerControlFetching } =
        usePowerControl();

      expect(isPowerControlLoading.value).toBe(true);
      expect(isPowerControlFetching.value).toBe(true);
    });

    it('exposes error states', () => {
      const mockError = new Error('Test error');

      useRedfishResource.mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(true),
        error: ref(mockError),
      });

      const { isPowerControlError, powerControlError } = usePowerControl();

      expect(isPowerControlError.value).toBe(true);
      expect(powerControlError.value).toBe(mockError);
    });

    it('exposes mutating state', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      usePatchResource.mockReturnValue({
        patchResource: vi.fn(),
        isPending: ref(true),
      });

      const { isPowerControlMutating } = usePowerControl();

      expect(isPowerControlMutating.value).toBe(true);
    });
  });
});

describe('usePowerPerformanceMode', () => {
  let mockSuccessToast;
  let mockErrorToast;
  let mockPatchResource;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSuccessToast = vi.fn();
    mockErrorToast = vi.fn();
    useToast.mockReturnValue({
      successToast: mockSuccessToast,
      errorToast: mockErrorToast,
    });

    mockPatchResource = vi.fn();
    usePatchResource.mockReturnValue({
      patchResource: mockPatchResource,
      isPending: ref(false),
    });
  });

  describe('Power Performance Data', () => {
    it('returns null values when data is not available', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      const { powerPerformanceMode, powerPerformanceModeValues, oemMode } =
        usePowerPerformanceMode();

      expect(powerPerformanceMode.value).toBeNull();
      expect(powerPerformanceModeValues.value).toBeNull();
      expect(oemMode.value).toBe(false);
    });

    it('returns power performance data when available', () => {
      const mockData = {
        PowerMode: 'MaximumPerformance',
        'PowerMode@Redfish.AllowableValues': [
          'MaximumPerformance',
          'PowerSaving',
          'OEM',
        ],
      };

      useRedfishResource.mockReturnValue({
        data: ref(mockData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      const { powerPerformanceMode, powerPerformanceModeValues, oemMode } =
        usePowerPerformanceMode();

      expect(powerPerformanceMode.value).toBe('MaximumPerformance');
      expect(powerPerformanceModeValues.value).toEqual([
        'MaximumPerformance',
        'PowerSaving',
        'OEM',
      ]);
      expect(oemMode.value).toBe(false);
    });

    it('oemMode is true when PowerMode is OEM', () => {
      const mockData = {
        PowerMode: 'OEM',
      };

      useRedfishResource.mockReturnValue({
        data: ref(mockData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      const { oemMode } = usePowerPerformanceMode();

      expect(oemMode.value).toBe(true);
    });

    it('calls useRedfishResource with correct path and refetchInterval', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      usePowerPerformanceMode();

      expect(useRedfishResource).toHaveBeenCalledWith(
        '/redfish/v1/Systems/system',
        { refetchInterval: 60 * 1000 },
      );
    });
  });

  describe('setPowerPerformanceMode', () => {
    it('calls patchResource with correct parameters', async () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
      });

      mockPatchResource.mockResolvedValue(undefined);

      const { setPowerPerformanceMode } = usePowerPerformanceMode();

      await setPowerPerformanceMode('MaximumPerformance');

      expect(mockPatchResource).toHaveBeenCalledWith({
        endpoint: '/redfish/v1/Systems/system',
        field: 'PowerMode',
        value: 'MaximumPerformance',
        invalidateQueries: [
          ['redfish', 'resource', '/redfish/v1/Systems/system'],
        ],
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      });
    });
  });

  describe('Loading and Error States', () => {
    it('exposes loading state', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(true),
        isError: ref(false),
        error: ref(null),
      });

      const { isPowerPerformanceFetching } = usePowerPerformanceMode();

      expect(isPowerPerformanceFetching.value).toBe(true);
    });

    it('exposes error states', () => {
      const mockError = new Error('Test error');

      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(true),
        error: ref(mockError),
      });

      const { isPowerPerformanceError, powerPerformanceError } =
        usePowerPerformanceMode();

      expect(isPowerPerformanceError.value).toBe(true);
      expect(powerPerformanceError.value).toBe(mockError);
    });
  });
});

describe('useIdlePowerSaver', () => {
  let mockSuccessToast;
  let mockErrorToast;
  let mockPatchResource;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSuccessToast = vi.fn();
    mockErrorToast = vi.fn();
    useToast.mockReturnValue({
      successToast: mockSuccessToast,
      errorToast: mockErrorToast,
    });

    mockPatchResource = vi.fn();
    usePatchResource.mockReturnValue({
      patchResource: mockPatchResource,
      isPending: ref(false),
    });
  });

  describe('Idle Power Saver Data', () => {
    it('returns null when data is not available', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      const { idlePowerSaverData } = useIdlePowerSaver();

      expect(idlePowerSaverData.value).toBeNull();
    });

    it('returns idle power saver data when available', () => {
      const mockIdlePowerSaver = {
        Enabled: true,
        EnterDwellTimeSeconds: 120,
        ExitDwellTimeSeconds: 60,
        EnterUtilizationPercent: 10,
        ExitUtilizationPercent: 50,
      };

      const mockData = {
        IdlePowerSaver: mockIdlePowerSaver,
      };

      useRedfishResource.mockReturnValue({
        data: ref(mockData),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      const { idlePowerSaverData } = useIdlePowerSaver();

      expect(idlePowerSaverData.value).toEqual(mockIdlePowerSaver);
    });

    it('calls useRedfishResource with correct path and refetchInterval', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      useIdlePowerSaver();

      expect(useRedfishResource).toHaveBeenCalledWith(
        '/redfish/v1/Systems/system',
        { refetchInterval: 60 * 1000 },
      );
    });

    it('exposes refetch function', () => {
      const mockRefetch = vi.fn();

      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: mockRefetch,
      });

      const { refetch } = useIdlePowerSaver();

      expect(refetch).toBe(mockRefetch);
    });
  });

  describe('setIdlePowerSaver', () => {
    it('calls patchResource with correct parameters', async () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      mockPatchResource.mockResolvedValue(undefined);

      const { setIdlePowerSaver } = useIdlePowerSaver();

      await setIdlePowerSaver({
        isIdlePowerSaverEnabled: true,
        enterDwellTimeSeconds: 120,
        exitDwellTimeSeconds: 60,
        enterUtilizationPercent: 10,
        exitUtilizationPercent: 50,
      });

      expect(mockPatchResource).toHaveBeenCalledWith({
        endpoint: '/redfish/v1/Systems/system',
        field: 'IdlePowerSaver',
        value: {
          Enabled: true,
          EnterDwellTimeSeconds: 120,
          ExitDwellTimeSeconds: 60,
          EnterUtilizationPercent: 10,
          ExitUtilizationPercent: 50,
        },
        invalidateQueries: [
          ['redfish', 'resource', '/redfish/v1/Systems/system'],
        ],
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      });
    });
  });

  describe('resetIdlePowerSaver', () => {
    it('calls patchResource with correct parameters', async () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      mockPatchResource.mockResolvedValue(undefined);

      const { resetIdlePowerSaver } = useIdlePowerSaver();

      await resetIdlePowerSaver();

      expect(mockPatchResource).toHaveBeenCalledWith({
        endpoint: '/redfish/v1/Systems/system',
        field: 'IdlePowerSaver.ExitUtilizationPercent',
        value: 0,
        invalidateQueries: [
          ['redfish', 'resource', '/redfish/v1/Systems/system'],
        ],
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      });
    });
  });

  describe('setIdlePowerSaverEnable', () => {
    it('calls patchResource with correct parameters when enabling', async () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      mockPatchResource.mockResolvedValue(undefined);

      const { setIdlePowerSaverEnable } = useIdlePowerSaver();

      await setIdlePowerSaverEnable(true);

      expect(mockPatchResource).toHaveBeenCalledWith({
        endpoint: '/redfish/v1/Systems/system',
        field: 'IdlePowerSaver.Enabled',
        value: true,
        invalidateQueries: [
          ['redfish', 'resource', '/redfish/v1/Systems/system'],
        ],
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it('calls patchResource with correct parameters when disabling', async () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      mockPatchResource.mockResolvedValue(undefined);

      const { setIdlePowerSaverEnable } = useIdlePowerSaver();

      await setIdlePowerSaverEnable(false);

      expect(mockPatchResource).toHaveBeenCalledWith({
        endpoint: '/redfish/v1/Systems/system',
        field: 'IdlePowerSaver.Enabled',
        value: false,
        invalidateQueries: [
          ['redfish', 'resource', '/redfish/v1/Systems/system'],
        ],
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      });
    });
  });

  describe('Loading and Error States', () => {
    it('exposes loading state', () => {
      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(true),
        isError: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      });

      const { isIdlePowerSaverFetching } = useIdlePowerSaver();

      expect(isIdlePowerSaverFetching.value).toBe(true);
    });

    it('exposes error states', () => {
      const mockError = new Error('Test error');

      useRedfishResource.mockReturnValue({
        data: ref(null),
        isFetching: ref(false),
        isError: ref(true),
        error: ref(mockError),
        refetch: vi.fn(),
      });

      const { isIdlePowerSaverError, idlePowerSaverError } =
        useIdlePowerSaver();

      expect(isIdlePowerSaverError.value).toBe(true);
      expect(idlePowerSaverError.value).toBe(mockError);
    });
  });
});

// Made with Bob
