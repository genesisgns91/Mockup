import { useCallback, useEffect, useRef, useState } from 'react'
import { collectUrls, pruneUrls } from '../utils/imageFiles.js'

/*
  ==========================================================
  DESFAZER / REFAZER

  Guarda "fotografias" do projeto (modelo, arte, cores, fundo…).
  Várias mudanças seguidas (ex.: arrastar um slider) viram UM
  passo do histórico, gravado depois de uma pausa.
  ==========================================================
*/

const LIMIT = 40
const QUIET_MS = 450
const WARMUP_MS = 2500 // restauração do salvamento automático não vira "passo"

function shallowEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false

  const keys = Object.keys(a)

  if (keys.length !== Object.keys(b).length) return false

  return keys.every((k) => a[k] === b[k])
}

export function useHistory(snapshot, restore) {
  const state = useRef({
    past: [],
    future: [],
    last: null,
    timer: null,
    start: Date.now(),
  })

  const latest = useRef(snapshot)
  latest.current = snapshot

  const restoreRef = useRef(restore)
  restoreRef.current = restore

  const [flags, setFlags] = useState({ undo: false, redo: false })

  const sync = useCallback(() => {
    const s = state.current
    setFlags({ undo: s.past.length > 0, redo: s.future.length > 0 })
  }, [])

  const commit = useCallback(() => {
    const s = state.current

    if (s.timer) {
      clearTimeout(s.timer)
      s.timer = null
    }

    if (s.last && !shallowEqual(s.last, latest.current)) {
      s.past.push(s.last)

      if (s.past.length > LIMIT) s.past.shift()

      s.future = []
    }

    s.last = latest.current

    pruneUrls(collectUrls([...s.past, ...s.future, s.last]))

    sync()
  }, [sync])

  useEffect(() => {
    const s = state.current

    if (!s.last) {
      s.last = snapshot
      return undefined
    }

    if (shallowEqual(snapshot, s.last)) return undefined

    if (Date.now() - s.start < WARMUP_MS) {
      s.last = snapshot
      return undefined
    }

    if (s.timer) clearTimeout(s.timer)

    s.timer = setTimeout(commit, QUIET_MS)

    return undefined
  }, [snapshot, commit])

  useEffect(() => () => {
    if (state.current.timer) clearTimeout(state.current.timer)
  }, [])

  // consolida uma edição ainda "em andamento" antes de desfazer/refazer
  const flush = useCallback(() => {
    if (state.current.timer) commit()
  }, [commit])

  const undo = useCallback(() => {
    flush()

    const s = state.current
    const target = s.past.pop()

    if (!target) return

    s.future.push(s.last)
    s.last = target

    restoreRef.current(target)
    sync()
  }, [flush, sync])

  const redo = useCallback(() => {
    flush()

    const s = state.current
    const target = s.future.pop()

    if (!target) return

    s.past.push(s.last)
    s.last = target

    restoreRef.current(target)
    sync()
  }, [flush, sync])

  return { undo, redo, canUndo: flags.undo, canRedo: flags.redo }
}
