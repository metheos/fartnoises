import { useState, useCallback } from "react";

interface AsyncOperationState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncOperationOptions {
  /** Initial data value */
  initialData?: any;
  /** Whether to clear error when starting new operation */
  clearErrorOnStart?: boolean;
}

/**
 * Custom hook for managing async operations with loading and error states
 * Provides consistent patterns for handling async operations across components
 */
export function useAsyncOperation<T = any>(
  options: UseAsyncOperationOptions = {}
) {
  const { initialData = null, clearErrorOnStart = true } = options;

  const [state, setState] = useState<AsyncOperationState<T>>({
    data: initialData,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async <R = T>(
      asyncFunction: () => Promise<R>,
      onSuccess?: (data: R) => void,
      onError?: (error: Error) => void
    ): Promise<R | null> => {
      try {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: clearErrorOnStart ? null : prev.error,
        }));

        const result = await asyncFunction();

        setState((prev) => ({
          ...prev,
          data: result as any,
          loading: false,
          error: null,
        }));

        onSuccess?.(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";

        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));

        onError?.(error as Error);
        return null;
      }
    },
    [clearErrorOnStart]
  );

  const setData = useCallback((data: T) => {
    setState((prev) => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null,
    });
  }, [initialData]);

  return {
    ...state,
    execute,
    setData,
    setError,
    setLoading,
    reset,
    isIdle: !state.loading && !state.error,
    isSuccess: !state.loading && !state.error && state.data !== null,
    isError: !state.loading && state.error !== null,
  };
}
