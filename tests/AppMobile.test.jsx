import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../src/components/MugScene.jsx', () => ({
  default: () => <div data-testid="scene" />,
}))

import App from '../src/App.jsx'
import { ToastProvider } from '../src/components/Toast.jsx'

describe('App (celular)', () => {
  const original = window.matchMedia

  beforeEach(() => {
    localStorage.clear()

    // simula tela estreita: o hook useIsMobile passa a responder "sim"
    window.matchMedia = (query) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  })

  afterEach(() => {
    window.matchMedia = original
  })

  it('mostra o app com abas inferiores e abre o painel de arte', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    )

    const tabbar = await screen.findByRole('navigation', { name: /Seções do editor/ })
    expect(tabbar).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Arte/ }))

    expect(document.querySelector('.m-app[data-sheet="half"]')).toBeTruthy()
    expect(document.querySelector('.art-slots')).toBeTruthy()
  })

  it('a visão limpa esconde os controles e volta', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    )

    await screen.findByRole('navigation', { name: /Seções do editor/ })

    fireEvent.click(screen.getByRole('button', { name: /Visão limpa/ }))
    expect(document.querySelector('.m-app[data-clean="true"]')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Mostrar controles/ }))
    expect(document.querySelector('.m-app[data-clean="false"]')).toBeTruthy()
  })
})
