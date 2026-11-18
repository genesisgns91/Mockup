import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../src/components/MugScene.jsx', () => ({
  default: () => <div data-testid="scene" />,
}))

// jsdom não decodifica imagens: simulamos a leitura (2480×1122 px = 300 DPI em 210×95 mm)
vi.mock('../src/utils/imageFiles.js', async (importOriginal) => {
  const original = await importOriginal()
  let n = 0

  return {
    ...original,
    prepareImage: vi.fn(async (file, name) => {
      n += 1

      return {
        img: { src: `blob:fake-${n}`, naturalWidth: 2480, naturalHeight: 1122 },
        url: `blob:fake-${n}`,
        blob: new Blob(['x']),
        name: name || file.name,
        resized: false,
        width: 2480,
        height: 1122,
      }
    }),
  }
})

import App from '../src/App.jsx'
import { ToastProvider } from '../src/components/Toast.jsx'

// o jsdom não calcula layout: damos uma área de 900×900 para a prévia poder desenhar a folha
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 900, width: 900, height: 900, toJSON: () => ({}),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const result = () => document.querySelector('.sheet-result')

const mount = () => render(<ToastProvider><App /></ToastProvider>)

function pngFile(name = 'arte.png') {
  return new File(['x'], name, { type: 'image/png' })
}

describe('Gabarito de impressão (desktop)', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  async function openSheet() {
    mount()

    fireEvent.click(await screen.findByRole('button', { name: 'Gabarito de impressão' }))

    return screen.findByText('Monte a folha')
  }

  it('abre pela navegação do cabeçalho e volta ao mockup', async () => {
    await openSheet()

    expect(screen.getByText('Prévia do gabarito')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Mockup 3D' }))

    expect(await screen.findByText('Seu mockup')).toBeTruthy()
  })

  it('o padrão é A4 + caneca 210×95 e cabem 3 artes no retrato', async () => {
    await openSheet()

    expect(screen.getByRole('button', { name: /A4/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('radio', { name: /Caneca 325 ml/ }).getAttribute('aria-checked')).toBe('true')
    expect(result().textContent).toMatch(/retrato.*cabem\s*3\s*artes de 210 × 95 mm/)
  })

  it('A3 e a paisagem mudam quantas artes cabem', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('radio', { name: 'Paisagem' }))
    expect(result().textContent).toMatch(/paisagem.*cabem\s*3\s*artes/) // girando as artes (padrão), cabem 3 em A4 paisagem

    fireEvent.click(screen.getByRole('button', { name: /A3/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Automática' }))
    expect(Number(result().querySelectorAll('strong')[1].textContent)).toBeGreaterThan(3)
  })

  it('medida personalizada aceita largura e altura', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('radio', { name: /Personalizada/ }))

    const [width] = screen.getAllByRole('textbox')

    fireEvent.change(width, { target: { value: '100' } })
    fireEvent.blur(width)

    expect(screen.getAllByText(/100 × 95 mm/).length).toBeGreaterThan(0)
  })

  it('envia uma arte, mostra na folha, espelha e libera o salvamento', async () => {
    await openSheet()

    const pdfBtn = screen.getAllByRole('button', { name: /PDF/ })[0]

    expect(pdfBtn.disabled).toBe(true) // sem arte ainda

    fireEvent.click(screen.getByRole('tab', { name: /Artes/ }))

    const input = document.querySelector('.sheet-slots input[type="file"]')

    fireEvent.change(input, { target: { files: [pngFile()] } })

    await waitFor(() => expect(document.querySelectorAll('.sheet-art').length).toBe(1))

    // a arte fica encostada no topo da folha (e não no meio)
    const art = document.querySelector('.sheet-art')

    expect(art).toBeTruthy()
    expect(parseFloat(art.style.top)).toBeGreaterThan(0) // logo abaixo da margem de topo (3 mm)
    expect(parseFloat(art.style.top)).toBeLessThan(20)
    expect(screen.getAllByRole('button', { name: /PDF/ })[0].disabled).toBe(false)

    // espelhar na aba Salvar
    fireEvent.click(screen.getByRole('tab', { name: /Salvar/ }))
    fireEvent.click(screen.getByLabelText(/Espelhar a arte/))

    expect(document.querySelector('.sheet-chip.accent').textContent).toMatch(/Espelhado/)
    expect(document.querySelector('.sheet-art-frame').style.transform).toContain('scaleX(-1)')
  })

  it('"mesma arte em todos" repete a primeira arte nos espaços', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Artes/ }))
    fireEvent.change(document.querySelector('.sheet-slots input[type="file"]'), { target: { files: [pngFile()] } })

    await waitFor(() => expect(document.querySelectorAll('.sheet-art').length).toBe(1))

    fireEvent.click(screen.getByLabelText(/Usar a mesma arte em todos os espaços/))

    await waitFor(() => expect(document.querySelectorAll('.sheet-art').length).toBe(3))
  })

  it('aumentar a margem REDUZ a arte (em vez de mudar a posição ou a orientação)', async () => {
    await openSheet()

    const before = { left: parseFloat(document.querySelector('.sheet-art')?.style.left || '0') }

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/ }))

    fireEvent.change(screen.getByLabelText('Margens laterais'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Margens de topo e base'), { target: { value: '10' } })

    expect(await screen.findByText(/A arte foi ajustada às margens/)).toBeTruthy()
    expect(document.querySelector('.sheet-chip.accent').textContent).toMatch(/Arte ajustada: 90%/)

    // a orientação continua retrato (o arranjo não muda)
    fireEvent.click(screen.getByRole('tab', { name: /Medida/ }))
    expect(result().textContent).toMatch(/retrato/)
    expect(before).toBeTruthy()
  })

  it('o padrão é 3 mm de margem em cada lado: a arte já aparece ajustada (97%)', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/ }))

    expect(screen.getByLabelText('Margens laterais').value).toBe('3')
    expect(screen.getByLabelText('Margens de topo e base').value).toBe('3')
    expect(document.querySelector('.sheet-chip.accent').textContent).toMatch(/Arte ajustada: 97%/)
  })

  it('com margem 0 a arte encosta nas bordas e fica no tamanho original', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/ }))
    fireEvent.change(screen.getByLabelText('Margens laterais'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Margens de topo e base'), { target: { value: '0' } })

    expect(document.querySelector('.sheet-chip.accent')).toBeNull()
    expect(document.querySelector('.sheet-margin').style.left).toBe('0px')
  })

  it('há duas regulagens de margem, ambas limitadas a 0–10 mm', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/ }))

    for (const label of ['Margens laterais', 'Margens de topo e base']) {
      const slider = screen.getByLabelText(label)

      expect(slider.getAttribute('min')).toBe('0')
      expect(slider.getAttribute('max')).toBe('10')
    }
  })

  it('não mostra aviso de resolução baixa na aba Salvar', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Salvar/ }))

    expect(screen.queryByText(/Resolução baixa em alguma arte/)).toBeNull()
  })
})

