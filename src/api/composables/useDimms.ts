import { ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore
import api from '@/store/api';
// @ts-ignore
import i18n from '@/i18n';
import { useRedfishCollection } from './useAllSubResources';
import { RedfishQueryPresets } from './shared/queryConfig';
import type { Resource } from '@/types/redfish';

const COLLECTION_PATH = '/redfish/v1/Systems/system/Memory';
const QUERY_KEY = ['redfish', 'collection', COLLECTION_PATH];

export interface DimmData {
  id: string;
  health: string | undefined;
  capacityMiB: number | undefined;
  enabled: boolean | undefined;
  name: string;
  partNumber: string | undefined;
  serialNumber: string | undefined;
  status: string | undefined;
  sparePartNumber: string | undefined;
  model: string | undefined;
  identifyLed: boolean | undefined;
  uri: string;
  locationNumber: string | undefined;
  toggleDetails: boolean;
}

interface RawMemory extends Resource {
  Status?: { Health?: string; State?: string };
  CapacityMiB?: number;
  Enabled?: boolean;
  PartNumber?: string;
  SerialNumber?: string;
  SparePartNumber?: string;
  Model?: string;
  LocationIndicatorActive?: boolean;
  Location?: { PartLocation?: { ServiceLabel?: string } };
}

function processMemory(item: RawMemory): DimmData {
  const { Id, Status = {}, CapacityMiB, Enabled, Name, PartNumber, SerialNumber, SparePartNumber, Model, LocationIndicatorActive, Location } = item;
  return {
    id: Id,
    health: Status.Health,
    capacityMiB: CapacityMiB,
    enabled: Enabled,
    name: Name,
    partNumber: PartNumber,
    serialNumber: SerialNumber,
    status: Status.State === 'Enabled' ? 'Present' : Status.State,
    sparePartNumber: SparePartNumber,
    model: Model,
    identifyLed: LocationIndicatorActive,
    uri: item['@odata.id'],
    locationNumber: Location?.PartLocation?.ServiceLabel,
    toggleDetails: false,
  };
}

/**
 * Composable for fetching DIMM memory slots with TanStack Query.
 * Uses the shared inventory preset and follows the useInventory pattern.
 */
export function useDimms() {
  const queryClient = useQueryClient();

  const { data: dimmsRaw, isLoading, refetch } = useRedfishCollection<RawMemory>(COLLECTION_PATH, {
    queryConfig: RedfishQueryPresets.inventory,
  });

  const dimms = ref<DimmData[]>([]);

  watch(dimmsRaw, (raw) => {
    dimms.value = raw ? raw.map(processMemory) : [];
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

  return { dimms, isLoading, refetch, updateIdentifyLed };
}
