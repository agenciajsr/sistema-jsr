// Logos de marca (SVG inline) para o card "Acessos e contas" da ficha.
// O lucide-react 1.24 removeu os ícones de marca (Instagram/Facebook/Chrome),
// então reproduzimos versões limpas e reconhecíveis nas cores oficiais.

type LogoProps = { className?: string }

export function MetaLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ficha-meta-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0064E0" />
          <stop offset="1" stopColor="#0082FB" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="#fff" stroke="#E5E7EB" />
      <path
        d="M12 12 C 10.6 9.5, 9.2 8.5, 7.3 8.5 C 5 8.5, 3.5 10.1, 3.5 12 C 3.5 13.9, 5 15.5, 7.3 15.5 C 9.2 15.5, 10.6 14.5, 12 12 C 13.4 9.5, 14.8 8.5, 16.7 8.5 C 19 8.5, 20.5 10.1, 20.5 12 C 20.5 13.9, 19 15.5, 16.7 15.5 C 14.8 15.5, 13.4 14.5, 12 12 Z"
        fill="none"
        stroke="url(#ficha-meta-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function GoogleAdsLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#fff" stroke="#E5E7EB" />
      <rect x="7.2" y="4.5" width="3.6" height="11.5" rx="1.8" fill="#4285F4" transform="rotate(-22 9 10.2)" />
      <rect x="13.2" y="4.5" width="3.6" height="11.5" rx="1.8" fill="#FBBC04" transform="rotate(22 15 10.2)" />
      <circle cx="12" cy="18" r="2.3" fill="#34A853" />
    </svg>
  )
}

export function GoogleAnalyticsLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#fff" stroke="#E5E7EB" />
      <rect x="6" y="12" width="3.6" height="7" rx="1.8" fill="#F9AB00" />
      <rect x="11.6" y="9" width="3.6" height="10" rx="1.8" fill="#E37400" />
      <circle cx="18" cy="8.2" r="2.4" fill="#F9AB00" />
    </svg>
  )
}

export function InstagramLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ficha-ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.3" stopColor="#FA7E1E" />
          <stop offset="0.6" stopColor="#D62976" />
          <stop offset="1" stopColor="#962FBF" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ficha-ig-grad)" />
      <rect x="5" y="5" width="14" height="14" rx="4.5" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16.4" cy="7.6" r="1.05" fill="#fff" />
    </svg>
  )
}
