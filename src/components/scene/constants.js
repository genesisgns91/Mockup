


export const TARGET_HEIGHT = 1.7

/*
  Duração da animação de giro 360°
  usada tanto no player 3D quanto
  na barra de progresso da UI.
*/
export const ROTATE_SECONDS = 6

/*
  Arquivos cujas faces curvas (com mais de 3 lados) ficam com
  aparência de "estática"/ruído sob luz de ambiente, porque a
  triangulação simples do carregador desalinha a normal do arquivo
  com o triângulo real. Ver comentário onde isso é usado.
*/
export const NEEDS_NORMAL_FIX = new Set([
  'model-mousepad.obj',
  'model-mochila-saco.obj',
  'model-long-drink-transparente.obj',
])

export function modelUrl(config) {
  return `${import.meta.env.BASE_URL}${config.file}`
}

export function baseName(name) {
  return name.replace(/\.\d+$/, '')
}

/*
  Nomes de peças que carregam a arte impressa. Cobre "print",
  "print.001" (sufixo já removido por baseName), "printA"/"printB"
  e variações como "strip_print", "handle_print", "heart_mug_print".
  Um único regex genérico cobre todos os 37 modelos sem precisar de
  lista por modelo.
*/
export function isPrintPartName(name) {
  return /print/i.test(name)
}

// "printA"/"printB": placeholders da folha solta (só existem em modelos
// com "hasPaper"). Precisam ser distinguidos da área de impressão real
// ("print", "strip_print", "heart_mug_print"...), que casa com o regex
// genérico isPrintPartName.
export function isLooseSheetName(name) {
  return /^print[A-Z]$/.test(name)
}


/*
  Aparelhos "modestos" (celulares, pouca memória/núcleos) usam
  sombra e densidade de pixels menores para manter a fluidez.
*/
export function detectLowPower() {
  if (typeof window === 'undefined') return false

  const coarse =
    window.matchMedia && window.matchMedia('(pointer: coarse)').matches

  const fewCores = (navigator.hardwareConcurrency || 8) <= 4
  const lowMemory = (navigator.deviceMemory || 8) <= 4

  return Boolean(coarse || fewCores || lowMemory)
}
