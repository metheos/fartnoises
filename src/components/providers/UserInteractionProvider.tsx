'use client';

import { useUserInteractionTracking } from '../../hooks/useUserInteractionTracking';

/**
 * Client component to handle global user interaction tracking
 * This should be included in the root layout to ensure audio readiness
 */
export function UserInteractionProvider({ children }: { children: React.ReactNode }) {
  // Track user interactions globally
  useUserInteractionTracking();

  return <>{children}</>;
}
