import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icons.jsx'
import {
  ART_PRESETS,
  CUSTOM_LIMITS,
  CUSTOM_PRESET_ID,
  DPI_OPTIONS,
  GAP_MAX,
  MARGIN_MAX,
  MARGIN_MIN,
  PAPERS,
} from './presets.js'
import { effectiveDpi } from './layout.js'
import { mmToPx } from './bake.js'

/*
  ==========================================================
  ABAS DO GABARITO: Medida · Artes · Ajustes · Salvar
  Usadas no painel do desktop e na folha deslizante do celular.
  ==========================================================
*/

export const SHEET_TABS = [
  {
    id: 'measure',
    label: 'Medida',
    icon: 'ruler',
    title: 'Folha e medida da arte',
    desc: 'Escolha o papel e o tamanho da arte da sua peça.',
  },
  {
    id: 'arts',
    label: 'Artes',
    icon: 'image',
    title: 'Suas artes',
    desc: 'Envie de 1 a 6 artes — a folha mostra quantas cabem.',
  },
  {
    id: 'adjust',
    label: 'Ajustes',
    icon: 'sliders',
    title: 'Margens e encaixe',
    desc: 'Margem de impressão, espaço entre as artes e encaixe.',
  },
  {
    id: 'save',
    label: 'Salvar',
    icon: 'download',
    title: 'Salvar o gabarito',
    desc: 'Espelhe para sublimação e baixe em PDF ou PNG transparente.',
  },
]


/* ---------- peças pequenas ---------- */

function Toggle({ checked, onChange, title, hint, icon }) {
  return (
    <label className={`sheet-toggle${checked ? ' on' : ''}`}>

      {icon && (
        <span className="sheet-toggle-icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
      )}

      <span className="sheet-toggle-text">
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </span>

      <span className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />

        <span className="switch-track">
          <span className="switch-thumb" />
        </span>
      </span>

    </label>
  )
}

