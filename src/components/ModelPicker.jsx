import { useEffect } from 'react'
import { MODELS, MODEL_GROUPS } from '../config/models.js'


export function thumbUrl(id) {
  return `${import.meta.env.BASE_URL}thumbnails/${id}.png`
}


/*
  ==========================================================
  MODAL DE ESCOLHA DE MODELO

  Tela cheia com todos os modelos em grade, com miniatura real
  e nome — agrupados por categoria. Substitui o antigo painel
  que expandia/recolhia dentro do menu lateral.
  ==========================================================
*/
export function ModelPickerModal({
  variant = 'dialog',
  modelsByGroup,
  activeModelId,
  onSelect,
  onClose,
}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className={
        variant === 'sheet'
          ? 'model-picker-backdrop m-picker'
          : 'model-picker-backdrop'
      }
      onClick={onClose}
    >

      <div
        className="model-picker-modal"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="model-picker-header">

          <div>

            <h3>
              Escolha o modelo
            </h3>

            <p>
              Selecione o produto que você quer personalizar
            </p>

          </div>

          <button
            type="button"
            className="model-picker-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>

        </div>


        <div className="model-picker-body">

          {modelsByGroup.map(({ group, items }) => (

            <div key={group} className="model-picker-group">

              <span className="model-picker-group-title">
                {group}
              </span>

              <div className="model-picker-grid">

                {items.map((model) => (

                  <button
                    key={model.id}
                    type="button"
                    className={
                      activeModelId === model.id
                        ? 'model-card active'
                        : 'model-card'
                    }
                    onClick={() => onSelect(model.id)}
                  >

                    <span className="model-card-thumb">

                      <img
                        src={thumbUrl(model.id)}
                        alt=""
                        loading="lazy"
                      />

                      {activeModelId === model.id && (
                        <span className="model-card-check">
                          ✓
                        </span>
                      )}

                    </span>

                    <span className="model-card-name">
                      {model.shortName}
                    </span>

                  </button>

                ))}

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>
  )
}


/*
  Lista de modelos vem do catálogo central (src/config/models.js),
  agrupada por categoria para ficar navegável mesmo com dezenas
  de opções.
*/
export function getModelsByGroup() {
  return MODEL_GROUPS.map((group) => ({
    group,
    items: Object.values(MODELS).filter(
      (m) => m.group === group && !m.hidden
    ),
  })).filter((g) => g.items.length > 0)
}
