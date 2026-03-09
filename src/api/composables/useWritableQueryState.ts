import { ref, watch, type Ref } from 'vue';

/**
 * Creates a writable ref that automatically syncs with a computed/query value
 * Useful for v-model binding with server state that needs optimistic updates
 *
 * This utility solves the problem of needing writable refs for UI components
 * while keeping server state as the source of truth. When the server state
 * changes (e.g., after a failed update and refetch), the local ref automatically
 * syncs to reflect the correct server state.
 *
 * @param source - Getter function that provides the source value from query/computed
 * @returns Writable ref that automatically syncs with source
 *
 * @example
 * const { data } = useQuery(...);
 * const writableState = useWritableQueryState(() => data.value?.field ?? null);
 *
 * // Use with v-model
 * <input v-model="writableState" />
 *
 * // Manually update (optimistic)
 * writableState.value = newValue;
 *
 * // Auto-reverts when query refetches with different value
 */
export function useWritableQueryState<T>(source: () => T): Ref<T> {
  const localState = ref<T>(source()) as Ref<T>;

  watch(
    source,
    (newValue) => {
      localState.value = newValue;
    },
    { immediate: true },
  );

  return localState;
}
