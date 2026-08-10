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
const SUB_KEY = 'PowerSubsystem';

export interface PowerSupplyData {
  id: string;
  health: string | undefined;
  partNumber: string | undefined;
  serialNumber: string | undefined;
  firmwareVersion: string | undefined;
  identifyLed: boolean | undefined;
  locationNumber: string | undefined;
  model: string | undefined;
  name: string;
  sparePartNumber: string | undefined;
  status: string | undefined;
  uri: string;
  toggleDetails: boolean;
}

interface RawPowerSupply extends Resource {
  Status?: { Health?: string; State?: string };
  FirmwareVersion?: string;
  LocationIndicatorActive?: boolean;
  Location?: { PartLocation?: { ServiceLabel?: string } };
  Model?: string;
  PartNumber?: string;
  SerialNumber?: string;
  SparePartNumber?: string;
}

function processPowerSupply(item: RawPowerSupply): PowerSupplyData {
  const { Id, Status = {}, FirmwareVersion, LocationIndicatorActive, Location, Model, Name, PartNumber, SerialNumber, SparePartNumber } = item as any;
  return {
    id: Id,
    health: (Status as any).Health,
    partNumber: PartNumber,
    serialNumber: SerialNumber,
    firmwareVersion: FirmwareVersion,
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
 * Composable for fetching Power Supplies via Chassis → PowerSubsystem → PowerSupplies.
 * Uses the shared inventory preset and follows the useInventory pattern.
 */
export function usePowerSupplies() {
  const queryClient = useQueryClient();

  const { data: powerSuppliesRaw, isLoading, refetch } = useAllSubResources<RawPowerSupply>(
    PARENT_PATH,
    SUB_KEY,
    { queryConfig: RedfishQueryPresets.inventory },
  );

  const powerSupplies = ref<PowerSupplyData[]>([]);

  watch(powerSuppliesRaw, (raw) => {
    powerSupplies.value = raw ? raw.map(processPowerSupply) : [];
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

  return { powerSupplies, isLoading, refetch, updateIdentifyLed };
}
