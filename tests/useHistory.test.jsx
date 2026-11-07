import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from '../src/hooks/useHistory.js'

describe('useHistory (desfazer / refazer)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    let hook
    // como no app, restaurar atualiza o estado (e portanto o snapshot)
    const restore = vi.fn((snap) => hook.rerender({ snap }))

    hook = renderHook(({ snap }) => useHistory(snap, restore), {
      initialProps: { snap: { color: 'a', size: 1 } },
    })

    // passa o período de "aquecimento" (restauração do salvamento automático)
    act(() => { vi.advanceTimersByTime(3000) })

    return { hook, restore }
  }

  it('várias mudanças seguidas viram um único passo', () => {
    const { hook } = setup()

    hook.rerender({ snap: { color: 'b', size: 1 } })
    act(() => { vi.advanceTimersByTime(100) })
    hook.rerender({ snap: { color: 'c', size: 1 } })
    act(() => { vi.advanceTimersByTime(600) })

    expect(hook.result.current.canUndo).toBe(true)

    act(() => hook.result.current.undo())
    expect(hook.result.current.canUndo).toBe(false)
    expect(hook.result.current.canRedo).toBe(true)
  })

  it('desfaz e refaz devolvendo a fotografia correta', () => {
    const { hook, restore } = setup()

    hook.rerender({ snap: { color: 'b', size: 1 } })
    act(() => { vi.advanceTimersByTime(600) })

    act(() => hook.result.current.undo())
    expect(restore).toHaveBeenLastCalledWith({ color: 'a', size: 1 })
    expect(hook.result.current.canRedo).toBe(true)

    act(() => hook.result.current.redo())
    expect(restore).toHaveBeenLastCalledWith({ color: 'b', size: 1 })
  })

  it('uma mudança nova depois de desfazer descarta o "refazer"', () => {
    const { hook } = setup()

    hook.rerender({ snap: { color: 'b', size: 1 } })
    act(() => { vi.advanceTimersByTime(600) })
    act(() => hook.result.current.undo())

    hook.rerender({ snap: { color: 'z', size: 1 } })
    act(() => { vi.advanceTimersByTime(600) })

    expect(hook.result.current.canRedo).toBe(false)
  })

  it('mudanças logo após abrir (restauração) não entram no histórico', () => {
    const restore = vi.fn()
    const hook = renderHook(({ snap }) => useHistory(snap, restore), {
      initialProps: { snap: { v: 1 } },
    })

    hook.rerender({ snap: { v: 2 } })
    act(() => { vi.advanceTimersByTime(600) })

    expect(hook.result.current.canUndo).toBe(false)
  })
})
