// Compact progress ring. Stone-toned track + soft pastel accent stroke,
// Inter typography for the number, tighter label below.
export default function Ring({ value, target, label, sub, size = 86, stroke = 7, color = '#C99097' }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#E5E1D8" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 600ms cubic-bezier(.4,.0,.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[1.25rem] font-semibold leading-none text-charcoal tabular-nums">{Math.round(value)}</div>
          <div className="text-[9px] text-muted mt-0.5 tabular-nums">/ {Math.round(target)}</div>
        </div>
      </div>
      <div className="text-[11px] font-medium text-charcoal mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted leading-tight text-center">{sub}</div>}
    </div>
  );
}
