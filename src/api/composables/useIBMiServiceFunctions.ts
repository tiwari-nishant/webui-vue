import { computed, ref } from 'vue';
// @ts-ignore - api.js is a JavaScript module
import api from '@/store/api';
// @ts-ignore - i18n.js is a JavaScript module
import i18n from '@/i18n';

/**
 * Composable for managing IBM i Service Functions
 * Provides access to available service functions and execution capabilities
 */
export function useIBMiServiceFunctions() {
  const isLoading = ref(false);

  /**
   * Execute a service function
   * @param functionNumber The function number to execute
   * @returns Promise with success message
   */
  const executeServiceFunction = async (functionNumber: number): Promise<string> => {
    try {
      await api.post(
        '/redfish/v1/Systems/system/Actions/Oem/IBM/IBMComputerSystem.ExecutePanelFunction',
        {
          FuncNo: functionNumber,
        },
      );
      return i18n.global.t('pageIbmiServiceFunctions.toast.successExecuteFunction');
    } catch (error: any) {
      console.error(error);
      throw new Error(
        i18n.global.t('pageIbmiServiceFunctions.toast.errorExecuteFunction'),
      );
    }
  };

  /**
   * Fetch available service functions
   * @returns Promise with available functions array
   */
  const fetchAvailableServiceFunctions = async (): Promise<number[]> => {
    try {
      isLoading.value = true;
      const response = await api.get('/redfish/v1/Systems/system');
      const availableFunctions = response.data?.Oem?.IBM?.EnabledPanelFunctions || [];
      return availableFunctions;
    } catch (error: any) {
      console.error(error);
      throw new Error(
        i18n.global.t('pageIbmiServiceFunctions.toast.errorFetchFunctions'),
      );
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading: computed(() => isLoading.value),
    executeServiceFunction,
    fetchAvailableServiceFunctions,
  };
}
