import { ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore
import api from '@/store/api';
// @ts-ignore
import i18n from '@/i18n';
import { useRedfishCollection } from './useAllSubResources';
import { RedfishQueryPresets } from './shared/queryConfig';
import type { Manager } from '@/types/redfish';

const COLLECTION_PATH = '/redfish/v1/Managers';
const QUERY_KEY = ['redfish', 'collection', COLLECTION_PATH];

export interface BmcData {
  dateTime: Date | undefined;
  description: string | undefined;
  health: string | undefined;
  id: string;
  identifyLed: boolean | undefined;
  locationNumber: string | undefined;
  model: string | undefined;
  name: string;
  partNumber: string | undefined;
  powerState: string | undefined;
  serialNumber: string | undefined;
  sparePartNumber: string | undefined;
  statusState: string | undefined;
  uri: string;
  toggleDetails: boolean;
}

interface RawManager extends Manager {
  DateTime?: string;
  LocationIndicatorActive?: boolean;
  Location?: { PartLocation?: { ServiceLabel?: string } };
  PartNumber?: string;
  SparePartNumber?: string;
}

function processBmc(item: RawManager): BmcData {
  return {
    dateTime: item.DateTime ? new Date(item.DateTime) : undefined,
    description: item.Description,
    health: item.Status?.Health,
    id: item.Id,
    identifyLed: item.LocationIndicatorActive,
    locationNumber: item.Location?.PartLocation?.ServiceLabel,
    model: item.Model,
    name: item.Name,
    partNumber: item.PartNumber,
    powerState: (item as any).PowerState,
    serialNumber: item.SerialNumber,
    sparePartNumber: item.SparePartNumber,
    statusState: item.Status?.State,
    uri: item['@odata.id'],
    toggleDetails: false,
  };
}

/**
 * Composable for fetching BMC Manager data with TanStack Query.
 * Uses the shared inventory preset and follows the useInventory pattern.
 */
export function useBmc() {
  const queryClient = useQueryClient();

  const { data: bmcRaw, isLoading, refetch } = useRedfishCollection<RawManager>(
    COLLECTION_PATH,
    { queryConfig: RedfishQueryPresets.inventory },
  );

  const bmc = ref<BmcData | null>(null);

  watch(bmcRaw, (raw) => {
    bmc.value = raw && raw.length > 0 ? processBmc(raw[0]) : null;
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

  return { bmc, isLoading, refetch, updateIdentifyLed };
}
