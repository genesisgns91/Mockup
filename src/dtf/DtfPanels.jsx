import { Icon } from '../components/Icons.jsx'
import { PAPERS, DPI_OPTIONS } from '../sheet/presets.js'
import { MmField, Segmented3, Slider, Toggle } from '../sheet/SheetPanes.jsx'
import { GOOD_DPI, LOW_DPI, aabb, effectiveDpi } from './geometry.js'

/*
  ==========================================================
  ABAS DO GABARITO DTF: Folha · Imagens · Objeto · Salvar
  (usadas no painel do desktop e na folha deslizante do celular)
  ==========================================================
*/

export const DTF_TABS = [
  {
    id: 'page',
    label: 'Folha',
    icon: 'sheet',
    title: 'Folha e opções',
    desc: 'Papel, orientação, margem de segurança e guias.',
  },
  {
    id: 'images',
    label: 'Imagens',
    icon: 'image',
    title: 'Imagens na folha',
    desc: 'Insira quantas quiser: várias de uma vez se distribuem sozinhas.',
  },
  {
    id: 'object',
    label: 'Objeto',
    icon: 'move',
    title: 'Editar a imagem',
    desc: 'Tamanho, posição, giro e ordem da imagem selecionada.',
  },
  {
    id: 'save',
    label: 'Salvar',
    icon: 'download',
    title: 'Salvar o gabarito',
    desc: 'PDF ou PNG com fundo transparente, a partir de 300 DPI.',
  },
]

const r1 = (n) => Math.round(n * 10) / 10

function dpiTone(dpi) {
  if (dpi < LOW_DPI) return 'low'
  if (dpi < GOOD_DPI) return 'mid'

  return 'ok'
}

function Btn({ icon, children, onClick, danger, active, title }) {
  return (
    <button
      type="button"
      className={`dtf-btn${danger ? ' danger' : ''}${active ? ' active' : ''}`}
      onClick={onClick}
      title={title}
    >
      <Icon name={icon} size={17} />
      <span>{children}</span>
    </button>
  )
}


/* ---------- avisos (usados na aba Salvar e nas "etiquetas" da folha) ---------- */

