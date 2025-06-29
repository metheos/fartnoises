import { useEffect, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";

interface EventHandler<T = any> {
  (data: T): void;
}

interface UseSocketEventHandlerOptions {
  /** Whether to automatically clean up listeners on unmount */
  autoCleanup?: boolean;
  /** Timeout for one-time event listeners (ms) */
  oneTimeTimeout?: number;
}

/**
 * Custom hook for simplified socket event handling with automatic cleanup
 * Provides utilities for common socket event patterns like one-time listeners and response handlers
 */
export function useSocketEventHandler(
  socket: Socket | null,
  options: UseSocketEventHandlerOptions = {}
) {
  const { autoCleanup = true, oneTimeTimeout = 5000 } = options;
  const listenersRef = useRef<Set<{ event: string; handler: EventHandler }>>(
    new Set()
  );

  // Register an event listener with automatic cleanup tracking
  const addEventListener = useCallback(
    <T = any>(
      event: string,
      handler: EventHandler<T>,
      trackForCleanup: boolean = true
    ) => {
      if (!socket) return () => {};

      socket.on(event, handler);

      if (trackForCleanup) {
        listenersRef.current.add({ event, handler });
      }

      // Return cleanup function
      return () => {
        socket.off(event, handler);
        if (trackForCleanup) {
          listenersRef.current.delete({ event, handler });
        }
      };
    },
    [socket]
  );

  // One-time event listener with timeout
  const addOneTimeListener = useCallback(
    <T = any>(
      event: string,
      handler: EventHandler<T>,
      timeout: number = oneTimeTimeout
    ): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!socket) {
          reject(new Error("Socket not available"));
          return;
        }

        let timeoutId: NodeJS.Timeout;

        const responseHandler = (data: T) => {
          clearTimeout(timeoutId);
          socket.off(event, responseHandler);
          handler(data);
          resolve(data);
        };

        socket.on(event, responseHandler);

        timeoutId = setTimeout(() => {
          socket.off(event, responseHandler);
          reject(new Error(`Timeout waiting for ${event} event`));
        }, timeout);
      });
    },
    [socket, oneTimeTimeout]
  );

  // Emit event and wait for specific response
  const emitAndWaitForResponse = useCallback(
    async <T = any, R = any>(
      emitEvent: string,
      emitData: T,
      responseEvent: string,
      responseFilter?: (data: R) => boolean,
      timeout: number = oneTimeTimeout
    ): Promise<R> => {
      return new Promise((resolve, reject) => {
        if (!socket) {
          reject(new Error("Socket not available"));
          return;
        }

        let timeoutId: NodeJS.Timeout;

        const responseHandler = (data: R) => {
          // Apply filter if provided
          if (responseFilter && !responseFilter(data)) {
            return; // Keep listening for the right response
          }

          clearTimeout(timeoutId);
          socket.off(responseEvent, responseHandler);
          resolve(data);
        };

        socket.on(responseEvent, responseHandler);
        socket.emit(emitEvent, emitData);

        timeoutId = setTimeout(() => {
          socket.off(responseEvent, responseHandler);
          reject(
            new Error(
              `Timeout waiting for ${responseEvent} response to ${emitEvent}`
            )
          );
        }, timeout);
      });
    },
    [socket, oneTimeTimeout]
  );

  // Clean up all tracked listeners
  const cleanupAllListeners = useCallback(() => {
    if (!socket) return;

    listenersRef.current.forEach(({ event, handler }) => {
      socket.off(event, handler);
    });

    listenersRef.current.clear();
  }, [socket]);

  // Auto-cleanup on unmount if enabled
  useEffect(() => {
    if (!autoCleanup) return;

    return () => {
      cleanupAllListeners();
    };
  }, [autoCleanup, cleanupAllListeners]);

  // Check if socket is connected
  const isConnected = socket?.connected ?? false;

  // Emit with connection check
  const emit = useCallback(
    (event: string, data?: any) => {
      if (!socket || !socket.connected) {
        console.warn(`Attempted to emit ${event} but socket is not connected`);
        return false;
      }

      socket.emit(event, data);
      return true;
    },
    [socket]
  );

  return {
    addEventListener,
    addOneTimeListener,
    emitAndWaitForResponse,
    cleanupAllListeners,
    isConnected,
    emit,
    socket,
  };
}
