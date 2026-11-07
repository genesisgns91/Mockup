import { useState } from 'react'
import { useToast } from './Toast.jsx'
import { getModel } from '../config/models.js'
import { Icon } from './Icons.jsx'
import { getModelsByGroup } from './ModelPicker.jsx'
import { ModelPane } from './controls/ModelPane.jsx'
import { ArtPane } from './controls/ArtPane.jsx'
import { ColorsPane } from './controls/ColorsPane.jsx'
import { BackgroundPane } from './controls/BackgroundPane.jsx'


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
  onArtFile = () => {},
  onBackgroundFile = () => {},

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


  // o envio (leitura, redução e gravação da imagem) é feito no App
  const processArtFile = (zoneKey, file) => onArtFile(zoneKey, file)


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


  const processBackgroundFile = (file) => onBackgroundFile(file)


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

      <ModelPane
        activeModel={activeModel}
        currentTab={currentTab}
        modelCount={modelCount}
        modelId={modelId}
        modelsByGroup={modelsByGroup}
        pickerOpen={pickerOpen}
        sameGroupModels={sameGroupModels}
        setModelId={setModelId}
        setPickerOpen={setPickerOpen}
        tabbed={tabbed}
      />


      {/* ==================================================
          SUA ARTE
      ================================================== */}

      <ArtPane
        activeModel={activeModel}
        artDragActive={artDragActive}
        artZones={artZones}
        clearArt={clearArt}
        copyMeasuresToAll={copyMeasuresToAll}
        currentTab={currentTab}
        currentZoneKey={currentZoneKey}
        linkArt={linkArt}
        makeZoneDropHandlers={makeZoneDropHandlers}
        processArtFile={processArtFile}
        setActiveZoneKey={setActiveZoneKey}
        setArtZones={setArtZones}
        setShowCalibration={setShowCalibration}
        showCalibration={showCalibration}
        tabbed={tabbed}
        toggleLinkArt={toggleLinkArt}
        visibleZones={visibleZones}
        warning={warning}
      />


      {/* ==================================================
          CORES
      ================================================== */}

      <ColorsPane
        activeModel={activeModel}
        currentTab={currentTab}
        glassOpacity={glassOpacity}
        mugShine={mugShine}
        partColors={partColors}
        setGlassOpacity={setGlassOpacity}
        setMugShine={setMugShine}
        setPartColors={setPartColors}
        tabbed={tabbed}
      />


      {/* ==================================================
          FUNDO
      ================================================== */}

      <BackgroundPane
        background={background}
        bgDragActive={bgDragActive}
        bgDropHandlers={bgDropHandlers}
        currentTab={currentTab}
        frameAspect={frameAspect}
        handleBgImageUpload={handleBgImageUpload}
        onEditBackground={onEditBackground}
        setBackground={setBackground}
        tabbed={tabbed}
      />


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
