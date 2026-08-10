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
const SUB_KEY = 'Assembly';

export interface AssemblyItemData {
  id: string;
  health: string | undefined;
  partNumber: string | undefined;
  serialNumber: string | undefined;
  sparePartNumber: string | undefined;
  model: string | undefined;
  name: string;
  locationNumber: string | undefined;
  identifyLed: boolean | undefined;
  status: string | undefined;
  uri: string;
  toggleDetails: boolean;
}

interface RawAssembly extends Resource {
  MemberId?: string;
  Status?: { Health?: string; State?: string };
  PartNumber?: string;
  SerialNumber?: string;
  SparePartNumber?: string;
  Model?: string;
  Location?: { PartLocation?: { ServiceLabel?: string } };
  LocationIndicatorActive?: boolean;
}

function processAssembly(item: RawAssembly): AssemblyItemData {
  const { MemberId, Id, Status, PartNumber, SerialNumber, SparePartNumber, Model, Name, Location, LocationIndicatorActive } = item as any;
  return {
    id: MemberId ?? Id,
    health: Status?.Health,
    partNumber: PartNumber,
    serialNumber: SerialNumber,
    sparePartNumber: SparePartNumber,
    model: Model,
    name: Name,
    locationNumber: Location?.PartLocation?.ServiceLabel,
    identifyLed: LocationIndicatorActive,
    status: Status?.State === 'Enabled' ? 'Present' : Status?.State,
    uri: item['@odata.id'],
    toggleDetails: false,
  };
}

/**
 * Composable for fetching Assembly data via Chassis → Assembly with TanStack Query.
 * Uses the shared inventory preset and follows the useInventory pattern.
 */
export function useAssembly() {
  const queryClient = useQueryClient();

  const { data: assemblyRaw, isLoading, refetch } = useAllSubResources<RawAssembly>(
    PARENT_PATH,
    SUB_KEY,
    { queryConfig: RedfishQueryPresets.inventory },
  );

  const assemblies = ref<AssemblyItemData[]>([]);

  watch(assemblyRaw, (raw) => {
    assemblies.value = raw ? raw.map(processAssembly) : [];
  }, { immediate: true });

  const updateIdentifyLedMutation = useMutation({
    mutationFn: async ({ uri, memberId, identifyLed }: { uri: string; memberId: string; identifyLed: boolean }) => {
      await api.patch(uri, {
        Assemblies: [{ MemberId: memberId, LocationIndicatorActive: identifyLed }],
      });
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

  const updateIdentifyLed = async (uri: string, memberId: string, identifyLed: boolean): Promise<string> => {
    try {
      return await updateIdentifyLedMutation.mutateAsync({ uri, memberId, identifyLed });
    } catch {
      throw new Error(
        identifyLed
          ? i18n.global.t('pageInventory.toast.errorEnableIdentifyLed')
          : i18n.global.t('pageInventory.toast.errorDisableIdentifyLed'),
      );
    }
  };

  return { assemblies, isLoading, refetch, updateIdentifyLed };
}
