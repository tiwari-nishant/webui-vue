import { computed, ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useRedfishCollection } from './useRedfishCollection';
// @ts-ignore - api.js is a JavaScript module
import api, { getResponseCount } from '@/store/api';
// @ts-ignore - i18n.js is a JavaScript module
import i18n from '@/i18n';
// @ts-ignore - GlobalConstants.js is a JavaScript module
import { REGEX_MAPPINGS } from '@/utilities/GlobalConstants';
// @ts-ignore - useToast is a JS module
import useToast from '@/components/Composables/useToastComposable';

// Base dump data interface (server data only)
export interface DumpData {
  data: string;
  dateTime: Date;
  dumpType: string;
  id: string;
  location: string;
  size: number;
  actions: Array<{ value: string }>;
}

// UI state interface (client-side state only)
export interface DumpUIState {
  // Add UI-specific properties here as needed
}

// Combined interface for the component
export interface ProcessedDump extends DumpData, DumpUIState {}

/**
 * Helper function to determine dump type based on ID and Name
 */
const getDumpType = (dump: any): string => {
  if (dump.Name === 'System Dump Entry') {
    if (dump.Id.startsWith('0')) return 'Hardware Dump Entry';
    if (dump.Id.startsWith('2')) return 'Hostboot Dump Entry';
    if (dump.Id.startsWith('3')) return 'SBE Dump Entry';
    if (dump.Id.startsWith('4')) return 'OCMB SBE Dump Entry';
    if (dump.Id.startsWith('A')) return 'System Dump Entry';
    if (dump.Id.startsWith('B')) return 'Resource Dump Entry';
    return dump.Name;
  }
  return dump.Name;
};

/**
 * Helper function to process dump entries (data only, no UI state)
 */
const processDump = (dump: any): DumpData => {
  return {
    data: dump.AdditionalDataURI,
    dateTime: new Date(dump.Created),
    dumpType: getDumpType(dump),
    id: dump.Id,
    location: dump['@odata.id'],
    size: dump.AdditionalDataSizeBytes,
    actions: [{ value: 'download' }, { value: 'delete' }],
  };
};

/**
 * Get default UI state for a new dump entry
 */
const getDefaultUIState = (): DumpUIState => {
  return {
    // Add defaults for other UI properties here
  };
};

/**
 * Composable for fetching and managing dumps
 * Replaces the DumpsStore with TanStack Query
 */