function Segmented3({ value, options, onChange, label }) {
  return (
    <div
      className={`segmented-control ${options.length === 2 ? 'two-col' : 'three-col'}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/*
  Campo numérico que deixa digitar livremente e só "fecha" o valor
  (limitando ao mínimo/máximo) ao sair do campo.
*/
function MmField({ label, value, min, max, onCommit }) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  const commit = () => {
    const n = Number(String(text).replace(',', '.'))
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value

    onCommit(Math.round(clamped * 10) / 10)
    setText(String(Math.round(clamped * 10) / 10))
  }

  return (
    <label className="sheet-field">
      <span>{label}</span>

      <span className="sheet-field-input">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onFocus={() => { focused.current = true }}
          onChange={(e) => {
            setText(e.target.value)

            const n = Number(e.target.value.replace(',', '.'))

            if (Number.isFinite(n) && n >= min && n <= max) onCommit(n)
          }}
          onBlur={() => {
            focused.current = false
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />

        <em>mm</em>
      </span>
    </label>
  )
}

function Slider({ label, value, min, max, step, onChange, hint }) {
  return (
    <div className="range-field">

      <div className="range-header">
        <span>{label}</span>

        <span className="range-header-actions">
          <strong>{value} mm</strong>

          {value !== min && (
            <button
              type="button"
              className="range-reset"
              onClick={() => onChange(min)}
              aria-label={`Zerar ${label.toLowerCase()}`}
              title="Zerar"
            >
              ⟲
            </button>
          )}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div className="range-scale">
        <span>{min} mm</span>
        <span>{max} mm</span>
      </div>

      {hint && <p className="control-hint">{hint}</p>}

    </div>
  )
}


/* ---------- 1 · MEDIDA ---------- */

export function MeasurePane({ sheet }) {
  const { settings, update, plan, alt, artSize } = sheet

  return (
    <>

      <h4 className="sheet-label">Folha</h4>

      <div className="sheet-choice-row">
        {Object.values(PAPERS).map((paper) => (
          <button
            key={paper.id}
            type="button"
            className={`sheet-choice${settings.paper === paper.id ? ' active' : ''}`}
            onClick={() => update({ paper: paper.id })}
            aria-pressed={settings.paper === paper.id}
          >
            <span
              className="sheet-choice-shape"
              style={{ aspectRatio: `${paper.w} / ${paper.h}` }}
              aria-hidden="true"
            />
            <strong>{paper.label}</strong>
            <small>{paper.w} × {paper.h} mm</small>
          </button>
        ))}
      </div>

      <h4 className="sheet-label">Orientação da folha</h4>

      <Segmented3
        label="Orientação da folha"
        value={settings.orientation}
        onChange={(orientation) => update({ orientation })}
        options={[
          { id: 'auto', label: 'Automática' },
          { id: 'portrait', label: 'Retrato' },
          { id: 'landscape', label: 'Paisagem' },
        ]}
      />

      <p className="sheet-result" role="status">
        {plan.invalid ? (
          'A medida não cabe na folha com essa margem.'
        ) : (
          <>
            No modo <strong>{plan.orientation === 'landscape' ? 'paisagem' : 'retrato'}</strong> cabem{' '}
            <strong>{plan.capacity}</strong> {plan.capacity === 1 ? 'arte' : 'artes'} de {artSize.w} × {artSize.h} mm.
          </>
        )}
      </p>

      {alt && (
        <p className="sheet-tip" role="note">
          No modo <strong>{alt.orientation === 'landscape' ? 'paisagem' : 'retrato'}</strong> caberiam{' '}
          <strong>{alt.capacity}</strong> artes, mas reduzidas a {Math.round(alt.scale * 100)}% do tamanho real.
          Escolha a orientação manualmente se preferir assim.
        </p>
      )}

      <h4 className="sheet-label">Medida da arte</h4>

      <div className="preset-list" role="radiogroup" aria-label="Medida da arte">

        {ART_PRESETS.map((preset) => {
          const active = settings.presetId === preset.id

          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`preset-card${active ? ' active' : ''}`}
              onClick={() => update({ presetId: preset.id })}
            >
              <span className="preset-shape-wrap" aria-hidden="true">
                <span
                  className="preset-shape"
                  style={{ aspectRatio: `${preset.w} / ${preset.h}` }}
                />
              </span>

              <span className="preset-text">
                <strong>{preset.name}</strong>
                <small>{preset.detail}</small>
              </span>

              <span className="preset-dims">
                {preset.w} × {preset.h} mm
                {!preset.verified && <em title="Medida aproximada: confira com o fabricante">aprox.</em>}
              </span>
            </button>
          )
        })}

        <div className={`preset-card custom${settings.presetId === CUSTOM_PRESET_ID ? ' active' : ''}`}>

          <button
            type="button"
            role="radio"
            aria-checked={settings.presetId === CUSTOM_PRESET_ID}
            className="preset-custom-head"
            onClick={() => update({ presetId: CUSTOM_PRESET_ID })}
          >
            <span className="preset-shape-wrap" aria-hidden="true">
              <span
                className="preset-shape"
                style={{ aspectRatio: `${settings.custom.w} / ${settings.custom.h}` }}
              />
            </span>

            <span className="preset-text">
              <strong>Personalizada</strong>
              <small>Digite a largura e a altura</small>
            </span>

            <span className="preset-dims">
              {settings.custom.w} × {settings.custom.h} mm
            </span>
          </button>

          {settings.presetId === CUSTOM_PRESET_ID && (
            <div className="sheet-fields">
              <MmField
                label="Largura"
                value={settings.custom.w}
                min={CUSTOM_LIMITS.min}
                max={CUSTOM_LIMITS.max}
                onCommit={(w) => update({ custom: { ...settings.custom, w } })}
              />

              <MmField
                label="Altura"
                value={settings.custom.h}
                min={CUSTOM_LIMITS.min}
                max={CUSTOM_LIMITS.max}
                onCommit={(h) => update({ custom: { ...settings.custom, h } })}
              />
            </div>
          )}

        </div>

      </div>

      <p className="control-hint">
        Medidas marcadas com <em className="inline-aprox">aprox.</em> variam entre fabricantes:
        confira com o seu fornecedor ou use a medida personalizada.
      </p>

    </>
  )
}


/* ---------- 2 · ARTES ---------- */

export function ArtsPane({ sheet }) {
  const { settings, update, arts, slots, plan, uploadAt, uploadMany, clearAt } = sheet
  const [dragSlot, setDragSlot] = useState(null)

  const first = arts.slice(0, slots).findIndex(Boolean)

  return (
    <>

      <p className="sheet-result" role="status">
        Cabem <strong>{plan.slots}</strong> {plan.slots === 1 ? 'arte' : 'artes'} nesta folha
        {plan.capacity > plan.slots ? ' (máximo de 6)' : ''}.
        As artes enviadas ficam centralizadas.
      </p>

      <div className={`art-slots multi sheet-slots cols-${slots > 4 ? 3 : 2}`}>

        {Array.from({ length: slots }).map((_, i) => {
          const art = arts[i]
          const mirrorOf = settings.sameArt && first >= 0 && i !== first

          const dpi = art
            ? effectiveDpi(art.w, art.h, plan.cw, plan.ch, plan.rotated, settings.fit)
            : 0

          return (
            <label
              key={i}
              className={
                'art-slot'
                + (art ? ' loaded' : '')
                + (dragSlot === i ? ' drag-active' : '')
                + (mirrorOf ? ' echo' : '')
              }
              onDragOver={(e) => {
                e.preventDefault()
                setDragSlot(i)
              }}
              onDragLeave={() => setDragSlot(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragSlot(null)

                if (e.dataTransfer.files.length > 1) uploadMany(e.dataTransfer.files)
                else uploadAt(i, e.dataTransfer.files[0])
              }}
            >

              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  uploadAt(i, e.target.files?.[0])
                  e.target.value = ''
                }}
              />

              <span className="art-slot-thumb">
                {art ? (
                  <img src={art.url} alt="" draggable={false} />
                ) : mirrorOf && arts[first] ? (
                  <img src={arts[first].url} alt="" draggable={false} style={{ opacity: 0.35 }} />
                ) : (
                  <span className="art-slot-plus">+</span>
                )}

                {art && <span className="art-slot-check">✓</span>}
              </span>

              <span className="art-slot-text">
                <strong>Arte {i + 1}</strong>

                <small>
                  {art
                    ? art.name
                    : mirrorOf
                      ? `Igual à arte ${first + 1}`
                      : 'Toque para enviar'}
                </small>

                {art && (
                  <span className={`dpi-badge${dpi >= 300 ? ' ok' : ' low'}`}>
                    {Math.round(dpi)} DPI
                  </span>
                )}
              </span>

              {art && (
                <button
                  type="button"
                  className="art-slot-clear"
                  aria-label={`Remover a arte ${i + 1}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    clearAt(i)
                  }}
                >
                  ✕
                </button>
              )}

            </label>
          )
        })}

      </div>

      <label className="btn btn-secondary sheet-multi-btn">
        <Icon name="upload" size={17} />
        Enviar várias de uma vez

        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            uploadMany(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {slots > 1 && (
        <Toggle
          checked={settings.sameArt}
          onChange={(sameArt) => update({ sameArt })}
          title="Usar a mesma arte em todos os espaços"
          hint="Repete a primeira arte para aproveitar toda a folha"
        />
      )}

      <p className="control-hint">
        Dica: arraste imagens direto para os quadradinhos. Para o tamanho real da peça, o ideal é
        300 DPI ou mais — o selo em cada arte mostra a resolução nesta medida.
      </p>

    </>
  )
}


