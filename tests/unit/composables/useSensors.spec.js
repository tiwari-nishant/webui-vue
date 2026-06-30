import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// Mock the useAllSubResources composable
vi.mock('@/api/composables/useAllSubResources', () => ({
  useAllSubResources: vi.fn(),
}));

import { useAllSubResources } from '@/api/composables/useAllSubResources';
import { useSensors } from '@/api/composables/useSensors';

const makeMockSubResources = (overrides = {}) => ({
  data: ref(null),
  isLoading: ref(false),
  error: ref(null),
  isError: ref(false),
  refetch: vi.fn(),
  ...overrides,
});

describe('useSensors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty sensors array when data is null', () => {
    useAllSubResources.mockReturnValue(
      makeMockSubResources({ data: ref(null) }),
    );

    const { sensors } = useSensors();

    expect(sensors.value).toEqual([]);
  });

  it('maps raw Redfish sensor data to SensorData shape', () => {
    const rawSensors = [
      {
        '@odata.id': '/redfish/v1/Chassis/chassis1/Sensors/Temp1',
        Name: 'CPU Temp',
        Status: { Health: 'OK' },
        Reading: 55.5,
        ReadingUnits: 'Cel',
      },
    ];
    useAllSubResources.mockReturnValue(
      makeMockSubResources({ data: ref(rawSensors) }),
    );

    const { sensors } = useSensors();

    expect(sensors.value).toHaveLength(1);
    expect(sensors.value[0]).toEqual({
      odataId: '/redfish/v1/Chassis/chassis1/Sensors/Temp1',
      isSelected: false,
      name: 'CPU Temp',
      status: 'OK',
      currentValue: 55.5,
      units: 'Cel',
    });
  });

  it('falls back to empty string for missing Name', () => {
    const rawSensors = [
      {
        '@odata.id': '/redfish/v1/Chassis/chassis1/Sensors/NoName',
        Status: { Health: 'Warning' },
        Reading: 10,
        ReadingUnits: 'RPM',
      },
    ];
    useAllSubResources.mockReturnValue(
      makeMockSubResources({ data: ref(rawSensors) }),
    );

    const { sensors } = useSensors();

    expect(sensors.value[0].name).toBe('');
  });

  it('falls back to "Unknown" status when Status.Health is absent', () => {
    const rawSensors = [
      {
        '@odata.id': '/redfish/v1/Chassis/chassis1/Sensors/NoStatus',
        Name: 'Fan1',
        Reading: 3000,
        ReadingUnits: 'RPM',
      },
    ];
    useAllSubResources.mockReturnValue(
      makeMockSubResources({ data: ref(rawSensors) }),
    );

    const { sensors } = useSensors();

    expect(sensors.value[0].status).toBe('Unknown');
  });

  it('maps multiple sensors correctly', () => {
    const rawSensors = [
      {
        '@odata.id': '/id/1',
        Name: 'Temp1',
        Status: { Health: 'OK' },
        Reading: 40,
        ReadingUnits: 'Cel',
      },
      {
        '@odata.id': '/id/2',
        Name: 'Fan1',
        Status: { Health: 'Critical' },
        Reading: 0,
        ReadingUnits: 'RPM',
      },
    ];
    useAllSubResources.mockReturnValue(
      makeMockSubResources({ data: ref(rawSensors) }),
    );

    const { sensors } = useSensors();

    expect(sensors.value).toHaveLength(2);
    expect(sensors.value[1].status).toBe('Critical');
  });

  it('exposes isLoading, isError, error, and refetch from useAllSubResources', () => {
    const refetchFn = vi.fn();
    useAllSubResources.mockReturnValue(
      makeMockSubResources({
        isLoading: ref(true),
        isError: ref(true),
        error: ref(new Error('fetch failed')),
        refetch: refetchFn,
      }),
    );

    const { isLoading, isError, error, refetch } = useSensors();

    expect(isLoading.value).toBe(true);
    expect(isError.value).toBe(true);
    expect(error.value).toBeInstanceOf(Error);
    expect(refetch).toBe(refetchFn);
  });
});
