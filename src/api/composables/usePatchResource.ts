import { useMutation, useQueryClient } from '@tanstack/vue-query';
// @ts-ignore - api.js is a JavaScript module
import api from '@/store/api';

/**
 * Generic composable for patching any Redfish resource
 * Provides a reusable mutation for updating resource fields
 *
 * @example
 * const { patchResource, isPending, error } = usePatchResource();
 *
 * // Patch a single field
 * await patchResource({
 *   endpoint: '/redfish/v1/Chassis/chassis/Assembly',
 *   field: 'Assemblies',
 *   value: [{ MemberId: '1', Oem: { OpenBMC: { ReadyToRemove: true } } }]
 * });
 *
 * // Patch with nested field path
 * await patchResource({
 *   endpoint: '/redfish/v1/Systems/system',
 *   field: 'Boot.BootSourceOverrideEnabled',
 *   value: 'Once',
 *   invalidateQueries: [['redfish', 'systems']]
 * });
 */
export function usePatchResource() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      endpoint,
      field,
      value,
      additionalFields,
    }: {
      endpoint: string;
      field: string;
      value: any;
      additionalFields?: Record<string, any>;
    }) => {
      // Build the patch payload
      // Support nested field paths like "Boot.BootSourceOverrideEnabled"
      const fieldParts = field.split('.');
      let payload: any = {};

      if (fieldParts.length === 1) {
        // Simple field: { field: value }
        payload[field] = value;
      } else {
        // Nested field: { parent: { child: value } }
        let current = payload;
        for (let i = 0; i < fieldParts.length - 1; i++) {
          current[fieldParts[i]] = {};
          current = current[fieldParts[i]];
        }
        current[fieldParts[fieldParts.length - 1]] = value;
      }

      // Merge additional fields if provided
      if (additionalFields) {
        payload = { ...payload, ...additionalFields };
      }

      const response = await api.patch(endpoint, payload);
      return response.data;
    },
    onError: (error: any) => {
      console.error('Error patching resource:', error);
      throw error;
    },
  });

  /**
   * Patch a resource field
   * @param params - Patch parameters
   * @param params.endpoint - The Redfish endpoint to patch
   * @param params.field - The field to update (supports dot notation for nested fields)
   * @param params.value - The new value for the field
   * @param params.additionalFields - Optional additional fields to include in the patch
   * @param params.invalidateQueries - Optional array of query keys to invalidate after success
   * @returns Promise that resolves with the response data
   */
  const patchResource = async ({
    endpoint,
    field,
    value,
    additionalFields,
    invalidateQueries,
  }: {
    endpoint: string;
    field: string;
    value: any;
    additionalFields?: Record<string, any>;
    invalidateQueries?: Array<string | string[]>;
  }) => {
    const result = await mutation.mutateAsync({
      endpoint,
      field,
      value,
      additionalFields,
    });

    // Invalidate specified queries after successful mutation
    if (invalidateQueries && invalidateQueries.length > 0) {
      for (const queryKey of invalidateQueries) {
        await queryClient.invalidateQueries({
          queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
        });
      }
    }

    return result;
  };

  return {
    patchResource,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
