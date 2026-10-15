import './ui.css'

/** A labelled native select. `options` is [{ value, label }]. */
export default function SelectField({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
