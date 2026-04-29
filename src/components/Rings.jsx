// Compact progress ring for kcal/protein/etc.
export default function Ring({ value, target, label, sub, size=110, stroke=10, color='#5E7257' }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} stroke="#EFE6D8" strokeWidth={stroke} fill="none"/>
          <circle
            cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${c-dash}`} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-2xl">{Math.round(value)}</div>
          <div className="text-[10px] text-muted -mt-0.5">/ {Math.round(target)}</div>
        </div>
      </div>
      <div className="text-xs font-medium text-plum mt-1">{label}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
