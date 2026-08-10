import { ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore
import api from '@/store/api';
// @ts-ignore
import i18n from '@/i18n';
import { useRedfishCollection } from './useAllSubResources';
import { RedfishQueryPresets } from './shared/queryConfig';
import type { Processor } from '@/types/redfish';

const COLLECTION_PATH = '/redfish/v1/Systems/system/Processors';
const QUERY_KEY = ['redfish', 'collection', COLLECTION_PATH];

export interface ProcessorData {
  id: string;
  health: string | undefined;
  partNumber: string | undefined;
  sparePartNumber: string | undefined;
  serialNumber: string | undefined;
  status: string | undefined;
  model: string | undefined;
  name: string;
  processorType: string | undefined;
  totalCores: number | undefined;
  locationNumber: string | undefined;
  identifyLed: boolean | undefined;
  uri: string;
  toggleDetails: boolean;
}

interface RawProcessor extends Processor {
  PartNumber?: string;
  SerialNumber?: string;
  SparePartNumber?: string;
  LocationIndicatorActive?: boolean;
  Location?: { PartLocation?: { ServiceLabel?: string } };
}

function processProcessor(item: RawProcessor): ProcessorData {
  const { Id, Status = {}, PartNumber, SerialNumber, SparePartNumber, Model, Name, ProcessorType, TotalCores, Location, LocationIndicatorActive } = item as any;
  return {
    id: Id,
    health: (Status as any).Health,
    partNumber: PartNumber,
    sparePartNumber: SparePartNumber,
    serialNumber: SerialNumber,
    status: (Status as any).State === 'Enabled' ? 'Present' : (Status as any).State,
    model: Model,
    name: Name,
    processorType: ProcessorType,
    totalCores: TotalCores,
    locationNumber: Location?.PartLocation?.ServiceLabel,
    identifyLed: LocationIndicatorActive,
    uri: item['@odata.id'],
    toggleDetails: false,
  };
}

/**
 * Composable for fetching Processors with TanStack Query.
 * Uses the shared inventory preset and follows the useInventory pattern.
 */
export function useProcessors() {
  const queryClient = useQueryClient();

  const { data: processorsRaw, isLoading, refetch } = useRedfishCollection<RawProcessor>(COLLECTION_PATH, {
    queryConfig: RedfishQueryPresets.inventory,
  });

  const processors = ref<ProcessorData[]>([]);

  watch(processorsRaw, (raw) => {
    processors.value = raw ? raw.map(processProcessor) : [];
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

  return { processors, isLoading, refetch, updateIdentifyLed };
}
