import { useEffect, useRef, useState } from 'react'
import { clamp01, getImageLayout, ZOOM_MIN, ZOOM_MAX } from '../utils/exportLayout.js'
import { useToast } from './Toast.jsx'
import { getModel } from '../config/models.js'
import { Icon } from './Icons.jsx'
import { ModelPickerModal, getModelsByGroup, thumbUrl } from './ModelPicker.jsx'


/*
  Resolução mínima recomendada (px por mm) para a arte sair
  nítida na impressão/exportação. Abaixo disso, avisamos o
  usuário em vez de deixar ele descobrir só no resultado final.
*/
const MIN_PX_PER_MM = 8


/*
  No celular cada seção vira uma aba do painel inferior: só a
  aba ativa é mostrada, sem o cabeçalho de acordeão. No desktop
  continua sendo o acordeão de sempre.
*/
function TabSection({
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


function Section({
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


/*
  ==========================================================
  PRÉVIA ARRASTÁVEL DO FUNDO

  Mostra a imagem de fundo já com o encaixe/zoom aplicados,
  e permite clicar e arrastar para escolher qual parte da
  imagem fica visível (equivalente ao offsetXFrac/offsetYFrac
  usados também na exportação).
  ==========================================================
*/
function BackgroundPositionPreview({ background, setBackground, aspect = 16 / 10 }) {
  const containerRef = useRef(null)

  const [box, setBox] = useState({ width: 0, height: 0 })
  const [natural, setNatural] = useState({ width: 0, height: 0 })

  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)


  useEffect(() => {
    const el = containerRef.current

    if (!el) return undefined

    const compute = () => {
      const rect = el.getBoundingClientRect()
      setBox({ width: rect.width, height: rect.height })
    }

    compute()

    const ro = new ResizeObserver(compute)
    ro.observe(el)

    return () => ro.disconnect()
  }, [])


  useEffect(() => {
    setNatural({ width: 0, height: 0 })
  }, [background.image])


  const layout = getImageLayout(
    natural.width,
    natural.height,
    box.width,
    box.height,
    background.fit,
    background.zoom,
    background.offsetXFrac,
    background.offsetYFrac
  )

  // "curso" de movimento: negativo quando a imagem é maior que a caixa
  const travelX = box.width - layout.drawW
  const travelY = box.height - layout.drawH
  const canDrag = Math.abs(travelX) > 1 || Math.abs(travelY) > 1


  const handlePointerDown = (e) => {
    if (!canDrag) return

    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: background.offsetXFrac ?? 0.5,
      startOffsetY: background.offsetYFrac ?? 0.5,
    }
  }


  const handlePointerMove = (e) => {
    if (!dragRef.current) return

    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY

    const nextX = Math.abs(travelX) > 1
      ? clamp01(
          dragRef.current.startOffsetX + deltaX / travelX
        )
      : dragRef.current.startOffsetX

    const nextY = Math.abs(travelY) > 1
      ? clamp01(
          dragRef.current.startOffsetY + deltaY / travelY
        )
      : dragRef.current.startOffsetY

    setBackground((b) => ({
      ...b,
      offsetXFrac: nextX,
      offsetYFrac: nextY,
    }))
  }


  const handlePointerUp = (e) => {
    dragRef.current = null
    setDragging(false)

    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignora se o ponteiro já foi liberado
      }
    }
  }


  return (
    <div
      className="bg-position-preview"
      ref={containerRef}
      style={{
        aspectRatio: aspect,
        background: background.color,
      }}
    >

      <img
        src={background.image}
        alt=""
        draggable={false}
        onLoad={(e) =>
          setNatural({
            width: e.target.naturalWidth,
            height: e.target.naturalHeight,
          })
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={
          canDrag
            ? `bg-position-image draggable${dragging ? ' dragging' : ''}`
            : 'bg-position-image'
        }
        style={{
          width: `${layout.drawW}px`,
          height: `${layout.drawH}px`,
          transform: `translate(${layout.x}px, ${layout.y}px)`,
          opacity: natural.width ? 1 : 0,
        }}
      />

      {canDrag && (
        <span className="bg-position-hint">
          ⇕ Arraste para posicionar
        </span>
      )}

    </div>
  )
}


/*
  ==========================================================
  SLOTS DE ARTE

  Um botão de envio por área de impressão, lado a lado e
  logo no topo da seção: dá para enviar a Imagem 1 e a
  Imagem 2 em sequência, sem rolar a tela entre elas. Cada
  slot mostra a miniatura da arte enviada.
  ==========================================================
*/
function ArtSlots({
  zones,
  artZones,
  activeKey,
  onSelect,
  onFile,
  onClear,
  dragActive,
  makeDropHandlers,
}) {
  const multi = zones.length > 1

  return (
    <div className={`art-slots${multi ? ' multi' : ''}`}>

      {zones.map((zone, index) => {
        const art = artZones[zone.key]
        const loaded = Boolean(art?.fileName)
        const selected = multi && zone.key === activeKey

        return (
          <label
            key={zone.key}
            className={
              'art-slot'
              + (loaded ? ' loaded' : '')
              + (selected ? ' selected' : '')
              + (dragActive[zone.key] ? ' drag-active' : '')
            }
            {...makeDropHandlers(zone.key)}
            onClick={() => onSelect(zone.key)}
          >

            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                onFile(zone.key, e.target.files?.[0])
                e.target.value = ''
              }}
            />

            <span className="art-slot-thumb">

              {loaded && art.image?.src ? (
                <img src={art.image.src} alt="" draggable={false} />
              ) : (
                <span className="art-slot-plus">+</span>
              )}

              {loaded && <span className="art-slot-check">✓</span>}

            </span>

            <span className="art-slot-text">

              <strong>
                {multi ? zone.label : (loaded ? 'Arte carregada' : 'Enviar sua arte')}
              </strong>

              <small>
                {loaded
                  ? art.fileName
                  : multi
                    ? `Toque para enviar (${index + 1}/${zones.length})`
                    : 'PNG, JPG ou WEBP'}
              </small>

            </span>

            {loaded && (
              <button
                type="button"
                className="art-slot-clear"
                aria-label={`Remover ${zone.label}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onClear(zone.key)
                }}
              >
                ✕
              </button>
            )}

          </label>
        )
      })}

    </div>
  )
}


export default function ControlsPanel({
  artZones,
  setArtZones,
  background,
  setBackground,
  partColors,
  setPartColors,

  glassOpacity,
  setGlassOpacity,

  mugShine,
  setMugShine,

  modelId,
  setModelId,
  warning,

  linkArt = false,
  setLinkArt = () => {},
  activeZoneKey = null,
  setActiveZoneKey = () => {},
  frameAspect = null,
  onEditBackground = () => {},

  mobileTab = null,
}) {

  const [showCalibration, setShowCalibration] =
    useState(false)

  const [pickerOpen, setPickerOpen] =
    useState(false)

  const [artDragActive, setArtDragActive] =
    useState({})

  const [bgDragActive, setBgDragActive] =
    useState(false)

  const toast = useToast()


  const processArtFile = (zoneKey, file) => {

    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem (PNG, JPG ou WEBP).')
      return
    }

    const url = URL.createObjectURL(file)

    const img = new Image()

    img.onload = () => {
      setActiveZoneKey(zoneKey)

      setArtZones((zones) => {
        const zone = zones[zoneKey] || {}

        /*
          Avisa quando a imagem enviada tem poucos pixels
          para o tamanho físico configurado — evita que o
          usuário só descubra a baixa qualidade depois de
          exportar.
        */
        const pxPerMm = Math.min(
          img.naturalWidth / (zone.widthMM || 210),
          img.naturalHeight / (zone.heightMM || 92)
        )

        if (pxPerMm < MIN_PX_PER_MM) {
          toast.warning(
            'A imagem enviada tem resolução baixa para o tamanho configurado — pode sair borrada na impressão.',
            { duration: 6000 }
          )
        }

        /*
          "Mesma imagem em todas as áreas": replica a arte
          em cada área do modelo atual (as medidas de cada
          área continuam independentes).
        */
        const targets = linkArt
          ? getModel(modelId).printZones.map((z) => z.key)
          : [zoneKey]

        const next = { ...zones }

        for (const key of targets) {
          next[key] = {
            ...(zones[key] || zone),
            image: img,
            fileName: file.name,
          }
        }

        return next
      })
    }

    img.src = url
  }


  const clearArt = (zoneKey) => {
    const targets = linkArt
      ? activeModel.printZones.map((z) => z.key)
      : [zoneKey]

    setArtZones((zones) => {
      const next = { ...zones }

      for (const key of targets) {
        if (next[key]) {
          next[key] = { ...next[key], image: null, fileName: null }
        }
      }

      return next
    })
  }


  /*
    Ao ligar "mesma imagem em todas", copia a arte que já
    existe (da área selecionada, ou da primeira que tiver)
    para as demais.
  */
  const toggleLinkArt = (checked) => {
    setLinkArt(checked)

    if (!checked) return

    setArtZones((zones) => {
      const keys = activeModel.printZones.map((z) => z.key)
      const sourceKey =
        (zones[currentZoneKey]?.fileName && currentZoneKey) ||
        keys.find((k) => zones[k]?.fileName)

      if (!sourceKey) return zones

      const source = zones[sourceKey]
      const next = { ...zones }

      for (const key of keys) {
        next[key] = {
          ...(zones[key] || {}),
          image: source.image,
          fileName: source.fileName,
        }
      }

      return next
    })
  }


  const copyMeasuresToAll = () => {
    const source = artZones[currentZoneKey]
    if (!source) return

    setArtZones((zones) => {
      const next = { ...zones }

      for (const z of activeModel.printZones) {
        next[z.key] = {
          ...(zones[z.key] || {}),
          widthMM: source.widthMM,
          heightMM: source.heightMM,
          offsetXMM: source.offsetXMM,
          offsetYMM: source.offsetYMM,
          mugRealHeightMM: source.mugRealHeightMM,
        }
      }

      return next
    })

    toast.success('Medidas copiadas para todas as áreas.')
  }


  const processBackgroundFile = (file) => {

    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem (PNG, JPG ou WEBP).')
      return
    }

    const url = URL.createObjectURL(file)

    setBackground((b) => ({
      ...b,
      type: 'image',
      image: url,

      /*
        NOVO:
        Reinicia encaixe/zoom/posição a cada
        nova imagem enviada.
      */
      fit: 'cover',
      zoom: 1,
      offsetXFrac: 0.5,
      offsetYFrac: 0.5,
    }))
  }


  const handleArtUpload = (zoneKey, e) => {
    processArtFile(zoneKey, e.target.files?.[0])
  }


  const handleBgImageUpload = (e) => {
    processBackgroundFile(e.target.files?.[0])
  }


  /*
    Handlers de arrastar-e-soltar, reaproveitados pelas duas
    áreas de upload (arte e fundo). Só previne o comportamento
    padrão do navegador (abrir o arquivo) e repassa para o
    processamento normal.
  */
  const makeDropHandlers = (setActive, processFile) => ({
    onDragOver: (e) => {
      e.preventDefault()
      setActive(true)
    },
    onDragLeave: (e) => {
      e.preventDefault()
      setActive(false)
    },
    onDrop: (e) => {
      e.preventDefault()
      setActive(false)
      processFile(e.dataTransfer.files?.[0])
    },
  })

  const makeZoneDropHandlers = (zoneKey) =>
    makeDropHandlers(
      (active) =>
        setArtDragActive((prev) => ({ ...prev, [zoneKey]: active })),
      (file) => processArtFile(zoneKey, file)
    )

  const bgDropHandlers = makeDropHandlers(setBgDragActive, processBackgroundFile)


  const activeModel = getModel(modelId)

  /*
    Desktop: o painel é dividido em 4 abas (uma por etapa).
    No celular, quem escolhe a aba é o MobileShell (mobileTab).
  */
  const [activeTab, setActiveTab] = useState('model')
  const tabbed = !mobileTab
  const currentTab = mobileTab || activeTab

  const currentZoneKey =
    activeModel.printZones.some((z) => z.key === activeZoneKey)
      ? activeZoneKey
      : activeModel.printZones[0].key

  const visibleZones = activeModel.printZones.filter(
    (z) => z.key === currentZoneKey
  )


  /*
    Progresso geral de configuração, mostrado no topo do
    painel para deixar claro o que já foi feito e o que
    falta — reduz a sensação de "por onde eu começo?".
  */
  const steps = [
    { id: 'model', label: 'Modelo', icon: 'cube', done: Boolean(modelId) },
    {
      id: 'art',
      label: 'Arte',
      icon: 'image',
      done: activeModel.printZones.some(
        (zone) => Boolean(artZones[zone.key]?.fileName)
      ),
    },
    { id: 'colors', label: 'Cores', icon: 'palette', done: true },
    { id: 'background', label: 'Fundo', icon: 'layers', done: background.type === 'image' ? Boolean(background.image) : true },
  ]

  const completedSteps = steps.filter((s) => s.done).length


  const modelsByGroup = getModelsByGroup()

  const modelCount = modelsByGroup.reduce((n, g) => n + g.items.length, 0)

  const sameGroupModels =
    modelsByGroup.find((g) => g.group === activeModel.group)?.items || []

  const resetAll = () => {
          setArtZones((zones) => {
            const next = { ...zones }

            for (const zone of activeModel.printZones) {
              next[zone.key] = {
                ...next[zone.key],
                widthMM: 210,
                heightMM: 92,
                offsetXMM: 0,
                offsetYMM: 0,
                mugRealHeightMM: 95,
              }
            }

            return next
          })

          setBackground({
            type: 'color',
            color: '#F3ECE3',
            image: null,
            fit: 'cover',
            zoom: 1,
            offsetXFrac: 0.5,
            offsetYFrac: 0.5,
          })

          setPartColors((prev) => {
            const next = { ...prev }

            for (const part of activeModel.colorParts) {
              next[part.key] = part.default
            }

            return next
          })

          if (activeModel.glassOpacity) {
            setGlassOpacity(activeModel.glassOpacity.default)
          }

          setMugShine(0.5)

          toast.info('Configurações restauradas ao padrão.')
  }

  const stepIndex = steps.findIndex((s) => s.id === currentTab)

  const goStep = (index) => {
    const target = steps[index]
    if (target) setActiveTab(target.id)
  }

  const goExport = () => {
    const el = document.querySelector('.export-card')

    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
  }


  return (
    <aside className={mobileTab ? 'panel panel-mobile' : 'panel'}>

      {/* ==================================================
          CABEÇALHO DO PAINEL
      ================================================== */}

      {tabbed && (
      <div className="panel-heading panel-heading-tabbed">

        <div className="panel-title-row">

          <div>

            <span className="section-kicker">
              PERSONALIZAÇÃO
            </span>

            <h2>
              Seu mockup
            </h2>

          </div>

          <button
            type="button"
            className="panel-icon-btn"
            onClick={resetAll}
            data-tip="Restaurar valores padrão"
            data-tip-pos="end"
            aria-label="Restaurar valores padrão"
          >
            <Icon name="reset" size={18} />
          </button>

        </div>


        <nav
          className="panel-tabs"
          role="tablist"
          aria-label="Etapas de personalização"
          style={{ '--n': steps.length, '--i': Math.max(stepIndex, 0) }}
        >

          <span className="panel-tab-thumb" aria-hidden="true" />

          {steps.map((step, index) => (

            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={step.id === currentTab}
              className={`panel-tab${step.id === currentTab ? ' active' : ''}`}
              onClick={() => setActiveTab(step.id)}
            >

              <span className="panel-tab-icon">

                <Icon name={step.icon} size={20} />

                {step.id === 'art' && !step.done && (
                  <span className="panel-tab-dot" />
                )}

                {step.id === 'art' && step.done && (
                  <span className="panel-tab-check">
                    <Icon name="check" size={9} />
                  </span>
                )}

              </span>

              <span className="panel-tab-label">
                <em>{index + 1}</em>
                {step.label}
              </span>

            </button>

          ))}

        </nav>

      </div>
      )}


      {/* ==================================================
          MODELO
      ================================================== */}

      <TabSection
        mobileTab={currentTab}
        tabbed={tabbed}
        id="model"
        step={1}
        totalSteps={4}
        iconName="cube"
        icon="◆"
        title="Modelo"
        description="Escolha a peça que aparece em 3D ao lado."
      >

        <div className="model-hero">

          <span className="model-hero-thumb" key={activeModel.id}>
            <img
              src={thumbUrl(activeModel.id)}
              alt=""
            />
          </span>

          <div className="model-hero-info">

            <span className="model-hero-group">
              {activeModel.group}
            </span>

            <strong>
              {activeModel.name}
            </strong>

            <div className="model-hero-chips">

              <span>
                {activeModel.printZones.length}
                {activeModel.printZones.length > 1 ? ' áreas de arte' : ' área de arte'}
              </span>

              <span>
                {activeModel.colorParts.length}
                {activeModel.colorParts.length > 1 ? ' partes com cor' : ' parte com cor'}
              </span>

            </div>

          </div>

        </div>

        <button
          type="button"
          className="btn btn-primary model-change-btn"
          onClick={() => setPickerOpen(true)}
        >
          Ver todos os modelos
        </button>

        {sameGroupModels.length > 1 && (
          <div className="model-quick">

            <span className="model-quick-title">
              Mais em {activeModel.group}
            </span>

            <div className="model-quick-grid">

              {sameGroupModels.map((item) => (

                <button
                  key={item.id}
                  type="button"
                  className={`model-quick-item${item.id === modelId ? ' active' : ''}`}
                  onClick={() => setModelId(item.id)}
                  title={item.name}
                >

                  <img
                    src={thumbUrl(item.id)}
                    alt=""
                    loading="lazy"
                  />

                  <span>
                    {item.shortName || item.name}
                  </span>

                </button>

              ))}

            </div>

          </div>
        )}

        <p className="control-hint">
          {modelCount} modelos em {modelsByGroup.length} categorias disponíveis.
        </p>

        {pickerOpen && (

          <ModelPickerModal
            modelsByGroup={modelsByGroup}
            activeModelId={modelId}
            onSelect={(id) => {
              setModelId(id)
              setPickerOpen(false)
            }}
            onClose={() => setPickerOpen(false)}
          />

        )}

      </TabSection>


      {/* ==================================================
          SUA ARTE
      ================================================== */}

      <TabSection
        mobileTab={currentTab}
        tabbed={tabbed}
        id="art"
        step={2}
        totalSteps={4}
        iconName="image"
        icon="✦"
        title="Sua arte"
        badge={{
          text: `${activeModel.printZones.filter((z) => artZones[z.key]?.fileName).length}/${activeModel.printZones.length}`,
          done: activeModel.printZones.every((z) => artZones[z.key]?.fileName),
        }}
        description={
          activeModel.printZones.length > 1
            ? 'Esta peça tem mais de uma área: envie uma imagem para cada uma.'
            : 'Envie a imagem que será estampada e ajuste tamanho e posição.'
        }
      >

        <ArtSlots
          zones={activeModel.printZones}
          artZones={artZones}
          activeKey={currentZoneKey}
          onSelect={setActiveZoneKey}
          onFile={processArtFile}
          onClear={clearArt}
          dragActive={artDragActive}
          makeDropHandlers={makeZoneDropHandlers}
        />

        {activeModel.printZones.length > 1 && (

          <label className="link-art-toggle">

            <span className="link-art-text">
              <strong>Usar a mesma imagem em todas</strong>
              <small>Replica a arte em todas as áreas da peça</small>
            </span>

            <span className="switch">

              <input
                type="checkbox"
                checked={linkArt}
                onChange={(e) => toggleLinkArt(e.target.checked)}
              />

              <span className="switch-track">
                <span className="switch-thumb" />
              </span>

            </span>

          </label>

        )}

        {visibleZones.map((zone, zoneIndex) => {
          const zoneArt = artZones[zone.key] || {
            image: null,
            fileName: null,
            widthMM: 210,
            heightMM: 92,
            offsetXMM: 0,
            offsetYMM: 0,
            mugRealHeightMM: 95,
          }

          const updateZone = (updater) => {
            setArtZones((zones) => ({
              ...zones,
              [zone.key]: {
                ...(zones[zone.key] || zoneArt),
                ...updater(zones[zone.key] || zoneArt),
              },
            }))
          }

          return (
            <div
              key={zone.key}
              className="art-zone-block"
              style={
                zoneIndex > 0
                  ? { marginTop: '22px', paddingTop: '22px', borderTop: '1px dashed var(--border-soft, #e2dccf)' }
                  : undefined
              }
            >

              {activeModel.printZones.length > 1 && (
                <div className="field-label zone-settings-label">
                  <span>Ajustes · {zone.label}</span>
                </div>
              )}


              <div className="field-group">

                <div className="field-label">

                  <span>
                    Tamanho da arte
                  </span>

                  <small>
                    milímetros
                  </small>

                </div>


                <div className="input-grid">

                  <label className="input-field">

                    <span>
                      Largura
                    </span>

                    <div className="number-input">

                      <input
                        type="number"
                        value={zoneArt.widthMM}
                        min={10}
                        max={400}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          updateZone(() => ({ widthMM: v }))
                        }}
                      />

                      <span>
                        mm
                      </span>

                    </div>

                  </label>


                  <label className="input-field">

                    <span>
                      Altura
                    </span>

                    <div className="number-input">

                      <input
                        type="number"
                        value={zoneArt.heightMM}
                        min={10}
                        max={200}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          updateZone(() => ({ heightMM: v }))
                        }}
                      />

                      <span>
                        mm
                      </span>

                    </div>

                  </label>

                </div>

              </div>


              {/* HORIZONTAL */}

              <div className="range-field">

                <div className="range-header">

                  <span>
                    Posição horizontal
                  </span>

                  <span className="range-header-actions">

                    <strong>
                      {zoneArt.offsetXMM} mm
                    </strong>

                    {zoneArt.offsetXMM !== 0 && (
                      <button
                        type="button"
                        className="range-reset"
                        onClick={() => updateZone(() => ({ offsetXMM: 0 }))}
                        aria-label="Centralizar posição horizontal"
                        title="Centralizar"
                      >
                        ⟲
                      </button>
                    )}

                  </span>

                </div>

                <input
                  type="range"
                  min="-60"
                  max="60"
                  value={zoneArt.offsetXMM}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    updateZone(() => ({ offsetXMM: v }))
                  }}
                />

                <div className="range-limits">
                  <span>−60</span>
                  <span>0</span>
                  <span>+60</span>
                </div>

              </div>


              {/* VERTICAL */}

              <div className="range-field">

                <div className="range-header">

                  <span>
                    Posição vertical
                  </span>

                  <span className="range-header-actions">

                    <strong>
                      {zoneArt.offsetYMM} mm
                    </strong>

                    {zoneArt.offsetYMM !== 0 && (
                      <button
                        type="button"
                        className="range-reset"
                        onClick={() => updateZone(() => ({ offsetYMM: 0 }))}
                        aria-label="Centralizar posição vertical"
                        title="Centralizar"
                      >
                        ⟲
                      </button>
                    )}

                  </span>

                </div>

                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={zoneArt.offsetYMM}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    updateZone(() => ({ offsetYMM: v }))
                  }}
                />

                <div className="range-limits">
                  <span>−20</span>
                  <span>0</span>
                  <span>+20</span>
                </div>

              </div>


              {activeModel.printZones.length > 1 && (
                <button
                  type="button"
                  className="advanced-toggle"
                  onClick={copyMeasuresToAll}
                >
                  <span>⧉ Copiar estas medidas para todas as áreas</span>
                </button>
              )}

              {/* CALIBRAÇÃO */}

              <button
                type="button"
                className="advanced-toggle"
                onClick={() =>
                  setShowCalibration((value) => !value)
                }
              >

                <span>
                  ⚙ Calibração da peça
                </span>

                <span>
                  {showCalibration ? '−' : '+'}
                </span>

              </button>


              {showCalibration && (

                <div className="calibration-box">

                  <label className="input-field">

                    <span>
                      Altura real da peça
                    </span>

                    <div className="number-input">

                      <input
                        type="number"
                        value={zoneArt.mugRealHeightMM}
                        min={10}
                        max={400}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          updateZone(() => ({ mugRealHeightMM: v }))
                        }}
                      />

                      <span>
                        mm
                      </span>

                    </div>

                  </label>

                  <p>
                    Ajuste conforme a altura real dessa área da
                    peça para manter a escala da arte.
                  </p>

                </div>

              )}

            </div>
          )
        })}


        {warning && (

          <div className="warning">

            <span>
              !
            </span>

            <div>

              <strong>
                Atenção
              </strong>

              <p>
                {warning}
              </p>

            </div>

          </div>

        )}

      </TabSection>


      {/* ==================================================
          CORES
      ================================================== */}

      <TabSection
        mobileTab={currentTab}
        tabbed={tabbed}
        id="colors"
        step={3}
        totalSteps={4}
        iconName="palette"
        icon="●"
        title="Cores"
        description="Pinte cada parte da peça e ajuste o acabamento."
        defaultOpen={false}
      >

        <div className="color-list">

          {activeModel.colorParts.map((part) => (

            <label className="color-row" key={part.key}>

              <span>
                {part.label}
              </span>

              <div className="color-input">

                <input
                  type="color"
                  value={partColors[part.key] || part.default}
                  onChange={(e) =>
                    setPartColors((c) => ({
                      ...c,
                      [part.key]: e.target.value,
                    }))
                  }
                />

                <span>
                  {(partColors[part.key] || part.default).toUpperCase()}
                </span>

              </div>

            </label>

          ))}

        </div>


        {activeModel.glassOpacity && (

          <div className="range-field">

            <div className="range-header">

              <span>
                {activeModel.glassOpacity.label}
              </span>

              <strong>
                {Math.round((glassOpacity ?? activeModel.glassOpacity.default) * 100)}%
              </strong>

            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={glassOpacity ?? activeModel.glassOpacity.default}
              onChange={(e) =>
                setGlassOpacity(Number(e.target.value))
              }
            />

            <div className="range-limits">
              <span>Opaco</span>
              <span>Transparente</span>
            </div>

          </div>

        )}


        {/* ==================================================
            BRILHO
        ================================================== */}

        <div className="range-field">

          <div className="range-header">

            <span>
              Brilho
            </span>

            <strong>
              {Math.round(mugShine * 100)}%
            </strong>

          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={mugShine}
            onChange={(e) =>
              setMugShine(
                Number(e.target.value)
              )
            }
          />

          <div className="range-limits">
            <span>Fosco</span>
            <span>Brilhante</span>
          </div>

        </div>


        <p className="control-hint">
          O brilho afeta o acabamento das peças que aceitam
          esse ajuste (cerâmica e plástico). A folha e o mouse
          do mousepad permanecem foscos.
        </p>


        <p className="control-hint">
          O "Corpo" também define a cor das áreas onde não
          existe impressão.
        </p>

      </TabSection>


      {/* ==================================================
          FUNDO
      ================================================== */}

      <TabSection
        mobileTab={currentTab}
        tabbed={tabbed}
        id="background"
        step={4}
        totalSteps={4}
        iconName="layers"
        icon="◉"
        title="Fundo"
        badge={{
          text: background.type === 'image' && background.image ? 'Imagem' : 'Cor',
          done: background.type === 'image' && Boolean(background.image),
        }}
        description="Escolha a cor ou a imagem que fica atrás do modelo."
      >

        <div className="segmented-control">

          <button
            type="button"
            className={
              background.type === 'color'
                ? 'active'
                : ''
            }
            onClick={() =>
              setBackground((b) => ({
                ...b,
                type: 'color',
              }))
            }
          >
            Cor sólida
          </button>

          <button
            type="button"
            className={
              background.type === 'image'
                ? 'active'
                : ''
            }
            onClick={() =>
              setBackground((b) => ({
                ...b,
                type: 'image',
              }))
            }
          >
            Imagem
          </button>

        </div>


        {background.type === 'color' ? (

          <label className="color-picker">

            <span>
              Cor do ambiente
            </span>

            <div className="color-picker-control">

              <input
                type="color"
                value={background.color}
                onChange={(e) =>
                  setBackground((b) => ({
                    ...b,
                    color: e.target.value,
                  }))
                }
              />

              <span>
                {background.color.toUpperCase()}
              </span>

            </div>

          </label>

        ) : (

          <>

            <label
              className={`upload-area small${bgDragActive ? ' drag-active' : ''}`}
              {...bgDropHandlers}
            >

              <input
                type="file"
                accept="image/*"
                onChange={handleBgImageUpload}
                hidden
              />

              {background.image ? (

                <div className="uploaded-art">

                  <div className="upload-check">
                    ✓
                  </div>

                  <div className="upload-info">

                    <strong>
                      Imagem de fundo carregada
                    </strong>

                    <span>
                      Clique para trocar a imagem
                    </span>

                  </div>

                  <span className="upload-change">
                    Trocar
                  </span>

                </div>

              ) : (

                <div className="upload-empty">

                  <span className="upload-icon">
                    ↑
                  </span>

                  <strong>
                    Enviar imagem de fundo
                  </strong>

                  <span>
                    Arraste aqui ou clique · foto ou cenário
                  </span>

                </div>

              )}

            </label>


            {background.image && (

              <>

                <BackgroundPositionPreview
                  background={background}
                  setBackground={setBackground}
                  aspect={frameAspect || 16 / 10}
                />

                <div className="bg-actions">

                  <button
                    type="button"
                    className="btn btn-primary bg-action-main"
                    onClick={onEditBackground}
                  >
                    ✥ Ajustar direto na cena
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setBackground((b) => ({
                        ...b,
                        fit: 'cover',
                        zoom: 1,
                        offsetXFrac: 0.5,
                        offsetYFrac: 0.5,
                      }))
                    }
                  >
                    ⟲ Centralizar
                  </button>

                </div>


                <label className="color-picker">

                  <span>
                    Cor atrás da imagem
                  </span>

                  <div className="color-picker-control">

                    <input
                      type="color"
                      value={background.color}
                      onChange={(e) =>
                        setBackground((b) => ({
                          ...b,
                          color: e.target.value,
                        }))
                      }
                    />

                    <span>
                      {background.color.toUpperCase()}
                    </span>

                  </div>

                </label>


                <div className="field-group">

                  <div className="field-label">

                    <span>
                      Encaixe da imagem
                    </span>

                    <small>
                      como ela preenche o fundo
                    </small>

                  </div>


                  <div className="segmented-control four-col">

                    <button
                      type="button"
                      className={
                        background.fit === 'cover'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setBackground((b) => ({
                          ...b,
                          fit: 'cover',
                        }))
                      }
                    >
                      Cobrir
                    </button>

                    <button
                      type="button"
                      className={
                        background.fit === 'contain'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setBackground((b) => ({
                          ...b,
                          fit: 'contain',
                        }))
                      }
                    >
                      Conter
                    </button>

                    <button
                      type="button"
                      className={
                        background.fit === 'width'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setBackground((b) => ({
                          ...b,
                          fit: 'width',
                        }))
                      }
                    >
                      Largura
                    </button>

                    <button
                      type="button"
                      className={
                        background.fit === 'height'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setBackground((b) => ({
                          ...b,
                          fit: 'height',
                        }))
                      }
                    >
                      Altura
                    </button>

                  </div>

                </div>


                <div className="range-field">

                  <div className="range-header">

                    <span>
                      Zoom da imagem
                    </span>

                    <strong>
                      {Math.round(
                        (background.zoom || 1) * 100
                      )}%
                    </strong>

                  </div>

                  <input
                    type="range"
                    min={ZOOM_MIN}
                    max={ZOOM_MAX}
                    step="0.01"
                    value={background.zoom || 1}
                    onChange={(e) =>
                      setBackground((b) => ({
                        ...b,
                        zoom: Number(e.target.value),
                      }))
                    }
                  />

                  <div className="range-limits">
                    <span>{Math.round(ZOOM_MIN * 100)}%</span>
                    <span>100%</span>
                    <span>{Math.round(ZOOM_MAX * 100)}%</span>
                  </div>

                </div>


                <p className="control-hint">
                  "Cobrir" preenche todo o quadro (recortando o
                  excesso); "Conter" mostra a imagem inteira.
                  Com zoom abaixo de 100% a imagem fica menor
                  e a cor de fundo aparece ao redor. A prévia
                  acima tem a mesma proporção do quadro de
                  exportação escolhido.
                </p>

              </>

            )}

          </>

        )}

      </TabSection>


      {/* ==================================================
          CORES
      ================================================== */}



      {!tabbed && (
      <button
        type="button"
        className="reset-all-button"
        onClick={resetAll}
      >
        ↺ Restaurar valores padrão
      </button>
      )}


      {tabbed && (
      <div className="panel-nav">

        <button
          type="button"
          className="panel-nav-btn ghost"
          onClick={() => goStep(stepIndex - 1)}
          disabled={stepIndex <= 0}
        >
          <Icon name="arrow-left" size={16} />
          Voltar
        </button>

        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            className="panel-nav-btn primary"
            onClick={() => goStep(stepIndex + 1)}
          >
            Próximo: {steps[stepIndex + 1].label}
            <Icon name="arrow-right" size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="panel-nav-btn primary"
            onClick={goExport}
          >
            Ir para exportar
            <Icon name="arrow-down" size={16} />
          </button>
        )}

      </div>
      )}

    </aside>
  )
}
