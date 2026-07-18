import * as React from "react"

const MOBILE_BREAKPOINT = 768

// useSyncExternalStore em vez de useState+useEffect: sem setState síncrono em
// effect (regra react-hooks/set-state-in-effect) e com snapshot de servidor
// determinístico (false) para SSR/hidratação.
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