export function WarningList({ dtf }) {
  const byId = new Map(dtf.objects.map((o) => [o.id, o]))
  const items = []

  for (const [a, b] of dtf.overlaps) {
    items.push({
      key: `o${a}${b}`,
      kind: 'overlap',
      text: `“${byId.get(a)?.name}” e “${byId.get(b)?.name}” se sobrepõem`,
      ids: [a, b],
    })
  }

  for (const id of dtf.lowQuality) {
    const o = byId.get(id)

    items.push({
      key: `l${id}`,
      kind: 'low',
      text: `“${o?.name}” com qualidade muito baixa (~${Math.round(effectiveDpi(o))} DPI)`,
      ids: [id],
    })
  }

  for (const id of dtf.outside) {
    items.push({
      key: `x${id}`,
      kind: 'outside',
      text: `“${byId.get(id)?.name}” sai da folha (a parte de fora será cortada)`,
      ids: [id],
    })
  }

  if (!items.length) return null

  return (
    <ul className="dtf-warnings" aria-label="Avisos">
      {items.map((item) => (
        <li key={item.key}>
          <button type="button" onClick={() => dtf.select(item.ids)}>
            <Icon name="warning" size={15} />
            <span>{item.text}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}


/* ---------- 1 · FOLHA ---------- */

export function PagePane({ dtf }) {
  const { settings, update } = dtf

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

      <h4 className="sheet-label">Orientação</h4>

      <Segmented3
        label="Orientação da folha"
        value={settings.orientation}
        onChange={(orientation) => update({ orientation })}
        options={[
          { id: 'portrait', label: 'Retrato' },
          { id: 'landscape', label: 'Paisagem' },
        ]}
      />

      <Slider
        label="Margem de segurança"
        value={settings.margin}
        min={0}
        max={10}
        step={0.5}
        onChange={(margin) => update({ margin })}
        hint="Aparece tracejada na folha e é usada ao distribuir as imagens. Você pode colocar imagens fora dela."
      />

      <Toggle
        checked={settings.snap}
        onChange={(snap) => update({ snap })}
        title="Guias inteligentes"
        hint="Encaixa nas bordas e centros ao mover (segure Alt para desligar)"
      />

      <Toggle
        checked={settings.mirror}
        onChange={(mirror) => update({ mirror })}
        icon="flip"
        title="Espelhar ao exportar"
        hint="Inverte a folha inteira na horizontal no arquivo salvo"
      />

    </>
  )
}


/* ---------- 2 · IMAGENS ---------- */

export function ImagesPane({ dtf, onAdd }) {
  const { objects, selected } = dtf
  const warn = new Set([...dtf.lowQuality, ...dtf.overlaps.flat(), ...dtf.outside])

  return (
    <>

      <button type="button" className="btn btn-primary dtf-add-btn" onClick={onAdd}>
        <Icon name="upload" size={18} />
        Adicionar imagens
      </button>

      <p className="control-hint">
        Escolha várias de uma vez, arraste arquivos para a folha ou cole com Ctrl+V.
      </p>

      <div className="dtf-list-actions">
        <button type="button" className="btn btn-secondary" onClick={dtf.arrange} disabled={!objects.length}>
          <Icon name="arrange" size={16} />
          Organizar
        </button>

        <button
          type="button"
          className="btn btn-secondary danger"
          onClick={dtf.clearAll}
          disabled={!objects.length}
        >
          <Icon name="trash" size={16} />
          Limpar folha
        </button>
      </div>

      {objects.length ? (
        <ul className="dtf-layers" aria-label="Camadas (de cima para baixo)">
          {[...objects].reverse().map((o) => {
            const dpi = Math.round(effectiveDpi(o))

            return (
              <li key={o.id}>
                <div
                  className={`dtf-layer${selected.includes(o.id) ? ' selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => dtf.select([o.id], e.shiftKey || e.ctrlKey || e.metaKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      dtf.select([o.id])
                    }
                  }}
                >
                  <span className="dtf-layer-thumb">
                    <img src={o.url} alt="" draggable={false} />
                  </span>

                  <span className="dtf-layer-text">
                    <strong>{o.name}</strong>
                    <small>
                      {r1(o.w)} × {r1(o.h)} mm · <span className={`dpi-tone ${dpiTone(dpi)}`}>{dpi} DPI</span>
                    </small>
                  </span>

                  {warn.has(o.id) && (
                    <span className="dtf-layer-warn" title="Veja os avisos">
                      <Icon name="warning" size={15} />
                    </span>
                  )}

                  <span className="dtf-layer-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Subir camada" onClick={() => dtf.reorder('forward', [o.id])}>
                      <Icon name="step-up" size={15} />
                    </button>
                    <button type="button" aria-label="Descer camada" onClick={() => dtf.reorder('backward', [o.id])}>
                      <Icon name="step-down" size={15} />
                    </button>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="sheet-result">A folha está vazia. Adicione imagens para começar.</p>
      )}

    </>
  )
}


/* ---------- 3 · OBJETO ---------- */

export function ObjectPane({ dtf }) {
  const { objects, selected, page } = dtf
  const sel = objects.filter((o) => selected.includes(o.id))

  if (!sel.length) {
    return (
      <p className="sheet-result">
        Clique em uma imagem na folha (ou na lista de imagens) para editar o tamanho, a posição e o giro.
        Dica: segure Shift para selecionar várias.
      </p>
    )
  }

  const one = sel.length === 1 ? sel[0] : null
  const box = one ? aabb(one) : null
  const dpi = one ? Math.round(effectiveDpi(one)) : 0

  return (
    <>

      {one ? (
        <div className="dtf-obj-head">
          <span className="dtf-layer-thumb big">
            <img src={one.url} alt="" draggable={false} />
          </span>

          <div className="dtf-obj-title">
            <strong>{one.name}</strong>
            <span className={`dpi-badge ${dpiTone(dpi) === 'ok' ? 'ok' : 'low'} ${dpiTone(dpi)}`}>
              {dpi} DPI neste tamanho
            </span>
          </div>
        </div>
      ) : (
        <p className="sheet-result">
          <strong>{sel.length}</strong> imagens selecionadas. Use as ferramentas abaixo para alinhar, ordenar ou
          excluir todas juntas.
        </p>
      )}

      {one && dpiTone(dpi) === 'low' && (
        <div className="sheet-warning" role="alert">
          <strong>Qualidade muito baixa</strong>
          <p>
            Com esse tamanho a imagem tem só {dpi} DPI e vai sair borrada. Reduza o tamanho ou use uma
            imagem com mais pixels.
          </p>
        </div>
      )}

      {one && (
        <>
          <h4 className="sheet-label">Posição e tamanho</h4>

          <div className="sheet-fields dtf-fields">
            <MmField label="X" value={r1(box.x)} min={-600} max={1200} onCommit={(x) => dtf.applyProps(one.id, { x })} />
            <MmField label="Y" value={r1(box.y)} min={-600} max={1500} onCommit={(y) => dtf.applyProps(one.id, { y })} />
            <MmField label="Largura" value={r1(one.w)} min={2} max={1500} onCommit={(w) => dtf.applyProps(one.id, { w })} />
            <MmField label="Altura" value={r1(one.h)} min={2} max={1500} onCommit={(h) => dtf.applyProps(one.id, { h })} />
            <MmField label="Ângulo" unit="°" value={r1(one.angle)} min={-180} max={180} onCommit={(angle) => dtf.applyProps(one.id, { angle })} />

            <button
              type="button"
              className={`dtf-lock${one.lock ? ' on' : ''}`}
              onClick={() => dtf.patchObject(one.id, { lock: !one.lock })}
              aria-pressed={one.lock}
              title="Manter a proporção ao mudar o tamanho"
            >
              <Icon name={one.lock ? 'lock' : 'unlock'} size={17} />
              <span>{one.lock ? 'Proporção presa' : 'Proporção livre'}</span>
            </button>
          </div>

          <div className="dtf-btn-grid">
            <Btn icon="rotate-ccw" onClick={() => dtf.rotateSelected(-90)}>Girar 90° ↺</Btn>
            <Btn icon="rotate-cw" onClick={() => dtf.rotateSelected(90)}>Girar 90° ↻</Btn>
            <Btn icon="flip-h" onClick={() => dtf.flipSelected('x')} active={one.flipX}>Espelhar ↔</Btn>
            <Btn icon="flip-v" onClick={() => dtf.flipSelected('y')} active={one.flipY}>Espelhar ↕</Btn>
          </div>

          <div className="dtf-btn-grid">
            <Btn icon="fit" onClick={() => dtf.realSize(one.id)} title="Define o tamanho em que a imagem tem 300 DPI">
              Tamanho real (300 DPI)
            </Btn>
            <Btn icon="align-center-x" onClick={() => dtf.fitToWidth(one.id)} title={`Ocupa a largura útil da folha (${page.w} mm)`}>
              Ajustar à largura
            </Btn>
          </div>
        </>
      )}

      <h4 className="sheet-label">Ordem (camadas)</h4>

      <div className="dtf-btn-grid four">
        <Btn icon="to-front" onClick={() => dtf.reorder('front')}>Frente</Btn>
        <Btn icon="step-up" onClick={() => dtf.reorder('forward')}>Avançar</Btn>
        <Btn icon="step-down" onClick={() => dtf.reorder('backward')}>Recuar</Btn>
        <Btn icon="to-back" onClick={() => dtf.reorder('back')}>Trás</Btn>
      </div>

      <h4 className="sheet-label">Alinhar à folha</h4>

      <div className="dtf-align-grid">
        {[
          ['left', 'align-left', 'Esquerda'],
          ['centerX', 'align-center-x', 'Centro (horizontal)'],
          ['right', 'align-right', 'Direita'],
          ['top', 'align-top', 'Topo'],
          ['centerY', 'align-center-y', 'Centro (vertical)'],
          ['bottom', 'align-bottom', 'Base'],
        ].map(([how, icon, label]) => (
          <button key={how} type="button" onClick={() => dtf.alignSelected(how)} aria-label={`Alinhar: ${label}`} title={label}>
            <Icon name={icon} size={19} />
          </button>
        ))}
      </div>

      <div className="dtf-btn-grid">
        <Btn icon="copy" onClick={dtf.duplicateSelected}>Duplicar</Btn>
        <Btn icon="trash" danger onClick={dtf.removeSelected}>Excluir</Btn>
      </div>

    </>
  )
}


/* ---------- 4 · SALVAR ---------- */

export function SavePane({ dtf }) {
  const { settings, update, objects, busy, progress, exportAs, page } = dtf
  const disabled = Boolean(busy) || !objects.length

  return (
    <>

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
        Folha inteira: {Math.round((page.w / 25.4) * settings.dpi)} × {Math.round((page.h / 25.4) * settings.dpi)} px.
        O fundo é sempre <strong>transparente</strong>: só as imagens são impressas.
      </p>

      <Toggle
        checked={settings.mirror}
        onChange={(mirror) => update({ mirror })}
        icon="flip"
        title="Espelhar ao exportar"
        hint="Inverte a folha inteira na horizontal no arquivo"
      />

      <WarningList dtf={dtf} />

      <div className="sheet-save-grid">

        <button type="button" className="sheet-save-btn primary" onClick={() => exportAs('pdf')} disabled={disabled}>
          <Icon name="download" size={20} />
          <span>
            <strong>{busy === 'pdf' ? 'Gerando PDF…' : 'Salvar PDF'}</strong>
            <small>{settings.paper} · pronto para imprimir</small>
          </span>
        </button>

        <button type="button" className="sheet-save-btn" onClick={() => exportAs('png')} disabled={disabled}>
          <Icon name="image" size={20} />
          <span>
            <strong>{busy === 'png' ? `Gerando PNG… ${Math.round(progress * 100)}%` : 'Salvar PNG'}</strong>
            <small>{settings.dpi} DPI · transparente</small>
          </span>
        </button>

      </div>

      {!objects.length && <p className="control-hint">Insira ao menos uma imagem para poder salvar.</p>}

      <ul className="sheet-summary">
        <li><span>Folha</span><strong>{settings.paper} · {settings.orientation === 'landscape' ? 'paisagem' : 'retrato'}</strong></li>
        <li><span>Imagens</span><strong>{objects.length}</strong></li>
        <li><span>Espelhado</span><strong>{settings.mirror ? 'Sim' : 'Não'}</strong></li>
      </ul>

    </>
  )
}
