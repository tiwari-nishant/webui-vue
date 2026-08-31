import { computed } from 'vue';
// @ts-ignore - i18n.js is a JavaScript module
import i18n from '@/i18n';
import { useRedfishCollection } from './useRedfishCollection';
import { useAllSubResources } from './useAllSubResources';
import { usePatchResource } from './usePatchResource';
import { RedfishQueryPresets } from './shared/queryConfig';
// @ts-ignore - GlobalConstants.js is a JavaScript module
import { REGEX_MAPPINGS } from '@/utilities/GlobalConstants';
import { Processor } from '@/types/redfish';
export interface DimmData {
  id: string;
  name: string;
  functionalState: string;
  size: number;
  locationCode: string;
  deconfigurationType: string;
  settings: boolean;
  uri: string;
  available: string;
  eventID: string;
}

export interface CoreData {
  name: string;
  status: string;
  id: string;
  location: string;
  functionalState: string;
  settings: boolean;
  uri: string;
  deconfigurationType: string;
  processorId: string;
  eventID: string;
}

const mapDeconfigType = (msgArgs: string): string => {
  switch (msgArgs) {
    case 'By Association':
      return i18n.global.t(
        'pageDeconfigurationHardware.table.filter.byAssociation',
      );
    case 'Error':
      return i18n.global.t('pageDeconfigurationHardware.table.filter.error');
    case 'Fatal':
      return i18n.global.t('pageDeconfigurationHardware.table.filter.fatal');
    case 'FCO-Deconfigured':
      return i18n.global.t(
        'pageDeconfigurationHardware.table.filter.fcoDeconfigured',
      );
    case 'Invalid':
      return i18n.global.t('pageDeconfigurationHardware.table.filter.invalid');
    case 'Manual':
      return i18n.global.t('pageDeconfigurationHardware.table.filter.manual');
    case 'None':
      return i18n.global.t('pageDeconfigurationHardware.table.filter.none');
    case 'Predictive':
      return i18n.global.t(
        'pageDeconfigurationHardware.table.filter.predictive',
      );
    case 'Recovered':
      return i18n.global.t(
        'pageDeconfigurationHardware.table.filter.recovered',
      );
    case 'Unknown':
      return i18n.global.t('pageDeconfigurationHardware.table.filter.unknown');
    default:
      return msgArgs;
  }
};

const extractMsgArgsAndEventId = (data: any) => {
  let msgArgs = 'None';
  let eventId = '';
  const conditionsArray = data?.Status?.Conditions;
  if (Array.isArray(conditionsArray) && conditionsArray.length) {
    const messageArgsArray = conditionsArray[0].MessageArgs;
    if (Array.isArray(messageArgsArray) && messageArgsArray.length) {
      msgArgs = messageArgsArray[0];
    }
    const logEntry = conditionsArray[0].LogEntry;
    if (logEntry) {
      const eventIdUrl = logEntry['@odata.id'];
      const splitUrl = eventIdUrl.split('/');
      eventId = splitUrl[splitUrl.length - 1];
    }
  }
  return { msgArgs, eventId };
};

// Query key prefixes used for cache invalidation.
// useRedfishCollection registers: ['redfish', 'collection', path, { expand, expandLevels, select }]
// useAllSubResources registers:   ['redfish', 'allSubResources', parentPath, subKey]
// TanStack Query invalidateQueries does prefix-matching, so 3 segments is sufficient.
const DIMMS_QUERY_KEY = [
  'redfish',
  'collection',
  '/redfish/v1/Systems/system/Memory',
];

const CORES_QUERY_KEY = [
  'redfish',
  'allSubResources',
  '/redfish/v1/Systems/system/Processors',
  'SubProcessors',
];

