import { useState } from 'react'

/*
  ==========================================================
  ÍCONE DA MARCA (icon_A)

  Procura o arquivo "icon_A" (qualquer extensão) na raiz do
  projeto ou em src/assets — o Vite o inclui no build sozinho.
  Se estiver em public/, tenta também as extensões comuns.
  Sem nenhum arquivo, volta para a letra "A".
  ==========================================================
*/
const bundled = import.meta.glob(
  ['/icon_[aA].*', '/src/assets/icon_[aA].*'],
  { eager: true, query: '?url', import: 'default' }
)

const bundledUrl = Object.values(bundled)[0] || null

const PUBLIC_FALLBACKS = ['png', 'webp', 'jpg', 'jpeg', 'svg'].map(
  (ext) => `${import.meta.env.BASE_URL}icon_A.${ext}`
)

export function useBrandIcon() {
  const [index, setIndex] = useState(0)

  const candidates = bundledUrl
    ? [bundledUrl, ...PUBLIC_FALLBACKS]
    : PUBLIC_FALLBACKS

  const src = candidates[index] || null

  return {
    src,
    onError: () => setIndex((i) => i + 1),
  }
}

/*
  Ícone da marca como link para o site Almatiê.
  variant "desktop": cabeçalho · "mobile": barra superior do app.
*/
export default function BrandLink({ href, variant = 'desktop' }) {
  const { src, onError } = useBrandIcon()

  const common = {
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
    title: 'Ir para o site Almatiê',
    'aria-label': 'Ir para o site Almatiê (abre em nova aba)',
  }

  if (variant === 'mobile') {
    return (
      <a className="m-icon-btn m-brand-link" {...common}>
        {src ? (
          <img src={src} alt="" draggable={false} onError={onError} />
        ) : (
          <span className="brand-letter">A</span>
        )}
      </a>
    )
  }

  return (
    <a
      className={`brand-symbol${src ? ' has-img' : ''}`}
      {...common}
    >
      {src ? (
        <img src={src} alt="" draggable={false} onError={onError} />
      ) : (
        'A'
      )}
    </a>
  )
}
