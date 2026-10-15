/** Position within a source's own scale. Colour identifies the column, never "better". */
export function StatBar({ value, min, max, tone, label }: { value: number; min: number; max: number; tone: 'a' | 'b'; label: string }) {
  return <meter className={`stat-bar stat-bar-${tone}`} min={min} max={max} value={value} aria-label={label}>{value}</meter>;
}
