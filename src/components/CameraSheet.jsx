import { useEffect, useRef, useState } from 'react';

// Camera sheet for barcode scanning. Uses the browser's native
// BarcodeDetector API where available (Android Chrome, modern Edge);
// dynamically imports @zxing/browser as a fallback for iOS Safari /
// older browsers. Closes itself on a successful scan and bubbles the
// barcode up via onScan(code).
//
// If the device has no camera permission or no supported scanner, we show
// a simple text input — the user can type the digits from the pack.
export default function BarcodeSheet({ onScan, onClose }) {
  const videoRef = useRef(null);
  const stopRef = useRef(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let stream;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSupported(false); setError('Camera not available on this device.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        await startScanning(videoRef.current, (code) => {
          stopAll();
          onScan?.(code);
        }, (err) => {
          setError(err.message || String(err));
        }, (stop) => { stopRef.current = stop; });
      } catch (e) {
        setError(e.message || 'Could not access camera. Try the manual entry below.');
      }
    })();
    return () => {
      cancelled = true;
      stopAll();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAll = () => { try { stopRef.current?.(); } catch { /* ignore */ } stopRef.current = null; };

  const submitManual = () => {
    const code = manual.replace(/\D/g, '');
    if (code.length >= 8) onScan?.(code);
  };

  return (
    <div className="fixed inset-0 z-50 overlay flex items-end sm:items-center justify-center p-2"
         onClick={onClose}>
      <div className="card w-full max-w-md p-4 sm:p-5 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg">Scan barcode</h3>
          <button onClick={onClose} className="text-muted text-sm px-2 py-1 hover:text-plum" aria-label="Close">×</button>
        </div>

        <div className="rounded-2xl overflow-hidden bg-black aspect-[4/3] relative">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline/>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="border-2 border-cream/80 rounded-2xl w-3/4 h-1/3 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"/>
          </div>
        </div>

        <p className="text-xs text-muted mt-2">
          {supported
            ? 'Point your camera at the barcode on the back of the pack.'
            : 'No scanner here — type the barcode digits below.'}
        </p>

        {error && <p className="text-xs text-rose mt-2">{error}</p>}

        <div className="mt-3">
          <label className="block text-[11px] uppercase tracking-wide text-muted mb-1">Or type the barcode</label>
          <div className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)}
              inputMode="numeric" placeholder="9 300 ###"
              className="input flex-1"/>
            <button onClick={submitManual} disabled={manual.replace(/\D/g, '').length < 8}
              className="btn-primary text-sm">Lookup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- scanner driver ----
async function startScanning(video, onCode, onError, registerStop) {
  // 1. Native BarcodeDetector
  if ('BarcodeDetector' in window) {
    try {
      const formats = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf'];
      const detector = new window.BarcodeDetector({ formats });
      let stopped = false;
      const tick = async () => {
        if (stopped || !video || video.readyState < 2) {
          if (!stopped) requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes && codes[0]?.rawValue) { onCode(codes[0].rawValue); return; }
        } catch { /* keep trying */ }
        if (!stopped) requestAnimationFrame(tick);
      };
      registerStop(() => { stopped = true; });
      requestAnimationFrame(tick);
      return;
    } catch (e) { /* fall through to ZXing */ }
  }

  // 2. @zxing/browser dynamic import fallback (iOS Safari etc.)
  try {
    const mod = await import('@zxing/browser');
    const Reader = mod.BrowserMultiFormatReader || mod.default?.BrowserMultiFormatReader;
    if (!Reader) throw new Error('ZXing not loaded');
    const reader = new Reader();
    const controls = await reader.decodeFromVideoElement(video, (result, err) => {
      if (result) onCode(result.getText());
    });
    registerStop(() => { try { controls.stop(); } catch { /* ignore */ } });
  } catch (e) {
    onError?.(new Error('Barcode scanner not supported on this browser. Type the digits below.'));
  }
}
