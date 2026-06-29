import { useState } from 'react';
import ICSImportModal from '@/components/planner/ICSImportModal';

interface Props {
  /** Visual style: 'button' for a standalone button, 'menu-item' for inline menu style */
  variant?: 'button' | 'menu-item';
}

export default function ICSImportButton({ variant = 'button' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'menu-item' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm dark:text-white
            hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span>📅</span>
          <span>Import Calendar (.ics)</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg text-white font-medium"
        >
          📅 Import
        </button>
      )}
      {open && <ICSImportModal onClose={() => setOpen(false)} />}
    </>
  );
}
