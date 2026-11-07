import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// a cena 3D precisa de WebGL, que o jsdom não tem: trocamos por um marcador simples
vi.mock('../src/components/MugScene.jsx', () => ({
  default: () => <div data-testid="scene" />,
}))

import App from '../src/App.jsx'
import { ToastProvider } from '../src/components/Toast.jsx'

function mount() {
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>
  )
}

describe('App (desktop)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('abre com o cabeçalho, o painel em abas e a cena', async () => {
    mount()

    expect(await screen.findByText('Seu mockup')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Modelo/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Arte/ })).toBeTruthy()
    expect(await screen.findByTestId('scene')).toBeTruthy()
  })

  it('navega pelas etapas com Próximo e Voltar', async () => {
    mount()

    await screen.findByText('Seu mockup')

    fireEvent.click(screen.getByRole('button', { name: /Próximo: Arte/ }))
    expect(screen.getAllByText(/PASSO\s*2\s*DE\s*4/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }))
    expect(screen.getAllByText(/PASSO\s*1\s*DE\s*4/).length).toBeGreaterThan(0)
  })

  it('alterna entre os três tamanhos de visualização', async () => {
    mount()

    await screen.findByText('Seu mockup')

    fireEvent.click(screen.getByRole('radio', { name: 'Tamanho quadrado' }))
    expect(document.querySelector('.stage[data-view="square"]')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Tamanho expandido' }))
    expect(document.querySelector('.m-app.m-desktop')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('.stage[data-view="wide"]')).toBeTruthy()
  })

  it('salva as configurações automaticamente e restaura ao reabrir', async () => {
    vi.useFakeTimers()

    const first = mount()

    await act(async () => { vi.advanceTimersByTime(800) })

    const stored = JSON.parse(localStorage.getItem('almatie-mockup:project:v1'))
    expect(stored.v).toBe(1)
    expect(stored.modelId).toBeTruthy()

    first.unmount()
    vi.useRealTimers()
  })

  it('botões de desfazer/refazer começam desativados', async () => {
    mount()

    await screen.findByText('Seu mockup')

    expect(screen.getByRole('button', { name: 'Desfazer' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Refazer' }).disabled).toBe(true)
  })
})
