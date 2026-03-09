import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
// @ts-ignore - api.js is a JavaScript module
import api from '@/store/api';

export const HOST_STATE = {
  on: 'xyz.openbmc_project.State.Host.HostState.Running',
  off: 'xyz.openbmc_project.State.Host.HostState.Off',
  error: 'xyz.openbmc_project.State.Host.HostState.Quiesced',
  diagnosticMode: 'xyz.openbmc_project.State.Host.HostState.DiagnosticMode',
};

export const serverStateMapper = (hostState: string): string => {
  switch (hostState) {
    case HOST_STATE.on:
    case 'On': // Redfish PowerState
      return 'on';
    case HOST_STATE.off:
    case 'Off': // Redfish PowerState
      return 'off';
    case HOST_STATE.error:
    case 'Quiesced': // Redfish Status
      return 'error';
    case HOST_STATE.diagnosticMode:
    case 'InTest': // Redfish Status
      return 'diagnosticMode';
    default:
      return 'unreachable';
  }
};

const getHealthStatus = (
  events: EventLogEntry[],
  loadedEvents: boolean,
): string => {
  let status = loadedEvents ? 'OK' : '';
  for (const event of events) {
    if (event.Severity === 'Critical' && !event.Resolved) {
      status = 'Critical';
      break;
    } else if (event.Severity === 'Warning' && !event.Resolved) {
      status = 'Warning';
    }
  }
  return status;
};

interface SystemData {
  AssetTag?: string;
  Model?: string;
  PowerState?: string;
  SerialNumber?: string;
  Status?: {
    State?: string;
  };
}

interface EventLogEntry {
  Id: string;
  Severity: string;
  Resolved?: boolean;
}

interface EventLogResponse {
  Members?: EventLogEntry[];
}

export interface SystemInfo {
  assetTag: string | null;
  modelType: string;
  serialNumber: string | null;
  serverStatus: string;
  healthStatus: string;
  events: EventLogEntry[];
}

/**
 * Composable for fetching system information and event log health
 * Replaces parts of GlobalStore and EventLogStore with TanStack Query
 */
export function useSystemInfo() {
  const {
    data: systemData,
    isLoading,
    error,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['redfish', 'system', 'info'],
    queryFn: async (): Promise<SystemInfo> => {
      // Fetch system info and event logs in parallel
      const [systemResponse, eventLogResponse] = await Promise.all([
        api.get<SystemData>('/redfish/v1/Systems/system'),
        api.get<EventLogResponse>(
          '/redfish/v1/Systems/system/LogServices/EventLog/Entries',
        ),
      ]);

      const {
        AssetTag,
        Model,
        PowerState,
        SerialNumber,
        Status: { State } = {},
      } = systemResponse.data;

      let serverStatus = 'unreachable';
      if (State === 'Quiesced' || State === 'InTest') {
        // OpenBMC's host state interface is mapped to 2 Redfish
        // properties "Status""State" and "PowerState". Look first
        // at State for certain cases.
        serverStatus = serverStateMapper(State);
      } else if (PowerState) {
        serverStatus = serverStateMapper(PowerState);
      }

      // Store model type in localStorage for persistence
      if (Model) {
        localStorage.setItem('storedModelType', Model);
      }

      // Process event logs for health status
      const events = eventLogResponse.data.Members || [];
      const healthStatus = getHealthStatus(events, true);

      return {
        assetTag: AssetTag || null,
        modelType: Model || localStorage.getItem('storedModelType') || '--',
        serialNumber: SerialNumber || null,
        serverStatus,
        healthStatus,
        events,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    assetTag: computed(() => systemData.value?.assetTag ?? null),
    modelType: computed(() => systemData.value?.modelType ?? '--'),
    serialNumber: computed(() => systemData.value?.serialNumber ?? null),
    serverStatus: computed(
      () => systemData.value?.serverStatus ?? 'unreachable',
    ),
    healthStatus: computed(() => systemData.value?.healthStatus ?? ''),
    events: computed(() => systemData.value?.events ?? []),
    isLoading,
    error,
    isError,
    refetch,
  };
}
