import { useEffect, useState } from 'react'

/*
  Celular (retrato) OU celular deitado (pouca altura + toque).
  Tablets e desktop continuam com o layout completo.
*/
const QUERY =
  '(max-width: 760px), (max-height: 480px) and (pointer: coarse)'

function read() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(read)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setIsMobile(mq.matches)

    onChange()
    mq.addEventListener('change', onChange)

    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
