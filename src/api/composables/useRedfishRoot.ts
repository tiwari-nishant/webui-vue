import { useQuery } from '@tanstack/vue-query';
import api from '@/store/api';
import type { ServiceRoot } from '@/types/redfish';
import { RedfishQueryPresets } from './shared/queryConfig';

/**
 * Composable to fetch and cache the Redfish ServiceRoot
 * Detects OData support capabilities for optimization
 */
export function useRedfishRoot() {
  return useQuery({
    queryKey: ['redfish', 'root'],
    queryFn: async (): Promise<ServiceRoot> => {
      const response = await api.get<ServiceRoot>('/redfish/v1/');
      return response.data;
    },
    ...RedfishQueryPresets.metadata,
    retry: 3, // Override: ServiceRoot is critical, retry more times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Helper to check if OData $expand is supported
 */
export function useODataExpandSupport() {
  const { data: serviceRoot } = useRedfishRoot();

  const isExpandSupported = () => {
    return (
      serviceRoot.value?.ProtocolFeaturesSupported?.ExpandQuery?.ExpandAll ??
      false
    );
  };

  const getMaxExpandLevels = () => {
    return (
      serviceRoot.value?.ProtocolFeaturesSupported?.ExpandQuery?.MaxLevels ?? 1
    );
  };

  const isSelectSupported = () => {
    return serviceRoot.value?.ProtocolFeaturesSupported?.SelectQuery ?? false;
  };

  return {
    isExpandSupported,
    getMaxExpandLevels,
    isSelectSupported,
  };
}