export function useDumps() {
  const queryClient = useQueryClient();
  const { successToast, errorToast, infoToast } = useToast();

  // Fetch BMC Dump Entries using useRedfishCollection
  const {
    data: bmcDumpsRaw,
    isLoading: isLoadingBmcDumps,
    error: bmcDumpsError,
    isError: isBmcDumpsError,
    refetch: refetchBmcDumps,
  } = useRedfishCollection<any>(
    '/redfish/v1/Managers/bmc/LogServices/Dump/Entries',
  );

  // Fetch System Dump Entries using useRedfishCollection
  const {
    data: systemDumpsRaw,
    isLoading: isLoadingSystemDumps,
    error: systemDumpsError,
    isError: isSystemDumpsError,
    refetch: refetchSystemDumps,
  } = useRedfishCollection<any>(
    '/redfish/v1/Systems/system/LogServices/Dump/Entries',
  );

  // Process the raw data into DumpData format
  const bmcDumpsData = computed(() => {
    if (!bmcDumpsRaw.value) return [];
    return bmcDumpsRaw.value.map(processDump);
  });

  const systemDumpsData = computed(() => {
    if (!systemDumpsRaw.value) return [];
    return systemDumpsRaw.value.map(processDump);
  });

  // Combined dumps - use ref to track deep changes to dump objects
  const allDumps = ref<ProcessedDump[]>([]);

  // Separate storage for data and UI state
  const dataMap = new Map<string, DumpData>();
  const uiStateMap = new Map<string, DumpUIState>();

  // Watch for changes and update allDumps ref while preserving UI state
  watch(
    [bmcDumpsData, systemDumpsData],
    ([bmcDumps, systemDumps]: [DumpData[], DumpData[]]) => {
      const newDumps: ProcessedDump[] = [];
      const allRawDumps = [...(bmcDumps || []), ...(systemDumps || [])];
      const currentLocations = new Set<string>();

      for (const rawDump of allRawDumps) {
        const location = rawDump.location;
        currentLocations.add(location);

        // Update or create data entry
        dataMap.set(location, rawDump);

        // Get or create UI state (preserves existing state)
        if (!uiStateMap.has(location)) {
          uiStateMap.set(location, getDefaultUIState());
        }

        // Combine data and UI state into a single object
        const combinedDump: ProcessedDump = {
          ...rawDump,
          ...uiStateMap.get(location)!,
        };

        newDumps.push(combinedDump);
      }

      // Clean up removed dumps
      for (const [location] of dataMap.entries()) {
        if (!currentLocations.has(location)) {
          dataMap.delete(location);
          uiStateMap.delete(location);
        }
      }

      allDumps.value = newDumps;
    },
    { immediate: true },
  );

  // Create BMC Dump mutation
  const createBmcDumpMutation = useMutation({
    mutationFn: async (dumpType: string) => {
      return await api.post(
        '/redfish/v1/Managers/bmc/LogServices/Dump/Actions/LogService.CollectDiagnosticData',
        {
          DiagnosticDataType: 'Manager',
        },
      );
    },
    onSuccess: () => {
      infoToast(i18n.global.t('pageDumps.toast.successStartDump'), {
        title: i18n.global.t('pageDumps.toast.successStartBmcDumpTitle'),
        timestamp: true,
      });
      queryClient.invalidateQueries({
        queryKey: [
          'redfish',
          'collection',
          '/redfish/v1/Managers/bmc/LogServices/Dump/Entries',
        ],
      });
    },
    onError: (error: any, dumpType: string) => {
      console.error(error);
      const errorMsg =
        error.response?.data?.error?.['@Message.ExtendedInfo']?.[0]?.MessageId;

      if (REGEX_MAPPINGS.resourceInUse.test(errorMsg)) {
        errorToast(
          i18n.global.t('pageDumps.toast.errorStartDumpAnotherInProgress', {
            dump: dumpType,
          }),
        );
      } else if (REGEX_MAPPINGS.resourceInStandby.test(errorMsg)) {
        errorToast(
          i18n.global.t('pageDumps.toast.errorStartDumpResourceInStandby', {
            dump: dumpType,
          }),
        );
      } else {
        errorToast(i18n.global.t('pageDumps.toast.errorStartBmcDump'));
      }
    },
  });

  // Create Resource Dump mutation
  const createResourceDumpMutation = useMutation({
    mutationFn: async ({
      resourceSelector,
      resourcePassword,
    }: {
      resourceSelector?: string;
      resourcePassword: string;
    }) => {
      const delay = (time: number) =>
        new Promise((resolve) => setTimeout(resolve, time));

      const response = await api.post(
        '/redfish/v1/Systems/system/LogServices/Dump/Actions/LogService.CollectDiagnosticData',
        {
          DiagnosticDataType: 'OEM',
          OEMDiagnosticDataType: `Resource_${resourceSelector || ''}_${resourcePassword}`,
        },
      );

      // A half second lag is needed while the backend runs a process
      await delay(500);
      const taskResponse = await api.get(response.data['@odata.id']);

      const messageId = taskResponse.data.Messages.filter(
        (message: any) =>
          REGEX_MAPPINGS.actionParameterUnknown.test(message.MessageId) ||
          REGEX_MAPPINGS.resourceAtUriUnauthorized.test(message.MessageId) ||
          REGEX_MAPPINGS.insufficientPrivilege.test(message.MessageId),
      )[0]?.MessageId;

      if (messageId) {
        throw messageId;
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'redfish',
          'collection',
          '/redfish/v1/Systems/system/LogServices/Dump/Entries',
        ],
      });
    },
    onError: (error: any) => {
      const errorMsg = error;

      if (
        REGEX_MAPPINGS.resourceInStandby.test(error.response?.data?.error?.code)
      ) {
        errorToast(i18n.global.t('pageDumps.toast.errorPhypInStandby'));
        return;
      }

      if (REGEX_MAPPINGS.actionParameterUnknown.test(errorMsg)) {
        errorToast(
          i18n.global.t(
            'pageDumps.toast.errorStartResourceDumpInvalidSelector',
          ),
        );
      } else if (REGEX_MAPPINGS.resourceAtUriUnauthorized.test(errorMsg)) {
        errorToast(
          i18n.global.t(
            'pageDumps.toast.errorStartResourceDumpInvalidPassword',
          ),
        );
      } else if (REGEX_MAPPINGS.insufficientPrivilege.test(errorMsg)) {
        errorToast(i18n.global.t('global.toast.unAuthDescription'));
      } else {
        errorToast(i18n.global.t('pageDumps.toast.errorStartResourceDump'));
      }
    },
  });

  // Create System Dump mutation
  const createSystemDumpMutation = useMutation({
    mutationFn: async (dumpType: string) => {
      return await api.post(
        '/redfish/v1/Systems/system/LogServices/Dump/Actions/LogService.CollectDiagnosticData',
        {
          DiagnosticDataType: 'OEM',
          OEMDiagnosticDataType: 'System',
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'redfish',
          'collection',
          '/redfish/v1/Systems/system/LogServices/Dump/Entries',
        ],
      });
    },
    onError: (error: any, dumpType: string) => {
      console.error(error);
      const errorMsg =
        error.response?.data?.error?.['@Message.ExtendedInfo']?.[0]?.MessageId;

      if (REGEX_MAPPINGS.resourceInUse.test(errorMsg)) {
        errorToast(
          i18n.global.t('pageDumps.toast.errorStartDumpAnotherInProgress', {
            dump: dumpType,
          }),
        );
      } else if (REGEX_MAPPINGS.resourceInStandby.test(errorMsg)) {
        errorToast(
          i18n.global.t('pageDumps.toast.errorStartDumpResourceInStandby', {
            dump: dumpType,
          }),
        );
      } else {
        errorToast(i18n.global.t('pageDumps.toast.errorStartBmcDump'));
      }
    },
  });

  // Delete dumps mutation
  const deleteDumpsMutation = useMutation({
    mutationFn: async (dumps: Array<{ location: string }>) => {
      const promises = dumps.map(({ location }) =>
        api.delete(location).catch((error) => {
          console.error(error);
          return error;
        }),
      );

      const responses = await api.all(promises);
      const { successCount, errorCount } = getResponseCount(responses);
      const toastMessages: Array<{ type: string; message: string }> = [];

      if (successCount) {
        const message = i18n.global.t(
          'pageDumps.toast.successDeleteDump',
          successCount,
        );
        toastMessages.push({ type: 'success', message });
      }

      if (errorCount) {
        const message = i18n.global.t(
          'pageDumps.toast.errorDeleteDump',
          errorCount,
        );
        toastMessages.push({ type: 'error', message });
      }

      return toastMessages;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'redfish',
          'collection',
          '/redfish/v1/Managers/bmc/LogServices/Dump/Entries',
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [
          'redfish',
          'collection',
          '/redfish/v1/Systems/system/LogServices/Dump/Entries',
        ],
      });
    },
  });

  // Delete all dumps mutation
  const deleteAllDumpsMutation = useMutation({
    mutationFn: async (totalDumpCount: number) => {
      await api.post(
        '/redfish/v1/Managers/bmc/LogServices/Dump/Actions/LogService.ClearLog',
      );
      return totalDumpCount;
    },
    onSuccess: (totalDumpCount: number) => {
      successToast(
        i18n.global.t('pageDumps.toast.successDeleteDump', totalDumpCount),
      );
      queryClient.invalidateQueries({
        queryKey: [
          'redfish',
          'collection',
          '/redfish/v1/Managers/bmc/LogServices/Dump/Entries',
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [
          'redfish',
          'collection',
          '/redfish/v1/Systems/system/LogServices/Dump/Entries',
        ],
      });
    },
    onError: (error: any, totalDumpCount: number) => {
      console.error(error);
      errorToast(
        i18n.global.t('pageDumps.toast.errorDeleteDump', totalDumpCount),
      );
    },
  });

  // Get task
  const getTask = async () => {
    return await api.get('/redfish/v1/TaskService/Tasks');
  };

  return {
    // Data
    bmcDumps: bmcDumpsData,
    systemDumps: systemDumpsData,
    allDumps,

    // Loading states
    isLoading: computed(
      () => isLoadingBmcDumps.value || isLoadingSystemDumps.value,
    ),
    isLoadingBmcDumps,
    isLoadingSystemDumps,

    // Error states
    isError: computed(() => isBmcDumpsError.value || isSystemDumpsError.value),
    error: computed(() => bmcDumpsError.value || systemDumpsError.value),

    // Mutations
    createBmcDump: createBmcDumpMutation.mutateAsync,
    createResourceDump: createResourceDumpMutation.mutateAsync,
    createSystemDump: createSystemDumpMutation.mutateAsync,
    deleteDumps: deleteDumpsMutation.mutateAsync,
    deleteAllDumps: deleteAllDumpsMutation.mutateAsync,
    getTask,

    // Mutation states
    isCreatingBmcDump: createBmcDumpMutation.isPending,
    isCreatingResourceDump: createResourceDumpMutation.isPending,
    isCreatingSystemDump: createSystemDumpMutation.isPending,
    isDeleting: computed(
      () =>
        deleteDumpsMutation.isPending.value ||
        deleteAllDumpsMutation.isPending.value,
    ),

    // Refetch functions
    refetchBmcDumps,
    refetchSystemDumps,
    refetchAll: async () => {
      await refetchBmcDumps();
      await refetchSystemDumps();
    },
  };
}

// Made with Bob
