import { useEffect, useRef, useState } from 'react';

// Wraps Web Speech API. Falls back to text-only on unsupported browsers.
export default function VoiceInput({
  onSubmit,
  placeholder = 'Type or hold the mic. e.g. "150g chicken, 1 cup rice"',
  autoSubmitOnSpeechEnd = true,
}) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [interim, setInterim] = useState('');
  const recogRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    setSupported(true);
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-AU';
    r.onresult = (e) => {
      let finalT = '', interimT = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalT += tr; else interimT += tr;
      }
      if (finalT) setText((prev) => (prev ? prev + ' ' : '') + finalT.trim());
      setInterim(interimT);
    };
    r.onend = () => {
      setListening(false);
      setInterim('');
      if (autoSubmitOnSpeechEnd) {
        // submit on stop if there's content
        setText((cur) => {
          if (cur && cur.trim()) {
            // defer so React has the latest state
            queueMicrotask(() => handleSubmit(cur));
          }
          return cur;
        });
      }
    };
    r.onerror = () => { setListening(false); setInterim(''); };
    recogRef.current = r;
    return () => { try { r.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (!recogRef.current) return;
    try { recogRef.current.start(); setListening(true); } catch {}
  };
  const stop = () => {
    if (!recogRef.current) return;
    try { recogRef.current.stop(); } catch {}
    setListening(false);
  };

  const handleSubmit = (override) => {
    const value = (override ?? text).trim();
    if (!value) return;
    onSubmit?.(value);
    setText('');
    setInterim('');
  };

  return (
    <div className="card p-4 sm:p-5 fade-up">
      <div className="flex items-end gap-3">
        <textarea
          value={text + (interim ? (text ? ' ' : '') + interim : '')}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="input resize-none flex-1 text-base"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
        />
        {supported && (
          <button
            type="button"
            onClick={listening ? stop : start}
            aria-label={listening ? 'Stop recording' : 'Start recording'}
            className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-cream
              ${listening ? 'bg-rose recording' : 'bg-moss hover:bg-[#4f6249]'}`}
          >
            <MicIcon />
          </button>
        )}
        <button
          type="button"
          onClick={() => handleSubmit()}
          className="btn-primary h-14 px-5 hidden sm:inline-flex"
        >
          Log
        </button>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-muted">
        <div>{listening ? 'Listening. Tap to stop.' : supported ? 'Tap mic to dictate.' : 'Voice not supported. Type instead.'}</div>
        <button onClick={() => handleSubmit()} className="sm:hidden btn-soft px-3 py-1.5 text-xs">Log</button>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10v2a7 7 0 0 0 14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  );
}
