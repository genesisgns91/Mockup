import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

vi.mock('../src/components/MugScene.jsx', () => ({
  default: () => <div data-testid="scene" />,
}))

// o jsdom não decodifica imagens: simulamos a leitura (2480×1122 px = 210×95 mm a 300 DPI)
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

// máscaras opacas (sem canvas)
vi.mock('../src/dtf/masks.js', async () => {
  const { solidMask } = await import('../src/dtf/overlap.js')

  return { buildMask: () => solidMask() }
})

import App from '../src/App.jsx'
import { ToastProvider } from '../src/components/Toast.jsx'

const mount = () => render(<ToastProvider><App /></ToastProvider>)
const png = (name) => new File(['x'], name, { type: 'image/png' })
const editor = () => document.querySelector('.dtf-editor')
const objs = () => [...document.querySelectorAll('.dtf-obj')]

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''

  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 900, width: 900, height: 900, toJSON: () => ({}),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function openDtf() {
  mount()

  fireEvent.click(await screen.findByRole('button', { name: 'Gabarito de impressão' }))
  fireEvent.click(await screen.findByRole('radio', { name: 'Gabarito DTF' }))

  return screen.findByText('Folha livre')
}

async function addImages(count) {
  const input = document.querySelector('.dtf-stage input[type="file"]')
  const files = Array.from({ length: count }, (_, i) => png(`arte-${i + 1}.png`))

  fireEvent.change(input, { target: { files } })

  await waitFor(() => expect(objs().length).toBe(count))
}

// centro de um objeto, em pixels de tela (as imagens são desenhadas direto em pixels)
function centerOf(index) {
  const el = objs()[index]

  return {
    x: parseFloat(el.style.left) + parseFloat(el.style.width) / 2,
    y: parseFloat(el.style.top) + parseFloat(el.style.height) / 2,
  }
}

const mmBox = (index) => {
  const el = objs()[index]
  const w = Number(el.dataset.w)
  const h = Number(el.dataset.h)

  return { x: Number(el.dataset.cx) - w / 2, y: Number(el.dataset.cy) - h / 2, w, h }
}

const down = (x, y, extra = {}) =>
  fireEvent.pointerDown(editor(), { clientX: x, clientY: y, pointerId: 1, button: 0, ...extra })
const move = (x, y, extra = {}) =>
  fireEvent.pointerMove(editor(), { clientX: x, clientY: y, pointerId: 1, ...extra })
const up = (x, y) => fireEvent.pointerUp(editor(), { clientX: x, clientY: y, pointerId: 1 })

