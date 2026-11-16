import { ArrowLeft, Search, X } from 'lucide-react';
import { Logo } from './ui.jsx';

export default function SearchBar({ value, onChange, onFocus, onBack, showBack, inputRef, floating }) {
  return (
    <div className={`flex items-center gap-1 rounded-full bg-white pl-2 pr-1.5 ${floating ? 'shadow-float' : 'border border-slate-200 shadow-sm'} focus-within:ring-2 focus-within:ring-cobalt-300`}>
      {showBack ? (
        <button onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-700 hover:bg-slate-100" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center"><Logo compact /></span>
      )}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        type="search"
        enterKeyHint="search"
        placeholder="Search lecture halls, hostels, banks…"
        className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink-900 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
        aria-label="Search campus destinations"
      />
      {value ? (
        <button onClick={() => onChange('')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-slate-100" aria-label="Clear search">
          <X size={18} />
        </button>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cobalt-600 text-white"><Search size={18} /></span>
      )}
    </div>
  );
}