export function useHardwareDeconfiguration() {
  const { patchResource, isPending: isUpdating } = usePatchResource();

  // ── DIMMs ──────────────────────────────────────────────────────────────────
  // Fetch the Memory collection with $expand=.($levels=2) so every member
  // already contains its Status.Conditions data in a single request.
  const {
    data: dimmsRaw,
    isLoading: isDimmsLoading,
    isRefetching: isDimmsRefetching,
    refetch: refetchDimms,
  } = useRedfishCollection<any>('/redfish/v1/Systems/system/Memory', {
    expand: true,
    expandLevels: 2,
    queryConfig: RedfishQueryPresets.hardwareDeconfiguration,
  });

  const dimms = computed<DimmData[]>(() => {
    if (!dimmsRaw.value) return [];
    return dimmsRaw.value
      .map((data: any) => {
        const { msgArgs, eventId } = extractMsgArgsAndEventId(data);
        return {
          id: data.Id,
          name: data.Name,
          functionalState: data.Status?.Health,
          size: data.CapacityMiB,
          locationCode: data.Location?.PartLocation?.ServiceLabel,
          deconfigurationType: mapDeconfigType(msgArgs),
          settings: data.Enabled,
          uri: data['@odata.id'],
          available: data.Status?.State,
          eventID: eventId,
        } as DimmData;
      })
      .filter((item: DimmData) => item.available !== 'Absent');
  });

  // ── Processor Cores ────────────────────────────────────────────────────────
  // useAllSubResources walks: /Systems/system/Processors (collection)
  //   → each processor's SubProcessors link → fetches each SubProcessors
  //     collection and returns all member resources.
  // The processors themselves (expanded at $levels=1 via useRedfishCollection
  // inside useAllSubResources) carry the Location we need, so we first fetch
  // the processors collection to build a processorId → locationCode map, then
  // fetch the sub-processors.
  const { data: processorsRaw, isLoading: isProcessorsLoading } =
    useRedfishCollection<any>('/redfish/v1/Systems/system/Processors', {
      expand: true,
      expandLevels: 1,
      queryConfig: RedfishQueryPresets.hardwareDeconfiguration,
    });

  const {
    data: subProcessorsRaw,
    isLoading: isSubProcessorsLoading,
    refetch: refetchCores,
  } = useAllSubResources<Processor>(
    '/redfish/v1/Systems/system/Processors',
    'SubProcessors',
    {
      queryConfig: RedfishQueryPresets.hardwareDeconfiguration,
    },
  );

  // Build a map from processor @odata.id prefix → { locationCode, processorId }
  // e.g. "/redfish/v1/Systems/system/Processors/CPU0" → { locationCode: "U78DA.ND1.xxx", processorId: "CPU0" }
  const processorInfoMap = computed<
    Map<string, { locationCode: string; processorId: string }>
  >(() => {
    const map = new Map<
      string,
      { locationCode: string; processorId: string }
    >();
    if (!processorsRaw.value) return map;
    for (const proc of processorsRaw.value) {
      const key = proc['@odata.id'] as string;
      map.set(key, {
        locationCode: proc.Location?.PartLocation?.ServiceLabel ?? '',
        processorId: proc.Id ?? '',
      });
    }
    return map;
  });

  const cores = computed<CoreData[]>(() => {
    if (!subProcessorsRaw.value) return [];
    return subProcessorsRaw.value.map((data: any) => {
      const { msgArgs, eventId } = extractMsgArgsAndEventId(data);
      // Sub-processor @odata.id is e.g. /redfish/v1/Systems/system/Processors/CPU0/SubProcessors/core0
      // Strip /SubProcessors/... to get the parent processor path.
      const subProcPath: string = data['@odata.id'] ?? '';
      const parentPath = subProcPath.split('/SubProcessors/')[0] ?? '';
      const procInfo = processorInfoMap.value.get(parentPath);

      return {
        name: data.Name,
        status: data.Status?.Health,
        id: data.Id,
        location: procInfo?.locationCode ?? '',
        functionalState: data.Status?.Health,
        settings: data.Enabled,
        uri: subProcPath,
        deconfigurationType: mapDeconfigType(msgArgs),
        processorId: procInfo?.processorId ?? '',
        eventID: eventId,
      } as CoreData;
    });
  });

  const isCoresLoading = computed(
    () => isProcessorsLoading.value || isSubProcessorsLoading.value,
  );

  // ── Patch helpers ──────────────────────────────────────────────────────────
  const updateSettingsState = async (uri: string, settings: boolean) => {
    try {
      await patchResource({
        endpoint: uri,
        field: 'Enabled',
        value: settings,
        invalidateQueries: [DIMMS_QUERY_KEY],
      });
    } catch (error: any) {
      const messageId =
        error?.response?.data?.error?.['@Message.ExtendedInfo']?.[0]?.MessageId;
      if (messageId && REGEX_MAPPINGS.resourceCannotBeDeleted.test(messageId)) {
        throw new Error(
          i18n.global.t('pageDeconfigurationHardware.toast.deleteReqFailed'),
        );
      } else if (settings) {
        throw new Error(
          i18n.global.t(
            'pageDeconfigurationHardware.toast.errorConfiguringDIMM',
          ),
        );
      } else {
        throw new Error(
          i18n.global.t(
            'pageDeconfigurationHardware.toast.errorDeconfiguringDIMM',
          ),
        );
      }
    }
  };

  const updateCoresSettingsState = async (uri: string, settings: boolean) => {
    try {
      await patchResource({
        endpoint: uri,
        field: 'Enabled',
        value: settings,
        invalidateQueries: [CORES_QUERY_KEY],
      });
    } catch (error: any) {
      const messageId =
        error?.response?.data?.error?.['@Message.ExtendedInfo']?.[0]?.MessageId;
      if (messageId && REGEX_MAPPINGS.resourceCannotBeDeleted.test(messageId)) {
        throw new Error(
          i18n.global.t('pageDeconfigurationHardware.toast.deleteReqFailed'),
        );
      } else if (settings) {
        throw new Error(
          i18n.global.t(
            'pageDeconfigurationHardware.toast.errorConfiguringProcessorCore',
          ),
        );
      } else {
        throw new Error(
          i18n.global.t(
            'pageDeconfigurationHardware.toast.errorDeconfiguringProcessorCore',
          ),
        );
      }
    }
  };

  return {
    dimms,
    isDimmsLoading,
    isDimmsRefetching,
    refetchDimms,

    cores,
    isCoresLoading,
    refetchCores,

    isUpdating,
    updateSettingsState,
    updateCoresSettingsState,
  };
}
