import { computed, ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useRedfishCollection } from './useRedfishCollection';
import { usePatchResource } from './usePatchResource';
// @ts-ignore - api.js is a JavaScript module
import api from '@/store/api';
// @ts-ignore - i18n.js is a JavaScript module
import i18n from '@/i18n';
// @ts-ignore - GlobalConstants.js is a JavaScript module
import { REGEX_MAPPINGS } from '@/utilities/GlobalConstants';

// Base DIMM data interface (server data only)
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

// Base Core data interface (server data only)
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

// UI state interface (client-side state only)
export interface HardwareUIState {
  // Add UI-specific properties here as needed
}

// Combined interfaces for the component
export interface ProcessedDimm extends DimmData, HardwareUIState {}
export interface ProcessedCore extends CoreData, HardwareUIState {}

/**
 * Helper function to map message args to deconfiguration type
 */
const mapDeconfigurationType = (msgArgs: string): string => {
  const typeMap: Record<string, string> = {
    'By Association': i18n.global.t(
      'pageDeconfigurationHardware.table.filter.byAssociation',
    ),
    Error: i18n.global.t('pageDeconfigurationHardware.table.filter.error'),
    Fatal: i18n.global.t('pageDeconfigurationHardware.table.filter.fatal'),
    'FCO-Deconfigured': i18n.global.t(
      'pageDeconfigurationHardware.table.filter.fcoDeconfigured',
    ),
    Invalid: i18n.global.t('pageDeconfigurationHardware.table.filter.invalid'),
    Manual: i18n.global.t('pageDeconfigurationHardware.table.filter.manual'),
    None: i18n.global.t('pageDeconfigurationHardware.table.filter.none'),
    Predictive: i18n.global.t(
      'pageDeconfigurationHardware.table.filter.predictive',
    ),
    Recovered: i18n.global.t(
      'pageDeconfigurationHardware.table.filter.recovered',
    ),
    Unknown: i18n.global.t('pageDeconfigurationHardware.table.filter.unknown'),
  };

  return typeMap[msgArgs] || msgArgs;
};

/**
 * Helper function to extract event ID and message args from conditions
 */
