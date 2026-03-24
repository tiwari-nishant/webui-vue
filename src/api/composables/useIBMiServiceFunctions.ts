import { computed } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore - api.js is a JavaScript module
import api from '@/store/api';
// @ts-ignore - i18n.js is a JavaScript module
import i18n from '@/i18n';

/**
 * Composable for fetching and managing IBMi Service Functions
 * Replaces the IBMiServiceFunctionsStore with TanStack Query
 */
export function useIBMiServiceFunctions() {
  const queryClient = useQueryClient();

  // Fetch available service functions
  const {
    data: serviceFunctionsRaw,
    isLoading,
    error,
    isError,
    refetch: refetchServiceFunctions,
  } = useQuery({
    queryKey: ['ibmi', 'serviceFunctions'],
    queryFn: async () => {
      const response = await api.get('/redfish/v1/Systems/system');
      return response.data?.Oem?.IBM?.EnabledPanelFunctions || [];
    },
  });

  // Available service functions
  const availableFunctions = computed(() => {
    return serviceFunctionsRaw.value || [];
  });

  // Execute service function mutation
  const executeServiceFunctionMutation = useMutation({
    mutationFn: async (funcNo: number) => {
      try {
        await api.post(
          '/redfish/v1/Systems/system/Actions/Oem/IBM/IBMComputerSystem.ExecutePanelFunction',
          {
            FuncNo: funcNo,
          },
        );
        return i18n.global.t(
          'pageIbmiServiceFunctions.toast.successExecuteFunction',
        );
      } catch (error) {
        console.error(error);
        throw new Error(
          i18n.global.t('pageIbmiServiceFunctions.toast.errorExecuteFunction'),
        );
      }
    },
    onSuccess: () => {
      // Refetch available functions after execution
      queryClient.invalidateQueries({ queryKey: ['ibmi', 'serviceFunctions'] });
    },
  });

  return {
    // Data
    availableFunctions,

    // Loading states
    isLoading,

    // Error states
    isError,
    error,

    // Mutations
    executeServiceFunction: executeServiceFunctionMutation.mutateAsync,

    // Mutation states
    isExecuting: executeServiceFunctionMutation.isPending,

    // Refetch functions
    refetchServiceFunctions,
  };
}
