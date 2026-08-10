import { ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore
import api from '@/store/api';
// @ts-ignore
import i18n from '@/i18n';
import { useRedfishCollection } from './useAllSubResources';
import { RedfishQueryPresets } from './shared/queryConfig';
import type { Chassis } from '@/types/redfish';

const COLLECTION_PATH = '/redfish/v1/Chassis';
const QUERY_KEY = ['redfish', 'collection', COLLECTION_PATH];

export interface ChassisInventoryData {
  id: string;
  health: string | undefined;
  statusState: string | undefined;
  name: string;
  identifyLed: boolean | undefined;
  uri: string;
  locationNumber: string | undefined;
  firmwareVersion: string | undefined;
  toggleDetails: boolean;
}

interface RawChassis extends Chassis {
  LocationIndicatorActive?: boolean;
  Location?: { PartLocation?: { ServiceLabel?: string } };
  Version?: string;
}

function processChassisInventory(item: RawChassis): ChassisInventoryData {
  const { Id, Status = {}, LocationIndicatorActive, Name, Location, Version } = item as any;
  return {
    id: Id,
    health: Status.Health,
    statusState: Status.State,
    name: Name,
    identifyLed: LocationIndicatorActive,
    uri: item['@odata.id'],
    locationNumber: Location?.PartLocation?.ServiceLabel,
    firmwareVersion: Version,
    toggleDetails: false,
  };
}

/**
 * Composable for fetching Chassis inventory data with TanStack Query.
 * Used by InventoryTableChassis. Follows the useInventory pattern.
 * Named useChassisInventory to distinguish from useInventory (which also fetches Chassis
 * but is used for tab navigation in the parent page).
 */
export function useChassisInventory() {
  const queryClient = useQueryClient();

  const { data: chassisRaw, isLoading, refetch } = useRedfishCollection<RawChassis>(
    COLLECTION_PATH,
    { queryConfig: RedfishQueryPresets.inventory },
  );

  const chassis = ref<ChassisInventoryData[]>([]);

  watch(chassisRaw, (raw) => {
    chassis.value = raw ? raw.map(processChassisInventory) : [];
  }, { immediate: true });

  const updateIdentifyLedMutation = useMutation({
    mutationFn: async ({ uri, identifyLed }: { uri: string; identifyLed: boolean }) => {
      await api.patch(uri, { LocationIndicatorActive: identifyLed });
      return identifyLed
        ? i18n.global.t('pageInventory.toast.successEnableIdentifyLed')
        : i18n.global.t('pageInventory.toast.successDisableIdentifyLed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const updateIdentifyLed = async (uri: string, identifyLed: boolean): Promise<string> => {
    try {
      return await updateIdentifyLedMutation.mutateAsync({ uri, identifyLed });
    } catch {
      throw new Error(
        identifyLed
          ? i18n.global.t('pageInventory.toast.errorEnableIdentifyLed')
          : i18n.global.t('pageInventory.toast.errorDisableIdentifyLed'),
      );
    }
  };

  return { chassis, isLoading, refetch, updateIdentifyLed };
}