describe('Gabarito DTF (desktop)', () => {
  it('abre pelo seletor de modo e mostra a folha vazia com o convite para inserir', async () => {
    await openDtf()

    expect(screen.getByText('Insira suas imagens')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /PDF/ })[0].disabled).toBe(true)
  })

  it('várias imagens de uma vez são distribuídas pela folha sem sobrepor', async () => {
    await openDtf()
    await addImages(3)

    const boxes = objs().map((el) => {
      const w = Number(el.dataset.w)
      const h = Number(el.dataset.h)

      return { x: Number(el.dataset.cx) - w / 2, y: Number(el.dataset.cy) - h / 2, w, h }
    })

    // todas dentro da folha (210×297) e sem sobreposição
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w).toBeLessThanOrEqual(210)
      expect(b.y + b.h).toBeLessThanOrEqual(297)
    }

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]
        const b = boxes[j]

        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false)
      }
    }

    expect(screen.getAllByRole('button', { name: /PDF/ })[0].disabled).toBe(false)
    expect(document.querySelector('.dtf-chips').textContent).toMatch(/3 imagens/)
  })

  it('clicar seleciona e mostra as 8 alças + a alça de girar', async () => {
    await openDtf()
    await addImages(2)

    const c = centerOf(0)

    down(c.x, c.y)
    up(c.x, c.y)

    await waitFor(() => expect(document.querySelectorAll('.dtf-handle').length).toBe(9))
    expect(document.querySelector('.dtf-handle.rotate')).toBeTruthy()
    expect(document.querySelector('.dtf-quickbar')).toBeTruthy()
  })

  it('arrastar move a imagem', async () => {
    await openDtf()
    await addImages(1)

    const before = parseFloat(objs()[0].style.left)
    const c = centerOf(0)

    down(c.x, c.y)
    move(c.x + 30, c.y + 10, { buttons: 1 })
    move(c.x + 60, c.y + 20, { buttons: 1 })
    up(c.x + 60, c.y + 20)

    await waitFor(() => expect(parseFloat(objs()[0].style.left)).toBeGreaterThan(before))
  })

  it('arrastar uma alça de canto redimensiona mantendo a proporção', async () => {
    await openDtf()
    await addImages(1)

    const c = centerOf(0)

    down(c.x, c.y)
    up(c.x, c.y)

    await waitFor(() => expect(document.querySelector('.dtf-handle.h-se')).toBeTruthy())

    const w0 = parseFloat(objs()[0].style.width)
    const h0 = parseFloat(objs()[0].style.height)
    const handle = document.querySelector('.dtf-handle.h-se')

    // o ponto do canto inferior direito, em pixels de tela
    const frame = document.querySelector('.dtf-frame')
    const fx = parseFloat(frame.style.left) + parseFloat(frame.style.width)
    const fy = parseFloat(frame.style.top) + parseFloat(frame.style.height)

    fireEvent.pointerDown(handle, { clientX: fx, clientY: fy, pointerId: 1, button: 0 })
    move(fx - 60, fy - 30, { buttons: 1 })
    up(fx - 60, fy - 30)

    await waitFor(() => expect(parseFloat(objs()[0].style.width)).toBeLessThan(w0))

    const w1 = parseFloat(objs()[0].style.width)
    const h1 = parseFloat(objs()[0].style.height)

    expect(w1 / h1).toBeCloseTo(w0 / h0, 2)
  })

  it('editar a largura pelo painel (proporção presa) muda também a altura', async () => {
    await openDtf()
    await addImages(1)

    const c = centerOf(0)

    down(c.x, c.y)
    up(c.x, c.y)

    // a aba "Objeto" abre sozinha quando se seleciona na folha estando em outra aba
    fireEvent.click(await screen.findByRole('tab', { name: /Objeto/ }))

    const width = screen.getByText('Largura').closest('label').querySelector('input')
    const h0 = mmBox(0).h
    const w0 = mmBox(0).w

    fireEvent.change(width, { target: { value: '100' } })
    fireEvent.blur(width)

    await waitFor(() => expect(mmBox(0).w).toBeCloseTo(100, 0))
    expect(mmBox(0).h).toBeCloseTo((h0 / w0) * 100, 0)
  })

  it('girar 90° pelo painel altera o ângulo', async () => {
    await openDtf()
    await addImages(1)

    const c = centerOf(0)

    down(c.x, c.y)
    up(c.x, c.y)

    fireEvent.click(await screen.findByRole('tab', { name: /Objeto/ }))
    fireEvent.click(screen.getByRole('button', { name: /Girar 90° ↻/ }))

    await waitFor(() => expect(objs()[0].style.transform).toContain('rotate(90deg)'))
  })

  it('"Frente" e "Trás" mudam a ordem das camadas', async () => {
    await openDtf()
    await addImages(2)

    const firstSrc = objs()[0].querySelector('img').getAttribute('src')

    const c = centerOf(0)

    down(c.x, c.y)
    up(c.x, c.y)

    fireEvent.click(await screen.findByRole('tab', { name: /Objeto/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Frente/ }))

    await waitFor(() => expect(objs()[1].querySelector('img').getAttribute('src')).toBe(firstSrc))

    fireEvent.click(screen.getByRole('button', { name: /^Trás/ }))

    await waitFor(() => expect(objs()[0].querySelector('img').getAttribute('src')).toBe(firstSrc))
  })

  it('sobrepor duas imagens gera o aviso de sobreposição', async () => {
    await openDtf()
    await addImages(2)

    expect(document.querySelector('.dtf-chips').textContent).not.toMatch(/Sobreposição/)

    // seleciona a 2ª e joga em cima da 1ª pelas coordenadas X/Y
    const c = centerOf(1)

    down(c.x, c.y)
    up(c.x, c.y)

    fireEvent.click(await screen.findByRole('tab', { name: /Objeto/ }))

    const x = screen.getByText('X').closest('label').querySelector('input')
    const y = screen.getByText('Y').closest('label').querySelector('input')

    fireEvent.change(x, { target: { value: String(mmBox(0).x) } })
    fireEvent.blur(x)
    fireEvent.change(y, { target: { value: String(mmBox(0).y + 10) } })
    fireEvent.blur(y)

    await waitFor(() => expect(document.querySelector('.dtf-chips').textContent).toMatch(/Sobreposição: 1/), { timeout: 3000 })
  })

  it('aumentar demais uma imagem avisa qualidade muito baixa', async () => {
    await openDtf()
    await addImages(1)

    const c = centerOf(0)

    down(c.x, c.y)
    up(c.x, c.y)

    fireEvent.click(await screen.findByRole('tab', { name: /Objeto/ }))

    const width = screen.getByText('Largura').closest('label').querySelector('input')

    fireEvent.change(width, { target: { value: '400' } }) // 2480 px em 400 mm ≈ 157 DPI... depois 600 mm
    fireEvent.blur(width)
    fireEvent.change(width, { target: { value: '600' } })
    fireEvent.blur(width)

    await waitFor(() => expect(document.querySelector('.dtf-chips').textContent).toMatch(/Qualidade baixa: 1/), { timeout: 3000 })
    expect(screen.getByRole('alert').textContent).toMatch(/Qualidade muito baixa/)
  })

  it('Delete exclui a imagem selecionada', async () => {
    await openDtf()
    await addImages(2)

    const c = centerOf(0)

    down(c.x, c.y)
    up(c.x, c.y)

    fireEvent.keyDown(window, { key: 'Delete' })

    await waitFor(() => expect(objs().length).toBe(1))
  })

  it('arrastar numa área vazia (marquee) seleciona várias imagens', async () => {
    await openDtf()
    await addImages(3)

    // arrasta do canto da tela (fora da folha) até cobrir tudo
    down(5, 5)
    move(890, 890, { buttons: 1 })
    up(890, 890)

    await waitFor(() => expect(document.querySelectorAll('.dtf-frame').length).toBe(3))
    expect(document.querySelectorAll('.dtf-handle').length).toBe(0) // vários: sem alças
  })

  it('o painel "Salvar" oferece 300 e 600 DPI e PDF/PNG com fundo transparente', async () => {
    await openDtf()
    await addImages(1)

    fireEvent.click(screen.getByRole('tab', { name: /Salvar/ }))

    expect(screen.getByRole('radio', { name: /300 DPI/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /600 DPI/ })).toBeTruthy()
    expect(screen.getByText(/transparente/, { selector: 'strong' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Salvar PDF/ }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: /Salvar PNG/ }).disabled).toBe(false)
  })

  it('lembra o modo DTF e a folha escolhida', async () => {
    await openDtf()

    fireEvent.click(screen.getByRole('tab', { name: /Folha/ }))
    fireEvent.click(screen.getByRole('button', { name: /A3/ }))

    expect(localStorage.getItem('almatie-mockup:sheet-mode')).toBe('dtf')
    expect(document.querySelector('.dtf-chips').textContent).toMatch(/A3/)
  })
})

