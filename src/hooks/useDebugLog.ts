import { useState, useCallback } from "react";

/**
 * Custom hook for managing debug logging with timestamps
 */
export function useDebugLog() {
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage); // Also log to browser console
    setDebugLog((prev) => [...prev.slice(-10), logMessage]);
  }, []);

  return {
    debugLog,
    addDebugLog,
  };
}
