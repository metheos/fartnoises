'use client';

import { ReactNode } from 'react';

interface CardProps {
  /** Card content */
  children: ReactNode;
  /** Visual variant of the card */
  variant?: 'default' | 'purple' | 'gradient' | 'success' | 'warning' | 'error';
  /** Size of the card */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether the card has a shadow */
  shadow?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Standardized card component used throughout the fartnoises game.
 * Provides consistent container styling and spacing.
 */
export default function Card({
  children,
  variant = 'default',
  size = 'md',
  shadow = true,
  className = ''
}: CardProps) {
  
  const getVariantClasses = () => {
    const baseClasses = 'rounded-3xl border transition-all duration-300';
    
    switch (variant) {
      case 'default':
        return `${baseClasses} bg-white border-gray-200`;
      case 'purple':
        return `${baseClasses} bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200`;
      case 'gradient':
        return `${baseClasses} bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 border-white border-opacity-30`;
      case 'success':
        return `${baseClasses} bg-gradient-to-r from-green-50 to-emerald-50 border-green-200`;
      case 'warning':
        return `${baseClasses} bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200`;
      case 'error':
        return `${baseClasses} bg-gradient-to-r from-red-50 to-pink-50 border-red-200`;
      default:
        return baseClasses;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'p-3';
      case 'md':
        return 'p-4';
      case 'lg':
        return 'p-6';
      case 'xl':
        return 'p-8';
      default:
        return 'p-4';
    }
  };

  const getShadowClasses = () => {
    if (!shadow) return '';
    return 'shadow-lg hover:shadow-xl';
  };

  const allClasses = `${getVariantClasses()} ${getSizeClasses()} ${getShadowClasses()} ${className}`.trim();

  return (
    <div className={allClasses}>
      {children}
    </div>
  );
}
