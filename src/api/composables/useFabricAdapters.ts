import { ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore
import api from '@/store/api';
// @ts-ignore
import i18n from '@/i18n';
import { useRedfishCollection } from './useAllSubResources';
import { RedfishQueryPresets } from './shared/queryConfig';
import type { Resource } from '@/types/redfish';

const COLLECTION_PATH = '/redfish/v1/Systems/system/FabricAdapters';
const QUERY_KEY = ['redfish', 'collection', COLLECTION_PATH];

export interface FabricAdapterData {
  id: string;
  health: string | undefined;
  identifyLed: boolean | undefined;
  locationNumber: string | undefined;
  model: string | undefined;
  name: string;
  partNumber: string | undefined;
  serialNumber: string | undefined;
  sparePartNumber: string | undefined;
  status: string | undefined;
  uri: string;
  toggleDetails: boolean;
}

interface RawFabricAdapter extends Resource {
  Status?: { Health?: string; State?: string };
  LocationIndicatorActive?: boolean;
  Location?: { PartLocation?: { ServiceLabel?: string } };
  Model?: string;
  PartNumber?: string;
  SerialNumber?: string;
  SparePartNumber?: string;
}

function processFabricAdapter(item: RawFabricAdapter): FabricAdapterData {
  const { Id, Status, LocationIndicatorActive, Location, Model, Name, PartNumber, SerialNumber, SparePartNumber } = item as any;
  return {
    id: Id,
    health: Status?.Health,
    identifyLed: LocationIndicatorActive,
    locationNumber: Location?.PartLocation?.ServiceLabel,
    model: Model,
    name: Name,
    partNumber: PartNumber,
    serialNumber: SerialNumber,
    sparePartNumber: SparePartNumber,
    status: Status?.State === 'Enabled' ? 'Present' : Status?.State,
    uri: item['@odata.id'],
    toggleDetails: false,
  };
}

/**
 * Composable for fetching Fabric Adapters with TanStack Query.
 * Uses the shared inventory preset and follows the useInventory pattern.
 */
export function useFabricAdapters() {
  const queryClient = useQueryClient();

  const { data: fabricAdaptersRaw, isLoading, refetch } = useRedfishCollection<RawFabricAdapter>(
    COLLECTION_PATH,
    { queryConfig: RedfishQueryPresets.inventory },
  );

  const fabricAdapters = ref<FabricAdapterData[]>([]);

  watch(fabricAdaptersRaw, (raw) => {
    fabricAdapters.value = raw ? raw.map(processFabricAdapter) : [];
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

  return { fabricAdapters, isLoading, refetch, updateIdentifyLed };
}
