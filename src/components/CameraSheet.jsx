import { useEffect, useRef, useState } from 'react';

// Camera sheet for barcode scanning. Robust path:
//   1. getUserMedia with environment camera, fall back to any camera.
//   2. Wait for loadedmetadata, explicitly play() with a tap-to-resume
//      fallback if autoplay is blocked.
//   3. Native BarcodeDetector at ~5 fps when available (Android Chrome,
//      modern Edge, iOS Safari 17.4+).
//   4. Otherwise dynamic-import @zxing/browser as a fallback.
//
// Status string is surfaced to the user so failures aren't silent.
export default function BarcodeSheet({ onScan, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stopDetectionRef = useRef(null);
  const [status, setStatus] = useState('Starting camera…');
  const [error, setError] = useState('');
  const [needsTap, setNeedsTap] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    let cancelled = false;

    const teardown = () => {
      try { stopDetectionRef.current?.(); } catch { /* ignore */ }
      stopDetectionRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera API not available in this browser.');
        setStatus('');
        return;
      }

      // 1. Acquire a camera stream — prefer environment, gracefully retry
      // with the default if the constraint isn't satisfiable (e.g. desktop).
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (e2) {
          setError(e2?.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow it in your browser settings or type the digits below.'
            : `Couldn't open the camera: ${e2?.message || e2}.`);
          setStatus('');
          return;
        }
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) { teardown(); return; }
      video.srcObject = stream;

      // 2. Wait for the video element to know its dimensions before we ask
      // the detector to look at it. iOS Safari otherwise reports a 0×0
      // frame and detection silently no-ops.
      await new Promise((resolve) => {
        if (video.readyState >= 1 && video.videoWidth > 0) return resolve();
        const onReady = () => { video.removeEventListener('loadedmetadata', onReady); resolve(); };
        video.addEventListener('loadedmetadata', onReady);
        // safety timeout — resolve anyway after 2s
        setTimeout(resolve, 2000);
      });

      // 3. Try to play. Some browsers / WebViews require a user gesture
      // even with muted+playsInline; fall through to a tap-to-start hint.
      try {
        await video.play();
        setNeedsTap(false);
      } catch (playErr) {
        setNeedsTap(true);
        setStatus('Tap the preview to start.');
      }
      if (cancelled) { teardown(); return; }

      setStatus('Looking for a barcode…');

      // 4. Detection loop
      try {
        await startDetection(
          video,
          (code) => { if (!cancelled) { teardown(); onScan?.(code); } },
          (msg) => { if (!cancelled) setStatus(msg); },
          (stopFn) => { stopDetectionRef.current = stopFn; },
        );
      } catch (e) {
        if (!cancelled) setError(`Scanner failed to start: ${e?.message || e}`);
      }
    })();

    return () => { cancelled = true; teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPreviewTap = () => {
    if (!needsTap) return;
    videoRef.current?.play?.().then(() => { setNeedsTap(false); setStatus('Looking for a barcode…'); }).catch(() => {});
  };

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

        <div className="rounded-2xl overflow-hidden bg-charcoal aspect-[4/3] relative" onClick={onPreviewTap}>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay/>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="border-2 border-canvas/80 rounded-2xl w-3/4 h-1/3 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"/>
          </div>
          {needsTap && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-canvas/90 text-charcoal text-xs px-3 py-1.5 rounded-full">Tap to start</span>
            </div>
          )}
        </div>

        {status && <p className="text-xs text-muted mt-2">{status}</p>}
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

async function startDetection(video, onCode, onStatus, registerStop) {
  // Native BarcodeDetector — 5 fps loop saves battery.
  if ('BarcodeDetector' in window) {
    try {
      const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
      const detector = new window.BarcodeDetector({ formats });
      let stopped = false;
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const codes = await detector.detect(video);
            if (codes && codes[0]?.rawValue) {
              onCode(codes[0].rawValue);
              return;
            }
          } catch { /* keep trying */ }
        }
        if (!stopped) setTimeout(tick, 200);
      };
      registerStop(() => { stopped = true; });
      tick();
      return;
    } catch { /* fall through to ZXing */ }
  }

  // ZXing fallback for browsers without BarcodeDetector.
  onStatus('Loading scanner…');
  try {
    const mod = await import('@zxing/browser');
    const Reader = mod.BrowserMultiFormatReader || mod.default?.BrowserMultiFormatReader;
    if (!Reader) throw new Error('ZXing not loaded');
    const reader = new Reader();
    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (result) onCode(result.getText());
    });
    onStatus('Scanning…');
    registerStop(() => {
      try {
        if (controls && typeof controls.stop === 'function') controls.stop();
        else if (typeof reader.reset === 'function') reader.reset();
      } catch { /* ignore */ }
    });
  } catch (e) {
    onStatus(`Scanner unavailable: ${e?.message || e}. Type the digits below.`);
  }
}
