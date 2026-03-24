import { computed, ref, watch } from 'vue';
import { useMutation, useQueryClient, useQuery } from '@tanstack/vue-query';
// @ts-ignore - api.js is a JavaScript module
import api, { getResponseCount } from '@/store/api';
// @ts-ignore - i18n.js is a JavaScript module
import i18n from '@/i18n';
// @ts-ignore - GlobalConstants.js is a JavaScript module
import { REGEX_MAPPINGS } from '@/utilities/GlobalConstants';

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
 * Helper function to process dump entries
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
 * Composable for fetching and managing dumps
 * Replaces the DumpsStore with TanStack Query
 */
export function useDumps() {
  const queryClient = useQueryClient();

  // Fetch BMC Dump Entries
  const fetchBmcDumpEntries = async () => {
    try {
      const rootResponse = await api.get('/redfish/v1/');
      const managersResponse = await api.get(
        rootResponse.data.Managers['@odata.id'],
      );
      const bmcResponse = await api.get(
        `${managersResponse.data['@odata.id']}/bmc`,
      );
      const logServicesResponse = await api.get(
        bmcResponse.data.LogServices['@odata.id'],
      );
      const dumpResponse = await api.get(
        `${logServicesResponse.data['@odata.id']}/Dump`,
      );
      const entriesResponse = await api.get(
        dumpResponse.data.Entries['@odata.id'],
      );
      return entriesResponse.data?.Members || [];
    } catch (error) {
      console.error('Error fetching BMC dump entries:', error);
      return [];
    }
  };

  // Fetch System Dump Entries
  const fetchSystemDumpEntries = async () => {
    try {
      const rootResponse = await api.get('/redfish/v1/');
      const systemsResponse = await api.get(
        rootResponse.data.Systems['@odata.id'],
      );
      const systemResponse = await api.get(
        `${systemsResponse.data['@odata.id']}/system`,
      );
      const logServicesResponse = await api.get(
        systemResponse.data.LogServices['@odata.id'],
      );
      const dumpResponse = await api.get(
        `${logServicesResponse.data['@odata.id']}/Dump`,
      );
      const entriesResponse = await api.get(
        dumpResponse.data.Entries['@odata.id'],
      );
      return entriesResponse.data?.Members || [];
    } catch (error) {
      console.error('Error fetching system dump entries:', error);
      return [];
    }
  };

  // Fetch all dumps using useQuery
  const {
    data: dumpsRaw,
    isLoading,
    error,
    isError,
    refetch: refetchDumps,
  } = useQuery({
    queryKey: ['dumps', 'all'],
    queryFn: async () => {
      const [bmcDumps, systemDumps] = await Promise.all([
        fetchBmcDumpEntries(),
        fetchSystemDumpEntries(),
      ]);
      return [...bmcDumps, ...systemDumps];
    },
  });

  // Process dumps data
  const allDumps = computed(() => {
    if (!dumpsRaw.value) return [];
    return dumpsRaw.value.map(processDump);
  });

  // Create BMC Dump mutation
  const createBmcDumpMutation = useMutation({
    mutationFn: async (dumpType: string) => {
      try {
        await api.post(
          '/redfish/v1/Managers/bmc/LogServices/Dump/Actions/LogService.CollectDiagnosticData',
          {
            DiagnosticDataType: 'Manager',
          },
        );
      } catch (error: any) {
        console.error(error);
        const errorMsg =
          error.response?.data?.error?.['@Message.ExtendedInfo']?.[0]
            ?.MessageId;

        if (REGEX_MAPPINGS.resourceInUse.test(errorMsg)) {
          throw new Error(
            i18n.global.t('pageDumps.toast.errorStartDumpAnotherInProgress', {
              dump: dumpType,
            }),
          );
        } else if (REGEX_MAPPINGS.resourceInStandby.test(errorMsg)) {
          throw new Error(
            i18n.global.t('pageDumps.toast.errorStartDumpResourceInStandby', {
              dump: dumpType,
            }),
          );
        } else {
          throw new Error(i18n.global.t('pageDumps.toast.errorStartBmcDump'));
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dumps', 'all'] });
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

      try {
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
      } catch (error: any) {
        const errorMsg = error;

        if (
          REGEX_MAPPINGS.resourceInStandby.test(
            error.response?.data?.error?.code,
          )
        ) {
          throw new Error(i18n.global.t('pageDumps.toast.errorPhypInStandby'));
        }

        if (REGEX_MAPPINGS.actionParameterUnknown.test(errorMsg)) {
          throw new Error(
            i18n.global.t(
              'pageDumps.toast.errorStartResourceDumpInvalidSelector',
            ),
          );
        } else if (REGEX_MAPPINGS.resourceAtUriUnauthorized.test(errorMsg)) {
          throw new Error(
            i18n.global.t(
              'pageDumps.toast.errorStartResourceDumpInvalidPassword',
            ),
          );
        } else if (REGEX_MAPPINGS.insufficientPrivilege.test(errorMsg)) {
          throw new Error(i18n.global.t('global.toast.unAuthDescription'));
        } else {
          throw new Error(
            i18n.global.t('pageDumps.toast.errorStartResourceDump'),
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dumps', 'all'] });
    },
  });

  // Create System Dump mutation
  const createSystemDumpMutation = useMutation({
    mutationFn: async (dumpType: string) => {
      try {
        await api.post(
          '/redfish/v1/Systems/system/LogServices/Dump/Actions/LogService.CollectDiagnosticData',
          {
            DiagnosticDataType: 'OEM',
            OEMDiagnosticDataType: 'System',
          },
        );
      } catch (error: any) {
        console.error(error);
        const errorMsg =
          error.response?.data?.error?.['@Message.ExtendedInfo']?.[0]
            ?.MessageId;

        if (REGEX_MAPPINGS.resourceInUse.test(errorMsg)) {
          throw new Error(
            i18n.global.t('pageDumps.toast.errorStartDumpAnotherInProgress', {
              dump: dumpType,
            }),
          );
        } else if (REGEX_MAPPINGS.resourceInStandby.test(errorMsg)) {
          throw new Error(
            i18n.global.t('pageDumps.toast.errorStartDumpResourceInStandby', {
              dump: dumpType,
            }),
          );
        } else {
          throw new Error(i18n.global.t('pageDumps.toast.errorStartBmcDump'));
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dumps', 'all'] });
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
      queryClient.invalidateQueries({ queryKey: ['dumps', 'all'] });
    },
  });

  // Delete all dumps mutation
  const deleteAllDumpsMutation = useMutation({
    mutationFn: async (totalDumpCount: number) => {
      try {
        await api.post(
          '/redfish/v1/Managers/bmc/LogServices/Dump/Actions/LogService.ClearLog',
        );
        return i18n.global.t(
          'pageDumps.toast.successDeleteDump',
          totalDumpCount,
        );
      } catch (error) {
        console.error(error);
        throw new Error(
          i18n.global.t('pageDumps.toast.errorDeleteDump', totalDumpCount),
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dumps', 'all'] });
    },
  });

  // Get task
  const getTask = async () => {
    return await api.get('/redfish/v1/TaskService/Tasks');
  };

  return {
    // Data
    allDumps,

    // Loading states
    isLoading,

    // Error states
    isError,
    error,

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
    refetchDumps,
  };
}