/* ---------- 3 · AJUSTES ---------- */

export function AdjustPane({ sheet }) {
  const { settings, update, plan } = sheet
  const shrunk = !plan.fullSize && !plan.invalid

  return (
    <>

      <Slider
        label="Margem de impressão"
        value={settings.margin}
        min={MARGIN_MIN}
        max={MARGIN_MAX}
        step={0.5}
        onChange={(margin) => update({ margin })}
        hint="Distância mínima entre as artes e a borda da folha."
      />

      {shrunk && (
        <div className="sheet-warning" role="alert">
          <strong>Atenção: a arte será reduzida</strong>
          <p>
            Com essa margem a arte não cabe no tamanho real e é reduzida a {Math.round(plan.scale * 100)}%
            ({Math.round(plan.cw * 10) / 10} × {Math.round(plan.ch * 10) / 10} mm). Diminua a
            margem para imprimir no tamanho original.
          </p>
        </div>
      )}

      <Slider
        label="Espaço entre as artes"
        value={settings.gap}
        min={0}
        max={GAP_MAX}
        step={0.5}
        onChange={(gap) => update({ gap })}
        hint="Ajuda no recorte. Pode reduzir quantas artes cabem."
      />

      <h4 className="sheet-label">Encaixe da arte</h4>

      <Segmented3
        label="Encaixe da arte"
        value={settings.fit}
        onChange={(fit) => update({ fit })}
        options={[
          { id: 'contain', label: 'Inteira' },
          { id: 'cover', label: 'Preencher' },
        ]}
      />

      <p className="control-hint">
        <strong>Inteira</strong> mostra a arte completa (pode sobrar espaço nas laterais).
        <strong> Preencher</strong> cobre toda a medida e corta o excesso.
      </p>

      <Toggle
        checked={settings.allowRotate}
        onChange={(allowRotate) => update({ allowRotate })}
        title="Girar as artes 90° para caber mais"
        hint="Só gira se isso aumentar a quantidade por folha"
      />

    </>
  )
}


