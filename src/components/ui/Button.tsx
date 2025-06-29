'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'purple' | 'gradient';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether button is in loading state */
  isLoading?: boolean;
  /** Children elements */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Standardized button component used throughout the fartnoises game.
 * Provides consistent styling and behavior patterns.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  
  const getVariantClasses = () => {
    const baseClasses = 'font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    switch (variant) {
      case 'primary':
        return `${baseClasses} bg-gradient-to-r from-blue-400 to-blue-600 text-white hover:from-blue-500 hover:to-blue-700 focus:ring-blue-500 disabled:from-gray-300 disabled:to-gray-400`;
      case 'secondary':
        return `${baseClasses} bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 hover:from-gray-300 hover:to-gray-400 focus:ring-gray-500 disabled:from-gray-100 disabled:to-gray-200`;
      case 'success':
        return `${baseClasses} bg-gradient-to-r from-green-400 to-green-600 text-white hover:from-green-500 hover:to-green-700 focus:ring-green-500 disabled:from-gray-300 disabled:to-gray-400`;
      case 'danger':
        return `${baseClasses} bg-gradient-to-r from-red-400 to-red-600 text-white hover:from-red-500 hover:to-red-700 focus:ring-red-500 disabled:from-gray-300 disabled:to-gray-400`;
      case 'warning':
        return `${baseClasses} bg-gradient-to-r from-yellow-400 to-yellow-600 text-white hover:from-yellow-500 hover:to-yellow-700 focus:ring-yellow-500 disabled:from-gray-300 disabled:to-gray-400`;
      case 'purple':
        return `${baseClasses} bg-gradient-to-r from-purple-400 to-purple-600 text-white hover:from-purple-500 hover:to-purple-700 focus:ring-purple-500 disabled:from-gray-300 disabled:to-gray-400`;
      case 'gradient':
        return `${baseClasses} bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 focus:ring-purple-500 disabled:from-gray-300 disabled:to-gray-400`;
      default:
        return baseClasses;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-2 text-sm rounded-lg';
      case 'md':
        return 'px-4 py-3 text-base rounded-xl';
      case 'lg':
        return 'px-6 py-4 text-lg rounded-xl';
      case 'xl':
        return 'px-8 py-4 text-xl rounded-2xl';
      default:
        return 'px-4 py-3 text-base rounded-xl';
    }
  };

  const getHoverClasses = () => {
    if (disabled || isLoading) return '';
    return 'hover:scale-105 hover:shadow-xl transform';
  };

  const allClasses = `${getVariantClasses()} ${getSizeClasses()} ${getHoverClasses()} ${
    disabled || isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
  } ${className}`.trim();

  return (
    <button
      className={allClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
}
