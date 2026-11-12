import { useRef } from 'react'

/*
  Vibração curta de "toque" (só em aparelhos que suportam).
*/
export function vibrate(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch {
    // dispositivos sem vibração simplesmente ignoram
  }
}

/*
  Arrastar a folha inferior (bottom sheet) com o dedo: três alturas
  (fechada, meia tela e tela cheia). Compartilhado pelo app do
  mockup e pelo app do gabarito.
*/
export function useSheetDrag({ snap, setSnap, close }) {
  const sheetRef = useRef(null)
  const dragRef = useRef(null)

  /*
    ---------- arrastar o painel ----------
    Durante o arraste mexemos direto no estilo do elemento
    (sem setState) para não re-renderizar a cena 3D a cada
    movimento do dedo.
  */
  const onGrabDown = (e) => {
    const el = sheetRef.current
    if (!el) return

    e.currentTarget.setPointerCapture(e.pointerId)

    dragRef.current = {
      startY: e.clientY,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
      dy: 0,
      moved: false,
    }

    el.style.transition = 'none'
  }

  const onGrabMove = (e) => {
    const d = dragRef.current
    const el = sheetRef.current
    if (!d || !el) return

    const now = performance.now()
    const dt = Math.max(1, now - d.lastT)

    d.velocity = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = now

    let dy = e.clientY - d.startY

    if (Math.abs(dy) > 4) d.moved = true

    // resistência elástica ao puxar além do topo
    const maxUp = snap === 'half' ? -Math.round(window.innerHeight * 0.4) : 0
    if (dy < maxUp) dy = maxUp + (dy - maxUp) * 0.25
    if (snap === 'full' && dy < 0) dy *= 0.2

    d.dy = dy
    el.style.setProperty('--m-drag', `${dy}px`)
  }

  const onGrabUp = (e) => {
    const d = dragRef.current
    const el = sheetRef.current
    dragRef.current = null

    if (!d || !el) return

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ponteiro já liberado
    }

    el.style.transition = ''
    el.style.removeProperty('--m-drag')

    // toque simples no puxador alterna meia tela ↔ tela cheia
    if (!d.moved) {
      vibrate(6)
      setSnap((s) => (s === 'half' ? 'full' : 'half'))
      return
    }

    const fast = Math.abs(d.velocity) > 0.55

    if (snap === 'half') {
      if (d.dy > 70 || (fast && d.velocity > 0)) {
        vibrate(6)
        close()
      } else if (d.dy < -50 || (fast && d.velocity < 0)) {
        vibrate(6)
        setSnap('full')
      }
    } else if (d.dy > 90 || (fast && d.velocity > 0)) {
      vibrate(6)
      if (d.dy > 260) close()
      else setSnap('half')
    }
  }

  return { sheetRef, onGrabDown, onGrabMove, onGrabUp }
}
