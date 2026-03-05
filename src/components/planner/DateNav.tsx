import { format, addDays, subDays, isToday } from 'date-fns';
import { useUIStore } from '@/store/uiStore';

export default function DateNav() {
  const { selectedDate, setDate } = useUIStore();
  const date = new Date(selectedDate);

  return (
    <div className="flex items-center gap-2 mb-1 w-full">
      <button
        onClick={() => setDate(format(subDays(date, 1), 'yyyy-MM-dd'))}
        className="w-11 h-11 shrink-0 rounded-xl border dark:border-gray-600 dark:text-white flex items-center justify-center text-lg font-bold hover:border-brand-accent transition-colors"
      >
        ←
      </button>

      <button
        onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))}
        className={`px-4 h-11 shrink-0 rounded-xl text-sm font-semibold transition-colors
          ${isToday(date)
            ? 'bg-brand-accent text-white'
            : 'border dark:border-gray-600 dark:text-white hover:border-brand-accent'}`}
      >
        Today
      </button>

      <span className="font-semibold text-sm dark:text-white flex-1 text-center truncate">
        {format(date, 'EEE, MMM d yyyy')}
      </span>

      <button
        onClick={() => setDate(format(addDays(date, 1), 'yyyy-MM-dd'))}
        className="w-11 h-11 shrink-0 rounded-xl border dark:border-gray-600 dark:text-white flex items-center justify-center text-lg font-bold hover:border-brand-accent transition-colors"
      >
        →
      </button>
    </div>
  );
}