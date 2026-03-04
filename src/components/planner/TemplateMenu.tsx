import { useEffect, useState } from 'react';
import { useTemplateStore } from '@/store/templateStore';

interface Props {
  date: string;
}

export default function TemplateMenu({ date }: Props) {
  const { templates, fetchAll, saveTemplate, applyTemplate, deleteTemplate } = useTemplateStore();
  const [open,      setOpen]      = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showSave,  setShowSave]  = useState(false);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    await saveTemplate(nameInput.trim(), date);
    setNameInput('');
    setShowSave(false);
    setSaving(false);
  };

  const handleApply = async (id: string) => {
    await applyTemplate(id, date);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-white"
      >
        📋 Templates
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 w-56 overflow-hidden">

            {/* Save current day as template */}
            <div className="p-3 border-b dark:border-gray-700">
              {!showSave ? (
                <button
                  onClick={() => setShowSave(true)}
                  className="w-full text-xs bg-brand-accent text-white rounded-lg py-1.5 font-semibold hover:opacity-90"
                >
                  + Save today as template
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    placeholder="Template name…"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => setShowSave(false)}
                      className="flex-1 border rounded py-1 text-xs dark:text-white dark:border-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 bg-brand-accent text-white rounded py-1 text-xs font-semibold"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Template list */}
            <div className="max-h-48 overflow-y-auto">
              {templates.length === 0 && (
                <p className="text-xs text-brand-muted text-center py-4">No templates yet.</p>
              )}
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b dark:border-gray-700"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold dark:text-white truncate">{t.name}</p>
                    <p className="text-xs text-brand-muted">
                      {(t.scheduledTasks as unknown[]).length} tasks
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleApply(t.id)}
                      className="text-xs bg-brand-accent text-white px-2 py-0.5 rounded hover:opacity-90"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="text-xs text-gray-300 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}