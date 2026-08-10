import { ref, watch } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore
import api from '@/store/api';
// @ts-ignore
import i18n from '@/i18n';
import { useRedfishCollection } from './useAllSubResources';
import { RedfishQueryPresets } from './shared/queryConfig';
import type { System } from '@/types/redfish';

const COLLECTION_PATH = '/redfish/v1/Systems';
const QUERY_KEY = ['redfish', 'collection', COLLECTION_PATH];

export interface SystemData {
  assetTag: string | undefined;
  name: string;
  health: string | undefined;
  totalSystemMemoryGiB: number | undefined;
  id: string;
  lampTest: boolean | undefined;
  sysAttentionLed: boolean | undefined;
  locationIndicatorActive: boolean | undefined;
  model: string | undefined;
  processorSummaryCoreCount: number | undefined;
  processorSummaryCount: number | undefined;
  powerState: string | undefined;
  serialNumber: string | undefined;
  statusState: string | undefined;
  uri: string;
  toggleDetails: boolean;
}

interface RawSystem extends System {
  AssetTag?: string;
  LocationIndicatorActive?: boolean;
  Oem?: {
    IBM?: {
      LampTest?: boolean;
      PartitionSystemAttentionIndicator?: boolean;
      PlatformSystemAttentionIndicator?: boolean;
    };
  };
  ProcessorSummary?: { Count?: number; CoreCount?: number };
}

function processSystem(item: RawSystem): SystemData {
  return {
    assetTag: item.AssetTag,
    name: item.Name,
    health: item.Status?.Health,
    totalSystemMemoryGiB: item.MemorySummary?.TotalSystemMemoryGiB,
    id: item.Id,
    lampTest: item.Oem?.IBM?.LampTest,
    sysAttentionLed:
      item.Oem?.IBM?.PartitionSystemAttentionIndicator ??
      item.Oem?.IBM?.PlatformSystemAttentionIndicator,
    locationIndicatorActive: item.LocationIndicatorActive,
    model: item.Model,
    processorSummaryCoreCount: (item.ProcessorSummary as any)?.CoreCount,
    processorSummaryCount: item.ProcessorSummary?.Count,
    powerState: item.PowerState,
    serialNumber: item.SerialNumber,
    statusState: item.Status?.State,
    uri: item['@odata.id'],
    toggleDetails: false,
  };
}

/**
 * Composable for fetching System data with TanStack Query.
 * Uses the shared inventory preset and follows the useInventory pattern.
 */
export function useSystem() {
  const queryClient = useQueryClient();

  const { data: systemsRaw, isLoading, refetch } = useRedfishCollection<RawSystem>(
    COLLECTION_PATH,
    { queryConfig: RedfishQueryPresets.inventory },
  );

  const systems = ref<SystemData[]>([]);

  watch(systemsRaw, (raw) => {
    systems.value = raw ? raw.map(processSystem) : [];
  }, { immediate: true });

  // Shared helper to patch system and invalidate
  const patchSystem = async (payload: Record<string, any>) => {
    await api.patch('/redfish/v1/Systems/system', payload);
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };

  const changeIdentifyLedMutation = useMutation({
    mutationFn: async (ledState: boolean) => {
      await patchSystem({ LocationIndicatorActive: ledState });
      return ledState
        ? i18n.global.t('pageInventory.toast.successEnableIdentifyLed')
        : i18n.global.t('pageInventory.toast.successDisableIdentifyLed');
    },
    onError: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const changeSystemAttentionLedMutation = useMutation({
    mutationFn: async (ledState: boolean) => {
      await patchSystem({
        Oem: {
          IBM: {
            PartitionSystemAttentionIndicator: ledState,
            PlatformSystemAttentionIndicator: ledState,
          },
        },
      });
      if (!ledState) {
        return i18n.global.t('pageInventory.toast.successDisableSystemAttentionLed');
      }
    },
    onError: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const changeLampTestMutation = useMutation({
    mutationFn: async (lampTestState: boolean) => {
      await patchSystem({ Oem: { IBM: { LampTest: lampTestState } } });
      if (lampTestState) {
        return i18n.global.t('pageInventory.toast.successEnableLampTest');
      }
    },
    onError: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const changeIdentifyLedState = async (ledState: boolean): Promise<string> => {
    try {
      return await changeIdentifyLedMutation.mutateAsync(ledState);
    } catch {
      throw new Error(
        ledState
          ? i18n.global.t('pageInventory.toast.errorEnableIdentifyLed')
          : i18n.global.t('pageInventory.toast.errorDisableIdentifyLed'),
      );
    }
  };

  const changeSystemAttentionLedState = async (ledState: boolean): Promise<string | undefined> => {
    try {
      return await changeSystemAttentionLedMutation.mutateAsync(ledState);
    } catch {
      if (!ledState) {
        throw new Error(i18n.global.t('pageInventory.toast.errorDisableSystemAttentionLed'));
      }
    }
  };

  const changeLampTestState = async (lampTestState: boolean): Promise<string | undefined> => {
    try {
      return await changeLampTestMutation.mutateAsync(lampTestState);
    } catch {
      throw new Error(
        lampTestState
          ? i18n.global.t('pageInventory.toast.errorEnableLampTest')
          : i18n.global.t('pageInventory.toast.errorDisableLampTest'),
      );
    }
  };

  return {
    systems,
    isLoading,
    refetch,
    changeIdentifyLedState,
    changeSystemAttentionLedState,
    changeLampTestState,
  };
}
