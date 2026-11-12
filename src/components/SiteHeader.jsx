import BrandLink from './BrandMark.jsx'
import { Icon } from './Icons.jsx'
import { ALMATIE_URL } from '../config/links.js'

/*
  ==========================================================
  CABEÇALHO DO SITE (desktop)

  Logo/link do Almatiê, navegação entre as duas ferramentas
  (Mockup 3D · Gabarito de impressão) e, à direita, os controles
  da ferramenta atual (children).
  ==========================================================
*/

const SECTIONS = [
  { id: 'mockup', label: 'Mockup 3D', icon: 'cube' },
  { id: 'sheet', label: 'Gabarito de impressão', icon: 'sheet' },
]

export default function SiteHeader({ section, onSection, subtitle, children }) {
  const index = Math.max(0, SECTIONS.findIndex((s) => s.id === section))

  return (
    <header className="site-header">

      <div className="brand-container">

        <BrandLink href={ALMATIE_URL} />

        <div className="brand">

          <h1>
            Almatiê
          </h1>

          <span>
            {subtitle}
          </span>

        </div>

      </div>


      <nav
        className="section-nav"
        aria-label="Ferramentas"
        style={{ '--n': SECTIONS.length, '--i': index }}
      >

        <span className="section-nav-thumb" aria-hidden="true" />

        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`section-nav-btn${item.id === section ? ' active' : ''}`}
            aria-label={item.label}
            aria-current={item.id === section ? 'page' : undefined}
            onClick={() => onSection(item.id)}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
          </button>
        ))}

      </nav>


      <div className="header-right">
        {children}
      </div>

    </header>
  )
}
