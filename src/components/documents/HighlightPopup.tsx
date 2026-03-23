import { useState } from 'react';
import { HIGHLIGHT_COLORS } from '@/store/highlightStore';

interface Props {
  text: string;
  x: number;
  y: number;
  onSave: (color: string, note: string) => void;
  onDismiss: () => void;
}

export default function HighlightPopup({ text, x, y, onSave, onDismiss }: Props) {
  const [color, setColor] = useState(HIGHLIGHT_COLORS[0]?.value ?? '#FBBF24');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'color' | 'note'>('color');

  const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;

  // Keep popup within viewport
  const popupW = 260;
  const left = Math.min(Math.max(x - popupW / 2, 8), window.innerWidth - popupW - 8);
  const top = y + 12;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onDismiss} />

      <div
        className="fixed z-50 rounded-xl shadow-2xl overflow-hidden"
        style={{
          left,
          top,
          width: popupW,
          background: 'var(--df-surface)',
          border: '1px solid var(--df-border)',
        }}
      >
        {/* Selected text preview */}
        <div className="px-3 pt-3 pb-2" style={{ borderBottom: '1px solid var(--df-border)' }}>
          <p className="text-xs italic leading-relaxed" style={{ color: 'var(--df-muted)' }}>
            "{preview}"
          </p>
        </div>

        {step === 'color' ? (
          <div className="p-3">
            {/* Color swatches */}
            <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--df-muted)' }}>
              Highlight colour
            </p>
            <div className="flex gap-2 mb-3">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    background: c.value,
                    transform: color === c.value ? 'scale(1.25)' : 'scale(1)',
                    outline: color === c.value ? `2px solid ${c.value}` : 'none',
                    outlineOffset: 2,
                  }}
                  title={c.label}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('note')}
                className="flex-1 text-xs py-1.5 rounded-md transition-colors"
                style={{ background: 'var(--df-surface2)', color: 'var(--df-muted)', border: '1px solid var(--df-border)' }}
              >
                + Add note
              </button>
              <button
                onClick={() => onSave(color, '')}
                className="flex-1 text-xs py-1.5 rounded-md font-semibold text-white transition-colors"
                style={{ background: 'var(--df-accent)' }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--df-muted)' }}>
              Add a note
            </p>
            <textarea
              autoFocus
              rows={3}
              className="w-full rounded-lg px-2 py-1.5 text-xs text-white outline-none resize-none mb-2"
              style={{ background: 'var(--df-surface2)', border: '1px solid var(--df-border)' }}
              placeholder="Your thoughts on this passage…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setStep('color')}
                className="flex-1 text-xs py-1.5 rounded-md transition-colors"
                style={{ background: 'var(--df-surface2)', color: 'var(--df-muted)', border: '1px solid var(--df-border)' }}
              >
                ← Back
              </button>
              <button
                onClick={() => onSave(color, note)}
                className="flex-1 text-xs py-1.5 rounded-md font-semibold text-white transition-colors"
                style={{ background: 'var(--df-accent)' }}
              >
                Save highlight
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
