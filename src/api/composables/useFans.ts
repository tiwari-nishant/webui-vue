import { ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore
import api from '@/store/api';
// @ts-ignore
import i18n from '@/i18n';
import { useAllSubResources } from './useAllSubResources';
import { RedfishQueryPresets } from './shared/queryConfig';
import type { Resource } from '@/types/redfish';

const PARENT_PATH = '/redfish/v1/Chassis';
const SUB_KEY = 'ThermalSubsystem';

export interface FanData {
  id: string;
  health: string | undefined;
  partNumber: string | undefined;
  serialNumber: string | undefined;
  identifyLed: boolean | undefined;
  locationNumber: string | undefined;
  model: string | undefined;
  name: string;
  sparePartNumber: string | undefined;
  status: string | undefined;
  uri: string;
  toggleDetails: boolean;
}

interface RawFan extends Resource {
  Status?: { Health?: string; State?: string };
  LocationIndicatorActive?: boolean;
  Location?: { PartLocation?: { ServiceLabel?: string } };
  Model?: string;
  PartNumber?: string;
  SerialNumber?: string;
  SparePartNumber?: string;
}

function processFan(item: RawFan): FanData {
  const { Id, Status = {}, LocationIndicatorActive, Location, Model, Name, PartNumber, SerialNumber, SparePartNumber } = item as any;
  return {
    id: Id,
    health: (Status as any).Health,
    partNumber: PartNumber,
    serialNumber: SerialNumber,
    identifyLed: LocationIndicatorActive,
    locationNumber: Location?.PartLocation?.ServiceLabel,
    model: Model,
    name: Name,
    sparePartNumber: SparePartNumber,
    status: (Status as any).State === 'Enabled' ? 'Present' : (Status as any).State,
    uri: item['@odata.id'],
    toggleDetails: false,
  };
}

/**
 * Composable for fetching Fans via Chassis → ThermalSubsystem → Fans with TanStack Query.
 * Uses the shared inventory preset and follows the useInventory pattern.
 */
export function useFans() {
  const queryClient = useQueryClient();

  const { data: fansRaw, isLoading, refetch } = useAllSubResources<RawFan>(
    PARENT_PATH,
    SUB_KEY,
    { queryConfig: RedfishQueryPresets.inventory },
  );

  const fans = ref<FanData[]>([]);

  watch(fansRaw, (raw) => {
    fans.value = raw ? raw.map(processFan) : [];
  }, { immediate: true });

  const updateIdentifyLedMutation = useMutation({
    mutationFn: async ({ uri, identifyLed }: { uri: string; identifyLed: boolean }) => {
      await api.patch(uri, { LocationIndicatorActive: identifyLed });
      return identifyLed
        ? i18n.global.t('pageInventory.toast.successEnableIdentifyLed')
        : i18n.global.t('pageInventory.toast.successDisableIdentifyLed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redfish', 'allSubResources', PARENT_PATH, SUB_KEY] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['redfish', 'allSubResources', PARENT_PATH, SUB_KEY] });
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

  return { fans, isLoading, refetch, updateIdentifyLed };
}
