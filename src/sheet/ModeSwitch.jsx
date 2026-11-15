import { Segmented } from '../components/StageControls.jsx'

/*
  Troca entre os dois tipos de gabarito:
  • Sublimação — artes por medida de peça (canecas, garrafas…)
  • DTF — folha livre, com imagens movidas à vontade
*/
const OPTIONS = [
  { id: 'sublimation', label: 'Gabarito de sublimação', tip: 'Sublimação · artes por medida', icon: <span>Sublimação</span> },
  { id: 'dtf', label: 'Gabarito DTF', tip: 'DTF · folha livre', icon: <span>DTF</span> },
]

export default function ModeSwitch({ mode, onMode }) {
  return (
    <Segmented
      label="Tipo de gabarito"
      className="seg-text"
      options={OPTIONS}
      value={mode}
      onChange={onMode}
    />
  )
}
