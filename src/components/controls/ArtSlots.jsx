


/*
  ==========================================================
  SLOTS DE ARTE

  Um botão de envio por área de impressão, lado a lado e
  logo no topo da seção: dá para enviar a Imagem 1 e a
  Imagem 2 em sequência, sem rolar a tela entre elas. Cada
  slot mostra a miniatura da arte enviada.
  ==========================================================
*/
export function ArtSlots({
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
