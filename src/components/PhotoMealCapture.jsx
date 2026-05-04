import { useEffect, useRef, useState } from 'react';
import { parseFoodTranscript } from '../utils/parser.js';
import MicField from './MicField.jsx';

// Snap a photo of a meal now, fill in the macros later. Solves the "I'll
// log it after I eat" problem that kills most food-tracking attempts.
//
// Two-stage flow:
//   1. Capture: <input type="file" capture="environment"> opens the camera,
//      we compress the photo to ~80 KB JPEG and stash it in
//      state.photoMeals as a placeholder. Adds a corresponding zero-macro
//      entry to state.foodEntries with a needsMacros flag.
//   2. Resolve: when the user taps the entry's "Add macros" chip, this
//      modal shows the photo + a description input + voice mic. The
//      typed/dictated description runs through the existing parser, the
//      entry is updated with real macros, and the photo is removed from
//      photoMeals storage.
//
// All client-side. Photos never leave the device.
export default function PhotoMealCapture({ entry, photoMeals, onResolve, onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const photo = entry?.photoId ? photoMeals?.[entry.photoId] : null;
  const fileRef = useRef(null);

  const submit = () => {
    if (!text.trim()) return;
    setBusy(true);
    const items = parseFoodTranscript(text).filter((i) => !i.unknown);
    if (!items.length) { setBusy(false); return; }
    // Sum macros across all matched items so a multi-line description
    // like "150g chicken, 1 cup rice, half avocado" lands as one entry.
    const summed = items.reduce(
      (acc, i) => ({
        kcal:       acc.kcal + (i.kcal || 0),
        protein:    round1(acc.protein    + (i.protein    || 0)),
        carbs:      round1(acc.carbs      + (i.carbs      || 0)),
        fat:        round1(acc.fat        + (i.fat        || 0)),
        fiber:      round1(acc.fiber      + (i.fiber      || 0)),
        sugars:     round1(acc.sugars     + (i.sugars     || 0)),
        freeSugars: round1(acc.freeSugars + (i.freeSugars != null ? i.freeSugars : (i.sugars || 0))),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, freeSugars: 0 }
    );
    const name = items.length === 1 ? items[0].name : `${items[0].name} + ${items.length - 1} more`;
    const merged = {
      name,
      amount: items.length === 1 ? items[0].amount : items.reduce((a, i) => a + (i.amount || 0), 0),
      unit: items[0].unit,
      group: items[0].group,
      foodId: items.length === 1 ? items[0].foodId : null,
      brandFoodId: items.length === 1 ? items[0].brandFoodId : null,
      ...summed,
    };
    onResolve(entry, merged);
  };

  return (
    <div className="fixed inset-0 z-50 overlay flex items-end sm:items-center justify-center p-2"
         onClick={onClose}>
      <div className="card w-full max-w-md p-4 sm:p-5 fade-up max-h-[92vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted">Meal photo</p>
            <h3 className="font-display text-lg leading-tight">Add macros</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-plum text-sm" aria-label="Close">×</button>
        </div>

        {photo && (
          <div className="rounded-2xl overflow-hidden mb-3 bg-sand">
            <img src={photo.dataUrl} alt="Meal" className="w-full h-auto"/>
          </div>
        )}

        <label className="block text-[11px] uppercase tracking-wide text-muted mb-1">Describe what you ate</label>
        <MicField as="textarea" value={text} onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder='e.g. "150g chicken, 1 cup rice, half an avocado"'
          className="input"/>

        <p className="text-[11px] text-muted mt-2">
          The parser handles brand names, grams, and common quantities. Entries you can't match get a "Skip"
          option in the result list.
        </p>

        <div className="flex items-center justify-between mt-3 gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">Later</button>
          <button onClick={submit} disabled={!text.trim() || busy}
            className="btn-primary text-sm h-10 px-5">{busy ? 'Saving…' : 'Save macros'}</button>
        </div>
      </div>
    </div>
  );
}

// Compress a File/Blob into a JPEG dataURL no wider than maxW pixels.
// Keeps the browser-localStorage footprint tiny — a 4032×3024 iPhone
// photo lands at ~50–80 KB without visible quality loss for thumbnail
// display. Returns null on failure (caller should fall back to text).
export async function compressPhoto(file, maxW = 720, quality = 0.72) {
  if (!file) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const ratio = img.width > maxW ? maxW / img.width : 1;
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const round1 = (n) => Math.round(n * 10) / 10;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
