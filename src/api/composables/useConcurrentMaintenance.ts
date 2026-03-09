import { computed } from 'vue';
import { useAllSubResources } from './useAllSubResources';
import { usePatchResource } from './usePatchResource';
// @ts-ignore - i18n.js is a JavaScript module
import i18n from '@/i18n';
import type { Resource } from '@/types/redfish';

interface Assembly extends Resource {
  MemberId: string;
  Location?: {
    PartLocation?: {
      ServiceLabel?: string;
    };
  };
  Oem?: {
    OpenBMC?: {
      ReadyToRemove?: boolean;
    };
  };
}

export interface ConcurrentMaintenanceData {
  readyToRemove: boolean | null;
  todObject: Assembly | null;
  readyToRemoveControlPanel: boolean | null;
  controlPanel: Assembly | null;
  readyToRemoveControlPanelDisp: boolean | null;
  controlPanelDisp: Assembly | null;
}

/**
 * Composable for fetching and managing concurrent maintenance data
 * Replaces the ConcurrentMaintenanceStore with TanStack Query
 */
export function useConcurrentMaintenance() {
  const { patchResource, isPending: isUpdating } = usePatchResource();

  // Fetch assembly data from all chassis using useAllSubResources
  const {
    data: assembliesData,
    isLoading,
    error,
    isError,
    refetch,
  } = useAllSubResources<Assembly>('/redfish/v1/Chassis', 'Assembly');

  // Process assembly data to extract concurrent maintenance info
  const assemblyData = computed<ConcurrentMaintenanceData>(() => {
    if (!assembliesData.value) {
      return {
        readyToRemove: null,
        todObject: null,
        readyToRemoveControlPanel: null,
        controlPanel: null,
        readyToRemoveControlPanelDisp: null,
        controlPanelDisp: null,
      };
    }

    const result: ConcurrentMaintenanceData = {
      readyToRemove: null,
      todObject: null,
      readyToRemoveControlPanel: null,
      controlPanel: null,
      readyToRemoveControlPanelDisp: null,
      controlPanelDisp: null,
    };

    assembliesData.value.forEach((entry: Assembly) => {
      const hasReadyToRemove =
        entry?.Oem?.OpenBMC && 'ReadyToRemove' in entry.Oem.OpenBMC;
      const serviceLabel = entry?.Location?.PartLocation?.ServiceLabel;

      if (hasReadyToRemove && serviceLabel) {
        // TOD (P0-C0-E0)
        if (serviceLabel.endsWith('P0-C0-E0')) {
          result.todObject = entry;
          result.readyToRemove = entry.Oem?.OpenBMC?.ReadyToRemove ?? null;
        }
        // Control Panel (D0)
        else if (serviceLabel.endsWith('D0')) {
          result.controlPanel = entry;
          result.readyToRemoveControlPanel =
            entry.Oem?.OpenBMC?.ReadyToRemove ?? null;
        }
        // Control Panel Display (D1)
        else if (serviceLabel.endsWith('D1')) {
          result.controlPanelDisp = entry;
          result.readyToRemoveControlPanelDisp =
            entry.Oem?.OpenBMC?.ReadyToRemove ?? null;
        }
      }
    });

    return result;
  });

  // Helper function to update ReadyToRemove state
  const updateReadyToRemove = async (
    assemblyPath: string,
    memberId: string,
    state: boolean,
  ) => {
    try {
      await patchResource({
        endpoint: assemblyPath,
        field: 'Assemblies',
        value: [
          {
            MemberId: memberId,
            Oem: {
              OpenBMC: {
                ReadyToRemove: state,
              },
            },
          },
        ],
        invalidateQueries: [
          ['redfish', 'allSubResources', '/redfish/v1/Chassis', 'Assembly'],
        ],
      });

      return i18n.global.t(
        'pageConcurrentMaintenance.toast.successSaveReadyToRemove',
        {
          state: state ? 'enabled' : 'disabled',
        },
      );
    } catch (error) {
      console.error('Error updating ReadyToRemove:', error);
      throw new Error(
        i18n.global.t(
          'pageConcurrentMaintenance.toast.errorSaveReadyToRemove',
          {
            state: state ? 'enabling' : 'disabling',
          },
        ),
      );
    }
  };

  // Helper functions for updating each component
  const updateTodState = async (state: boolean) => {
    if (!assemblyData.value?.todObject?.MemberId) {
      throw new Error('TOD object not found');
    }
    if (!assemblyData.value?.todObject?.['@odata.id']) {
      throw new Error('TOD object path not found');
    }
    // Extract the Assembly path from the object's @odata.id
    const assemblyPath =
      assemblyData.value.todObject['@odata.id'].split('/Assemblies/')[0];
    return updateReadyToRemove(
      assemblyPath,
      assemblyData.value.todObject.MemberId,
      state,
    );
  };

  const updateControlPanelState = async (state: boolean) => {
    if (!assemblyData.value?.controlPanel?.MemberId) {
      throw new Error('Control Panel object not found');
    }
    if (!assemblyData.value?.controlPanel?.['@odata.id']) {
      throw new Error('Control Panel object path not found');
    }
    // Extract the Assembly path from the object's @odata.id
    const assemblyPath =
      assemblyData.value.controlPanel['@odata.id'].split('/Assemblies/')[0];
    return updateReadyToRemove(
      assemblyPath,
      assemblyData.value.controlPanel.MemberId,
      state,
    );
  };

  const updateControlPanelDispState = async (state: boolean) => {
    if (!assemblyData.value?.controlPanelDisp?.MemberId) {
      throw new Error('Control Panel Display object not found');
    }
    if (!assemblyData.value?.controlPanelDisp?.['@odata.id']) {
      throw new Error('Control Panel Display object path not found');
    }
    // Extract the Assembly path from the object's @odata.id
    const assemblyPath =
      assemblyData.value.controlPanelDisp['@odata.id'].split('/Assemblies/')[0];
    return updateReadyToRemove(
      assemblyPath,
      assemblyData.value.controlPanelDisp.MemberId,
      state,
    );
  };

  return {
    // Data
    readyToRemove: computed(() => assemblyData.value?.readyToRemove ?? null),
    readyToRemoveControlPanel: computed(
      () => assemblyData.value?.readyToRemoveControlPanel ?? null,
    ),
    readyToRemoveControlPanelDisp: computed(
      () => assemblyData.value?.readyToRemoveControlPanelDisp ?? null,
    ),

    // Loading states
    isLoading,
    isUpdating,

    // Error states
    error,
    isError,

    // Actions
    refetch,
    updateTodState,
    updateControlPanelState,
    updateControlPanelDispState,
  };
}