describe('Gabarito DTF: nitidez das imagens na tela', () => {
  it('as imagens são desenhadas em pixels de tela (sem ampliar a folha por CSS)', async () => {
    await openDtf()
    await addImages(1)

    // nada de transform:scale na folha: a ampliação por CSS deixava as imagens serrilhadas e embaçadas
    const world = document.querySelector('.dtf-world')

    expect(world.style.transform).toBe('')
    expect(world.getAttribute('style') || '').not.toMatch(/scale/)

    // o tamanho em pixels é o tamanho em mm vezes a escala da tela
    const el = objs()[0]
    const px = parseFloat(el.style.width)
    const mm = Number(el.dataset.w)

    expect(px / mm).toBeGreaterThan(1)
    expect(el.style.transform).toBe('') // sem giro/espelho: sem transform, bordas nítidas
  })

  it('a imagem usa o arquivo original (a prévia só entra em imagens enormes)', async () => {
    await openDtf()
    await addImages(1)

    expect(objs()[0].querySelector('img').getAttribute('src')).toMatch(/^blob:fake-/)
  })
})

describe('Gabarito DTF (celular)', () => {
  const original = window.matchMedia

  beforeEach(() => {
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

  it('abre o DTF no app: abas, botão de adicionar e editor em tela cheia', async () => {
    mount()

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir o gabarito de impressão' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Gabarito DTF' }))

    const tabs = await screen.findByRole('navigation', { name: /Etapas do gabarito DTF/ })

    expect(tabs.querySelectorAll('.m-tab').length).toBe(4)
    expect(screen.getAllByRole('button', { name: 'Adicionar imagens' }).length).toBeGreaterThan(0)
    expect(document.querySelector('.dtf-editor.compact')).toBeTruthy()
  })
})
