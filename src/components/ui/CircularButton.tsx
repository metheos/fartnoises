'use client';

import { ButtonHTMLAttributes } from 'react';

interface CircularButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The icon or symbol to display */
  icon: string;
  /** Color variant */
  variant?: 'purple' | 'blue' | 'green' | 'red' | 'yellow';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Circular button component used for increment/decrement controls and icon actions.
 * Common pattern in game settings and controls.
 */
export default function CircularButton({
  icon,
  variant = 'purple',
  disabled = false,
  className = '',
  ...props
}: CircularButtonProps) {
  
  const getVariantClasses = () => {
    const baseClasses = 'w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors text-lg';
    
    switch (variant) {
      case 'purple':
        return `${baseClasses} bg-purple-500 text-white hover:bg-purple-600 disabled:bg-gray-300 disabled:text-gray-500`;
      case 'blue':
        return `${baseClasses} bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500`;
      case 'green':
        return `${baseClasses} bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-300 disabled:text-gray-500`;
      case 'red':
        return `${baseClasses} bg-red-500 text-white hover:bg-red-600 disabled:bg-gray-300 disabled:text-gray-500`;
      case 'yellow':
        return `${baseClasses} bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:text-gray-500`;
      default:
        return baseClasses;
    }
  };

  return (
    <button
      className={`${getVariantClasses()} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
}
