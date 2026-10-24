type Props<T extends string | number> = {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  label: string
}

/** iOS-segmentväljare med en glidande markering. */
export function Segmented<T extends string | number>({ options, value, onChange, label }: Props<T>) {
  const index = options.findIndex((o) => o.value === value)
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {index >= 0 && (
        <div
          className="segmented-thumb"
          style={{
            width: `calc((100% - 4px) / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`segmented-option ${o.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
