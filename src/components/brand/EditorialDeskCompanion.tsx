import React, { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageProvider';

interface EditorialDeskCompanionProps {
  className?: string;
}

export const EditorialDeskCompanion: React.FC<EditorialDeskCompanionProps> = ({ className = '' }) => {
  const { language } = useLanguage();
  const [stamped, setStamped] = useState(false);
  const [active, setActive] = useState(false);

  const stampLabel = language === 'gu'
    ? (stamped ? 'સંપાદકીય મુદ્રા લાગુ થઈ · તૈયાર' : 'ડેસ્ક મુદ્રા · ક્લિક કરો')
    : language === 'hi'
      ? (stamped ? 'संपादकीय मुहर स्वीकृत · तैयार' : 'डेस्क मुहर · क्लिक करें')
      : (stamped ? 'Proof seal stamped · Ready' : 'Desk seal · Tap to stamp');

  const tooltipText = language === 'gu'
    ? 'હસ્તનિર્મિત સંપાદકીય પૃષ્ઠચિહ્ન'
    : language === 'hi'
      ? 'हस्तनिर्मित संपादकीय मुहर'
      : 'Handcrafted editorial proof seal';

  const triggerStamp = () => {
    setActive(true);
    setStamped((prev) => !prev);
    setTimeout(() => setActive(false), 260);
  };

  return (
    <div className={`relative inline-flex items-center gap-2.5 select-none ${className}`}>
      <button
        type="button"
        onClick={triggerStamp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerStamp();
          }
        }}
        title={tooltipText}
        aria-label={stampLabel}
        className={`group relative flex items-center justify-center h-9 w-9 rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/80 motion-reduce:transition-none ${
          stamped
            ? 'border-copper bg-copper/20 text-copper-300 shadow-[0_0_12px_rgba(188,116,78,0.35)]'
            : 'border-stone-700/80 bg-obsidian-900/80 text-stone-400 hover:border-copper/70 hover:text-copper-300 hover:bg-obsidian-800'
        } ${active ? 'scale-90 rotate-[-12deg]' : 'hover:scale-105'}`}
      >
        <svg
          viewBox="0 0 32 32"
          className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12 motion-reduce:transition-none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Subtle outer seal ring */}
          <circle
            cx="16"
            cy="16"
            r="13"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeDasharray={stamped ? 'none' : '2 2'}
          />
          {/* Central lens crosshair mark */}
          <circle cx="16" cy="16" r="4.5" stroke="currentColor" strokeWidth="1" />
          <line x1="16" y1="6" x2="16" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <line x1="16" y1="22" x2="16" y2="26" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <line x1="6" y1="16" x2="10" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <line x1="22" y1="16" x2="26" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>

        {stamped && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-forest text-[8px] text-ivory ring-1 ring-obsidian">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </button>

      <span
        onClick={triggerStamp}
        className="cursor-pointer text-[10px] font-mono tracking-wider transition-colors text-stone-400 hover:text-stone-300"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-copper-400" />
          {stampLabel}
        </span>
      </span>
    </div>
  );
};