/* ---------- 4 · SALVAR ---------- */

export function SavePane({ sheet }) {
  const { settings, update, plan, items, busy, progress, exportAs, lowestDpi } = sheet

  const wPx = mmToPx(plan.page.w, settings.dpi)
  const hPx = mmToPx(plan.page.h, settings.dpi)

  const disabled = Boolean(busy) || !items.length

  return (
    <>

      <Toggle
        checked={settings.mirror}
        onChange={(mirror) => update({ mirror })}
        icon="flip"
        title="Espelhar a arte (sublimação)"
        hint="Inverte cada arte na horizontal para sair certa na peça"
      />

      <h4 className="sheet-label">Resolução</h4>

      <div className="chip-row" role="radiogroup" aria-label="Resolução">
        {DPI_OPTIONS.map((dpi) => (
          <button
            key={dpi}
            type="button"
            role="radio"
            aria-checked={settings.dpi === dpi}
            className={`chip-btn${settings.dpi === dpi ? ' active' : ''}`}
            onClick={() => update({ dpi })}
          >
            {dpi} DPI
            <small>{dpi === 300 ? 'Padrão · alta qualidade' : 'Máxima · arquivo grande'}</small>
          </button>
        ))}
      </div>

      <p className="control-hint">
        Folha inteira: {wPx} × {hPx} px. O fundo é sempre <strong>transparente</strong> — só as artes são impressas.
      </p>

      {lowestDpi > 0 && lowestDpi < 300 && (
        <div className="sheet-warning" role="alert">
          <strong>Resolução baixa em alguma arte</strong>
          <p>
            A menor tem cerca de {Math.round(lowestDpi)} DPI neste tamanho. O arquivo sai em {settings.dpi} DPI,
            mas a imagem original tem poucos pixels e pode ficar borrada. Use uma imagem maior.
          </p>
        </div>
      )}

      <div className="sheet-save-grid">

        <button
          type="button"
          className="sheet-save-btn primary"
          onClick={() => exportAs('pdf')}
          disabled={disabled}
        >
          <Icon name="download" size={20} />
          <span>
            <strong>{busy === 'pdf' ? 'Gerando PDF…' : 'Salvar PDF'}</strong>
            <small>{plan.page.w === 210 ? 'A4' : 'A3'} · pronto para imprimir</small>
          </span>
        </button>

        <button
          type="button"
          className="sheet-save-btn"
          onClick={() => exportAs('png')}
          disabled={disabled}
        >
          <Icon name="image" size={20} />
          <span>
            <strong>
              {busy === 'png' ? `Gerando PNG… ${Math.round(progress * 100)}%` : 'Salvar PNG'}
            </strong>
            <small>{settings.dpi} DPI · transparente</small>
          </span>
        </button>

      </div>

      {!items.length && (
        <p className="control-hint">Envie ao menos uma arte (aba Artes) para poder salvar.</p>
      )}

      <ul className="sheet-summary">
        <li><span>Folha</span><strong>{settings.paper} · {plan.orientation === 'landscape' ? 'paisagem' : 'retrato'}</strong></li>
        <li><span>Artes</span><strong>{items.length}</strong></li>
        <li><span>Margem · espaço</span><strong>{settings.margin} mm · {settings.gap} mm</strong></li>
        <li><span>Espelhado</span><strong>{settings.mirror ? 'Sim' : 'Não'}</strong></li>
      </ul>

    </>
  )
}