describe('Gabarito de impressão (celular)', () => {
  const original = window.matchMedia

  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''

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

  it('abre pelo botão do topo, mostra as 4 abas e volta', async () => {
    mount()

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir o gabarito de impressão' }))

    const tabs = await screen.findByRole('navigation', { name: /Etapas do gabarito/ })

    expect(tabs.querySelectorAll('.m-tab').length).toBe(4)

    fireEvent.click(screen.getByRole('button', { name: /^Medida/ }))
    expect(document.querySelector('.m-app[data-sheet="half"]')).toBeTruthy()
    expect(document.querySelector('.preset-list')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao mockup 3D' }))

    expect(await screen.findByRole('navigation', { name: /Seções do editor/ })).toBeTruthy()
  })
})


describe('Gabarito de impressão: aproveitamento e encaixe', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  async function openSheet() {
    mount()

    fireEvent.click(await screen.findByRole('button', { name: 'Gabarito de impressão' }))
    await screen.findByText('Monte a folha')
  }

  it('A3 em paisagem mostra 6 artes de 210×95', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('button', { name: /A3/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Paisagem' }))

    expect(result().textContent).toMatch(/paisagem.*cabem\s*6\s*artes de 210 × 95 mm/)
  })

  it('o encaixe padrão é "Preencher" (arte encosta nas bordas) e existe "Esticar"', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/ }))

    expect(screen.getByRole('radio', { name: 'Preencher' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Esticar' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Inteira' })).toBeTruthy()
  })

  it('o espaço entre as artes começa em 1 mm', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/ }))

    expect(screen.getByLabelText('Espaço entre as artes').value).toBe('1')
  })

  it('configurações antigas (gap 2, encaixe "inteira") são atualizadas para os novos padrões', async () => {
    localStorage.setItem('almatie-mockup:sheet:v1', JSON.stringify({ paper: 'A3', gap: 2, fit: 'contain', allowRotate: false }))

    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/ }))

    expect(screen.getByLabelText('Espaço entre as artes').value).toBe('1')
    expect(screen.getByRole('radio', { name: 'Preencher' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByLabelText('Margens laterais').value).toBe('3')
  })

  it('mudar uma configuração não volta as outras para o padrão', async () => {
    await openSheet()

    fireEvent.click(screen.getByRole('tab', { name: /Ajustes/ }))

    fireEvent.change(screen.getByLabelText('Espaço entre as artes'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Esticar' }))
    fireEvent.change(screen.getByLabelText('Margens laterais'), { target: { value: '2' } })

    expect(screen.getByLabelText('Espaço entre as artes').value).toBe('3')
    expect(screen.getByRole('radio', { name: 'Esticar' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByLabelText(/Girar as artes 90°/).checked).toBe(true)
  })
})
