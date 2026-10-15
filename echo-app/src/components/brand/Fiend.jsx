// The monster Echo fights in the Quiz Arena.
export default function Fiend({ size = 52, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <path d="M16 30 L10 8 L32 22Z" fill="#F2B8B0" stroke="#0B1428" strokeWidth="3" strokeLinejoin="round" />
      <path d="M64 30 L70 8 L48 22Z" fill="#F2B8B0" stroke="#0B1428" strokeWidth="3" strokeLinejoin="round" />
      <rect x="8" y="18" width="64" height="56" rx="26" fill="#D84A38" stroke="#0B1428" strokeWidth="3" />
      <circle cx="29" cy="43" r="8" fill="#fff" />
      <circle cx="51" cy="43" r="8" fill="#fff" />
      <circle cx="31" cy="45" r="3.5" fill="#0B1428" />
      <circle cx="49" cy="45" r="3.5" fill="#0B1428" />
      <path d="M18 31 L36 37 M62 31 L44 37" stroke="#0B1428" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 59 L32 65 L38 59 L44 65 L50 59 L56 65" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
