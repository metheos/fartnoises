import { useState, useCallback } from "react";

interface UseModalStateOptions {
  defaultOpen?: boolean;
}

interface UseModalStateReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Custom hook to manage modal open/close state.
 * Provides consistent modal state management across components.
 */
export function useModalState({
  defaultOpen = false,
}: UseModalStateOptions = {}): UseModalStateReturn {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
