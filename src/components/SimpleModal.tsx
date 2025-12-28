import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type SimpleModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  titleId?: string;
  descriptionId?: string;
};

export default function SimpleModal({ open, onClose, children, titleId, descriptionId }: SimpleModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // focus the container for accessibility
    setTimeout(() => containerRef.current?.focus(), 0);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-auto pointer-events-auto">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          className="bg-white rounded-lg shadow-xl w-full p-6 max-h-[80vh] overflow-auto"
        >
          {children}
        </div>
      </div>
    </div>,
    typeof document !== 'undefined' ? document.body : null
  );
}
