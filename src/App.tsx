import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import DayView from '@/pages/index';

export default function App() {
  const { isDarkMode, activeView } = useUIStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-brand-bg dark:bg-brand-dark">
      {/* Nav */}
      <nav className="bg-brand-dark text-white px-4 py-2 flex items-center justify-between">
        <span className="font-bold text-lg">DayFlow</span>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => useUIStore.getState().setView(v)}
              className={`px-3 py-1 rounded text-sm capitalize transition-colors
                ${activeView === v
                  ? 'bg-brand-accent text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          onClick={() => useUIStore.getState().toggleDark()}
          className="text-sm text-gray-400 hover:text-white"
        >
          {isDarkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </nav>

      {/* Content */}
      <main className="p-4">
        <DayView />
      </main>
    </div>
  );
}