const extractConditionData = (
  data: any,
): { msgArgs: string; eventId: string } => {
  let msgArgs = 'None';
  let eventId = '';

  const conditionsArray = data.Status?.Conditions;
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

/**
 * Composable for fetching and managing hardware deconfiguration (DIMMs and Cores)
 * Replaces the HardwareDeconfigurationStore with TanStack Query
 */
export function useHardwareDeconfiguration() {
  const queryClient = useQueryClient();
  const { patchResource } = usePatchResource();

  // Fetch Processors Collection (without $expand, fetch members individually)
  const {
    data: processorsRaw,
    isLoading: isLoadingProcessors,
    error: processorsError,
    isError: isProcessorsError,
    refetch: refetchProcessors,
  } = useRedfishCollection<any>('/redfish/v1/Systems/system/Processors');

  // Fetch Memory (DIMMs) Collection (without $expand, fetch members individually)
  const {
    data: memoryRaw,
    isLoading: isLoadingMemory,
    error: memoryError,
    isError: isMemoryError,
    refetch: refetchMemory,
  } = useRedfishCollection<any>('/redfish/v1/Systems/system/Memory');

  // Process DIMMs data - fetch each member individually
  const dimmsData = ref<DimmData[]>([]);
  const isProcessingDimms = ref(false);

  watch(
    memoryRaw,
    async (rawMemory) => {
      if (!rawMemory || rawMemory.length === 0) {
        dimmsData.value = [];
        return;
      }

      isProcessingDimms.value = true;
      try {
        // Fetch each DIMM's full data
        const promises = rawMemory.map((member: any) =>
          api.get(member['@odata.id']),
        );
        const responses = await api.all(promises);

        const processedDimms = responses
          .map(({ data }: any) => {
            const { msgArgs, eventId } = extractConditionData(data);

            return {
              id: data.Id,
              name: data.Name,
              functionalState: data.Status?.Health,
              size: data.CapacityMiB,
              locationCode: data.Location?.PartLocation?.ServiceLabel,
              deconfigurationType: mapDeconfigurationType(msgArgs),
              settings: data.Enabled,
              uri: data['@odata.id'],
              available: data.Status?.State,
              eventID: eventId,
            };
          })
          .filter((item: DimmData) => item.available !== 'Absent');

        dimmsData.value = processedDimms;
      } catch (error) {
        console.error('Error processing DIMMs:', error);
        dimmsData.value = [];
      } finally {
        isProcessingDimms.value = false;
      }
    },
    { immediate: true },
  );

  // Process Cores data - fetch each processor individually, then their SubProcessors
  const coresData = ref<CoreData[]>([]);
  const isProcessingCores = ref(false);

  watch(
    processorsRaw,
    async (rawProcessors) => {
      if (!rawProcessors || rawProcessors.length === 0) {
        coresData.value = [];
        return;
      }

      isProcessingCores.value = true;
      try {
        // First, fetch each processor's full data
        const processorPromises = rawProcessors.map((member: any) =>
          api.get(member['@odata.id']),
        );
        const processorResponses = await api.all(processorPromises);

        let totalCores: CoreData[] = [];

        // Then, for each processor, fetch its SubProcessors
        for (const { data: processor } of processorResponses) {
          const locationCode = processor.Location.PartLocation.ServiceLabel;
          const procId = processor.Id;

          try {
            const subProcessorsResponse = await api.get(
              `${processor['@odata.id']}/SubProcessors`,
            );
            const subProcessorMembers = subProcessorsResponse.data.Members;

            if (!subProcessorMembers || subProcessorMembers.length === 0)
              continue;

            // Fetch each SubProcessor's full data
            const corePromises = subProcessorMembers.map((member: any) =>
              api.get(member['@odata.id']),
            );
            const coreResponses = await api.all(corePromises);

            const coreData = coreResponses.map(({ data }: any) => {
              const { msgArgs, eventId } = extractConditionData(data);

              return {
                name: data.Name,
                status: data.Status.Health,
                id: data.Id,
                location: locationCode,
                functionalState: data.Status?.Health,
                settings: data.Enabled,
                uri: data['@odata.id'],
                deconfigurationType: mapDeconfigurationType(msgArgs),
                processorId: procId,
                eventID: eventId,
              };
            });

            totalCores = totalCores.concat(coreData);
          } catch (error) {
            console.error('Error fetching cores for processor:', error);
          }
        }

        coresData.value = totalCores;
      } catch (error) {
        console.error('Error processing cores:', error);
        coresData.value = [];
      } finally {
        isProcessingCores.value = false;
      }
    },
    { immediate: true },
  );

  // Update DIMM settings mutation
  const updateDimmSettingsMutation = useMutation({
    mutationFn: async (settingsState: { uri: string; settings: boolean }) => {
      try {
        await patchResource({
          endpoint: settingsState.uri,
          field: 'Enabled',
          value: settingsState.settings,
          invalidateQueries: [
            ['redfish', 'collection', '/redfish/v1/Systems/system/Memory'],
          ],
        });
      } catch (error: any) {
        console.error('error', error);
        const messageId =
          error.response?.data?.error?.['@Message.ExtendedInfo']?.[0]
            ?.MessageId;

        if (REGEX_MAPPINGS.resourceCannotBeDeleted.test(messageId)) {
          throw new Error(
            i18n.global.t('pageDeconfigurationHardware.toast.deleteReqFailed'),
          );
        } else if (settingsState.settings) {
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
    },
  });

  // Update Core settings mutation
  const updateCoreSettingsMutation = useMutation({
    mutationFn: async (settingsState: { uri: string; settings: boolean }) => {
      try {
        await patchResource({
          endpoint: settingsState.uri,
          field: 'Enabled',
          value: settingsState.settings,
          invalidateQueries: [
            ['redfish', 'collection', '/redfish/v1/Systems/system/Processors'],
          ],
        });
      } catch (error: any) {
        console.error('error', error);
        const messageId =
          error.response?.data?.error?.['@Message.ExtendedInfo']?.[0]
            ?.MessageId;

        if (REGEX_MAPPINGS.resourceCannotBeDeleted.test(messageId)) {
          throw new Error(
            i18n.global.t('pageDeconfigurationHardware.toast.deleteReqFailed'),
          );
        } else if (settingsState.settings) {
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
    },
  });

  return {
    // Data
    dimms: dimmsData,
    cores: coresData,

    // Loading states
    isLoadingDimms: computed(
      () => isLoadingMemory.value || isProcessingDimms.value,
    ),
    isLoadingCores: computed(
      () => isLoadingProcessors.value || isProcessingCores.value,
    ),
    isLoading: computed(
      () =>
        isLoadingMemory.value ||
        isLoadingProcessors.value ||
        isProcessingDimms.value ||
        isProcessingCores.value,
    ),

    // Error states
    isError: computed(() => isMemoryError.value || isProcessorsError.value),
    error: computed(() => memoryError.value || processorsError.value),

    // Mutations
    updateDimmSettings: updateDimmSettingsMutation.mutateAsync,
    updateCoreSettings: updateCoreSettingsMutation.mutateAsync,

    // Mutation states
    isUpdatingDimm: updateDimmSettingsMutation.isPending,
    isUpdatingCore: updateCoreSettingsMutation.isPending,

    // Refetch functions
    refetchDimms: refetchMemory,
    refetchCores: refetchProcessors,
    refetchAll: async () => {
      await refetchMemory();
      await refetchProcessors();
    },
  };
}
