'use client';

import { ReactNode, useEffect } from 'react';
import Card from './Card';

interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: ReactNode;
  /** Callback when modal should close */
  onClose?: () => void;
  /** Whether clicking outside closes the modal */
  closeOnOverlayClick?: boolean;
  /** Additional CSS classes for the modal content */
  className?: string;
  /** Size of the modal */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Modal/Dialog component for overlays and popups.
 * Used for reconnection votes, confirmations, and other modal content.
 */
export default function Modal({
  isOpen,
  title,
  children,
  onClose,
  closeOnOverlayClick = false,
  className = '',
  size = 'md'
}: ModalProps) {

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-sm w-full';
      case 'md':
        return 'max-w-md w-full';
      case 'lg':
        return 'max-w-lg w-full';
      case 'xl':
        return 'max-w-xl w-full';
      default:
        return 'max-w-md w-full';
    }
  };

  const handleOverlayClick = () => {
    if (closeOnOverlayClick && onClose) {
      onClose();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    // Prevent event bubbling to overlay
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div 
        className={`${getSizeClasses()} mx-4`}
        onClick={handleContentClick}
      >
        <Card className={`text-center shadow-2xl ${className}`}>
          {title && (
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-purple-600">
                {title}
              </h2>
            </div>
          )}
          
          <div>
            {children}
          </div>
        </Card>
      </div>
    </div>
  );
}
