import React from 'react';
import { createPortal } from 'react-dom';

export default function SimpleModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-auto pointer-events-auto">
        <div className="bg-white rounded-lg shadow-xl w-full p-6 max-h-[80vh] overflow-auto">
          {children}
        </div>
      </div>
    </div>,
    typeof document !== 'undefined' ? document.body : null
  );
}
