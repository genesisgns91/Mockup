// Ambiente de teste (jsdom): recursos do navegador que o app usa e o jsdom não tem.
import { vi } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub

if (typeof window !== 'undefined') {
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
