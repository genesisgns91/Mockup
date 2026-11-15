// Ambiente de teste (jsdom): recursos do navegador que o app usa e o jsdom não tem.
import { vi } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub

if (typeof window !== 'undefined') {
// o jsdom não traz PointerEvent: criamos um com os campos que o editor usa
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
}

window.matchMedia =
  window.matchMedia ||
  ((query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn()
}
