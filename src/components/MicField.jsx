import { forwardRef, useEffect, useRef, useState } from 'react';

// Reusable text input or textarea with an inline microphone button.
// The mic appends a transcribed phrase to whatever's already in the
// field — not replace — so dictation cooperates with typing.
//
// Drop-in replacement for an <input> or <textarea> element. Pass
// `as="textarea"` (and rows / cols) for multi-line.
//
//   <MicField value={x} onChange={(e) => setX(e.target.value)}
//             className="input" placeholder="…" />
//
// When the Web Speech API isn't available (Firefox, some WebViews) the
// mic button hides itself and the field renders as a plain input.
const MicField = forwardRef(function MicField(
  { as = 'input', value, onChange, className = '', wrapperClassName = '', ...props },
  ref,
) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef(null);
  const isTextarea = as === 'textarea';

  useEffect(() => {
    const SR = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-AU';
    r.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript || '';
      if (t) {
        const next = value ? `${value} ${t}` : t;
        onChange?.({ target: { value: next } });
      }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => { try { r.stop(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (!recogRef.current || listening) return;
    try { recogRef.current.start(); setListening(true); } catch { /* ignore */ }
  };
  const stop = () => {
    if (!recogRef.current) return;
    try { recogRef.current.stop(); } catch { /* ignore */ }
    setListening(false);
  };

  const Tag = isTextarea ? 'textarea' : 'input';
  const padded = supported ? `${className} pr-11` : className;

  return (
    <div className={`relative ${wrapperClassName}`}>
      <Tag ref={ref} value={value ?? ''} onChange={onChange} className={padded} {...props} />
      {supported && (
        <button
          type="button"
          onClick={listening ? stop : start}
          aria-label={listening ? 'Stop dictation' : 'Dictate'}
          className={`absolute right-2 ${
            isTextarea ? 'top-2.5' : 'top-1/2 -translate-y-1/2'
          } w-8 h-8 rounded-full flex items-center justify-center transition ${
            listening
              ? 'bg-blush text-dusty recording'
              : 'text-muted hover:text-dusty hover:bg-blush/50'
          }`}
        >
          <MicIcon/>
        </button>
      )}
    </div>
  );
});

export default MicField;

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10v2a7 7 0 0 0 14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  );
}
