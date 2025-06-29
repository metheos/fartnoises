'use client';

interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Color variant */
  variant?: 'blue' | 'purple' | 'green' | 'white' | 'gray';
  /** Additional message to display */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading spinner component with consistent styling.
 * Used throughout the app for loading states.
 */
export default function LoadingSpinner({
  size = 'md',
  variant = 'purple',
  message,
  className = ''
}: LoadingSpinnerProps) {
  
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4 border-2';
      case 'md':
        return 'w-8 h-8 border-2';
      case 'lg':
        return 'w-12 h-12 border-3';
      case 'xl':
        return 'w-16 h-16 border-4';
      default:
        return 'w-8 h-8 border-2';
    }
  };

  const getVariantClasses = () => {
    const baseClasses = 'border-t-transparent rounded-full animate-spin';
    
    switch (variant) {
      case 'blue':
        return `${baseClasses} border-blue-500`;
      case 'purple':
        return `${baseClasses} border-purple-500`;
      case 'green':
        return `${baseClasses} border-green-500`;
      case 'white':
        return `${baseClasses} border-white`;
      case 'gray':
        return `${baseClasses} border-gray-500`;
      default:
        return baseClasses;
    }
  };

  const getTextSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-sm';
      case 'md':
        return 'text-base';
      case 'lg':
        return 'text-lg';
      case 'xl':
        return 'text-xl';
      default:
        return 'text-base';
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${getSizeClasses()} ${getVariantClasses()}`}></div>
      {message && (
        <p className={`mt-2 text-gray-600 ${getTextSizeClasses()}`}>
          {message}
        </p>
      )}
    </div>
  );
}
