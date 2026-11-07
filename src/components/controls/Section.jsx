import { useState } from 'react'
import { Icon } from '../Icons.jsx'


/*
  No celular cada seção vira uma aba do painel inferior: só a
  aba ativa é mostrada, sem o cabeçalho de acordeão. No desktop
  continua sendo o acordeão de sempre.
*/
export function TabSection({
  mobileTab,
  tabbed = false,
  id,
  step,
  totalSteps,
  children,
  ...rest
}) {
  if (mobileTab) {
    if (mobileTab !== id) return null

    if (!tabbed) {
      return (
        <div className="m-tab-content" key={id}>
          {children}
        </div>
      )
    }

    return (
      <div className="tab-pane" key={id}>

        <header className="tab-pane-head">

          <span className="tab-pane-icon" aria-hidden="true">
            <Icon name={rest.iconName} size={22} />
          </span>

          <div className="tab-pane-text">

            <span className="tab-pane-step">
              PASSO {step} DE {totalSteps}
            </span>

            <h3>{rest.title}</h3>

            <p>{rest.description}</p>

          </div>

        </header>

        <div className="tab-pane-body">
          {children}
        </div>

      </div>
    )
  }

  return <Section {...rest}>{children}</Section>
}

export function Section({
  icon,
  title,
  description,
  badge = null,
  children,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`control-section ${open ? 'open' : ''}`}>

      <button
        type="button"
        className="section-header"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >

        <div className="section-title">

          <span className="section-icon" aria-hidden="true">
            {icon}
          </span>

          <div>

            <strong>
              {title}
            </strong>

            {description && (
              <small>
                {description}
              </small>
            )}

          </div>

        </div>

        {badge && (
          <span className={`section-badge${badge.done ? ' done' : ''}`}>
            {badge.text}
          </span>
        )}

        <span className="section-arrow" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m7 10 5 5 5-5" />
          </svg>
        </span>

      </button>


      {open && (
        <div className="section-content">
          {children}
        </div>
      )}

    </section>
  )
}
