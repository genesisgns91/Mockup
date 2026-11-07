import { ModelPickerModal, thumbUrl } from '../ModelPicker.jsx'
import { TabSection } from './Section.jsx'


export function ModelPane({
  activeModel,
  currentTab,
  modelCount,
  modelId,
  modelsByGroup,
  pickerOpen,
  sameGroupModels,
  setModelId,
  setPickerOpen,
  tabbed,
}) {
  return (
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
  )
}
