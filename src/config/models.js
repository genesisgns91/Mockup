/*
  ==========================================================
  CATÁLOGO DE MODELOS

  Fonte única de verdade para todo o app: arquivo .obj,
  quantas peças tem, que material físico usar (cerâmica,
  tecido, plástico, vidro, metal, espuma, papelão...) e como
  a arte deve ser projetada em cada peça (enrolada ao redor
  de um cilindro, como numa caneca/garrafa, ou "achatada",
  como numa camiseta/almofada/azulejo).

  Isso substitui as versões antigas, duplicadas e
  hardcoded, que existiam em ControlsPanel.jsx, MugScene.jsx
  e App.jsx — adicionar um modelo novo agora é só acrescentar
  uma entrada aqui.
  ==========================================================
*/

// Famílias de material físico (parâmetros do MeshPhysicalMaterial).
export const MATERIAL = {
  CERAMIC: 'ceramic',     // canecas, azulejos — brilho ajustável (clearcoat)
  GLASS: 'glass',         // copos/canecas de vidro transparente
  FABRIC: 'fabric',       // camisetas, almofadas, bolsas — fosco
  LEATHER: 'leather',     // capas de agenda — fosco com leve brilho
  PLASTIC: 'plastic',     // garrafas, squeezes, plaquinhas
  METAL: 'metal',         // alças cromadas, argolas, arame, colher
  FOAM: 'foam',           // base de mousepad, solado de chinelo
  CARDBOARD: 'cardboard', // caixa de papelão
  HIDDEN: 'hidden',       // peças técnicas que nunca devem aparecer
}

// Como a arte enviada pelo usuário é projetada na peça.
export const PRINT_MODE = {
  CYLINDRICAL: 'cylindrical', // enrola ao redor (caneca, garrafa, copo)
  FLAT: 'flat',                // painel plano (camiseta, almofada, azulejo)
}

export const MODELS = {
  single: {
    id: 'single', name: '1 Caneca', shortName: 'Caneca', group: 'Canecas',
    count: 1, file: 'model.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  duo: {
    id: 'duo', name: '2 Canecas', shortName: '2 Canecas', group: 'Canecas',
    count: 2, file: 'model-duo.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  trio: {
    id: 'trio', name: '3 Canecas', shortName: '3 Canecas', group: 'Canecas',
    count: 3, file: 'model-trio.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  trioPaper: {
    id: 'trioPaper', name: '3 Canecas + Folha', shortName: '3 + Folha', group: 'Canecas',
    count: 3, file: 'model-trio-paper.obj', hasPaper: true,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },

  canecaGlitter: {
    id: 'canecaGlitter', name: 'Caneca com Glitter', shortName: 'C/ Glitter', group: 'Canecas',
    count: 1, file: 'model-CANECA-COM-GLITER.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
    // clearcoat um pouco mais alto para sugerir o brilho do glitter na tira
    materialBoost: { clearcoat: 0.15 },
  },
  canecaCoracao: {
    id: 'canecaCoracao', name: 'Caneca Coração', shortName: 'Coração', group: 'Canecas',
    count: 1, file: 'model-CANECA-CORACAO.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  canecaPequena: {
    id: 'canecaPequena', name: 'Caneca Pequena', shortName: 'Pequena', group: 'Canecas',
    count: 1, file: 'model-CANECA-PEQUENA.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  chopp: {
    id: 'chopp', name: 'Caneca de Chopp', shortName: 'Chopp', group: 'Canecas',
    count: 1, file: 'model-CHOP.obj', hasPaper: false,
    material: MATERIAL.GLASS, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
    partOverrides: { handle_print: MATERIAL.GLASS },
  },
  canecaCasal: {
    id: 'canecaCasal', name: 'Caneca Casal', shortName: 'Casal', group: 'Canecas',
    count: 2, file: 'model-caneca-casal.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  canecaColher: {
    id: 'canecaColher', name: 'Caneca com Colher', shortName: 'C/ Colher', group: 'Canecas',
    count: 1, file: 'model-caneca-colher.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
    partOverrides: { spoon: MATERIAL.METAL },
  },
  canecaConica: {
    id: 'canecaConica', name: 'Caneca Cônica', shortName: 'Cônica', group: 'Canecas',
    count: 1, file: 'model-caneca-conica.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  canecaMagica: {
    id: 'canecaMagica', name: 'Caneca Mágica', shortName: 'Mágica', group: 'Canecas',
    count: 2, file: 'model-magic.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  duasCanecasDif: {
    id: 'duasCanecasDif', name: '2 Canecas Diferentes', shortName: '2 Diferentes', group: 'Canecas',
    count: 2, file: 'model-DOIS-DIF.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
  },
  copoTermico: {
    id: 'copoTermico', name: 'Copo Térmico (Trio)', shortName: 'C. Térmico', group: 'Canecas',
    count: 3, file: 'model-COPO-TERMICO.obj', hasPaper: false,
    material: MATERIAL.METAL, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: false,
    partOverrides: { cover: MATERIAL.PLASTIC },
  },
  torreParXicara: {
    id: 'torreParXicara', name: 'Torre de Xícaras (Par)', shortName: 'Torre (Par)', group: 'Canecas',
    count: 2, file: 'model-torre-par-xicara.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
    // este modelo não tem uma peça "print" dedicada — a própria
    // parede da xícara recebe a arte. baseName() já normaliza
    // "body.001", "body.002"... para "body", então basta listar uma vez.
    printTargets: ['body'],
    partOverrides: { base: MATERIAL.PLASTIC },
  },
  torreXicaras: {
    id: 'torreXicaras', name: 'Torre de Xícaras (Conjunto)', shortName: 'Torre', group: 'Canecas',
    count: 4, file: 'model-torre-xicaras.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: true,
    printTargets: ['body'],
    partOverrides: { base: MATERIAL.PLASTIC },
  },

  camiseta: {
    id: 'camiseta', name: 'Camiseta', shortName: 'Camiseta', group: 'Vestuário',
    count: 1, file: 'model-CAMISETA.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    printTargets: ['front'],
  },
  babylook: {
    id: 'babylook', name: 'Baby Look', shortName: 'Baby Look', group: 'Vestuário',
    count: 1, file: 'model-BABYLOOK.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    printTargets: ['front'],
  },
  chinelos: {
    id: 'chinelos', name: 'Chinelos', shortName: 'Chinelos', group: 'Vestuário',
    count: 2, file: 'model-chinelos.obj', hasPaper: false,
    material: MATERIAL.FOAM, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    partOverrides: { slipper_straps: MATERIAL.PLASTIC },
  },
  chinelosEspelhado: {
    id: 'chinelosEspelhado', name: 'Chinelos (Arte Espelhada)', shortName: 'Chinelos Esp.', group: 'Vestuário',
    count: 2, file: 'model-chinelo-arteespelhada.obj', hasPaper: false,
    material: MATERIAL.FOAM, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    partOverrides: { slipper_straps: MATERIAL.PLASTIC },
  },

  almofada: {
    id: 'almofada', name: 'Almofada', shortName: 'Almofada', group: 'Casa',
    count: 1, file: 'model-ALMOFADA.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    printTargets: ['front'],
  },
  almofadaRetangular: {
    id: 'almofadaRetangular', name: 'Almofada Retangular', shortName: 'Almofada Ret.', group: 'Casa',
    count: 1, file: 'model-almofada-ret.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    printTargets: ['front'],
  },
  azulejo: {
    id: 'azulejo', name: 'Azulejo', shortName: 'Azulejo', group: 'Casa',
    count: 1, file: 'model-AZULEJO.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    partOverrides: { support: MATERIAL.PLASTIC, second_support: MATERIAL.PLASTIC },
  },
  azulejoRetangular: {
    id: 'azulejoRetangular', name: 'Azulejo Retangular', shortName: 'Azulejo Ret.', group: 'Casa',
    count: 1, file: 'model-azulejo-retangulo.obj', hasPaper: false,
    material: MATERIAL.CERAMIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    partOverrides: { support: MATERIAL.PLASTIC, second_support: MATERIAL.PLASTIC },
  },
  mousepad: {
    id: 'mousepad', name: 'Mousepad', shortName: 'Mousepad', group: 'Casa',
    count: 1, file: 'model-mousepad.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    // a arte cobre a superfície de tecido do mousepad, não a base
    printTargets: ['mousepad'],
    partOverrides: {
      mousepad_base: MATERIAL.FOAM,
      mouse: MATERIAL.PLASTIC,
      mouse_wheel: MATERIAL.METAL,
    },
  },
  agenda: {
    id: 'agenda', name: 'Agenda', shortName: 'Agenda', group: 'Casa',
    count: 1, file: 'model-agenda.obj', hasPaper: false,
    material: MATERIAL.LEATHER, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    printTargets: ['front'],
    partOverrides: { wire: MATERIAL.METAL, sheets: MATERIAL.CARDBOARD },
  },
  caixaCaneca: {
    id: 'caixaCaneca', name: 'Caixa para Caneca', shortName: 'Caixa', group: 'Casa',
    count: 1, file: 'model-CX-CANECA.obj', hasPaper: false,
    material: MATERIAL.CARDBOARD, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: true,
    printTargets: ['front'],
  },
  chaveiroAlmofada: {
    id: 'chaveiroAlmofada', name: 'Chaveiro Almofada', shortName: 'Chaveiro', group: 'Acessórios',
    count: 1, file: 'model-chaveiro-almofada.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    printTargets: ['front'],
    partOverrides: { ring: MATERIAL.METAL },
  },
  ecobag: {
    id: 'ecobag', name: 'Ecobag', shortName: 'Ecobag', group: 'Acessórios',
    count: 1, file: 'model-ecobag.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    printTargets: ['front'],
  },
  mochilaSaco: {
    id: 'mochilaSaco', name: 'Mochila Saco', shortName: 'Mochila', group: 'Acessórios',
    count: 1, file: 'model-mochila-saco.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
    printTargets: ['front'],
    partOverrides: { support: MATERIAL.PLASTIC },
  },
  bone: {
    id: 'bone', name: 'Boné', shortName: 'Boné', group: 'Vestuário',
    count: 1, file: 'model-bone.obj', hasPaper: false,
    material: MATERIAL.FABRIC, printMode: PRINT_MODE.FLAT,
    hasHandle: false, hasInside: false,
  },

  garrafa1: {
    id: 'garrafa1', name: 'Garrafa 1', shortName: 'Garrafa 1', group: 'Bebidas',
    count: 1, file: 'model-garrafa1.obj', hasPaper: false,
    material: MATERIAL.PLASTIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: false, hasInside: false,
  },
  garrafa2: {
    id: 'garrafa2', name: 'Garrafa 2', shortName: 'Garrafa 2', group: 'Bebidas',
    count: 1, file: 'model-garrafa2.obj', hasPaper: false,
    material: MATERIAL.PLASTIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: false, hasInside: false,
    partOverrides: { thermometer: MATERIAL.GLASS },
  },
  garrafinha: {
    id: 'garrafinha', name: 'Garrafinha', shortName: 'Garrafinha', group: 'Bebidas',
    count: 1, file: 'model-garrafinha.obj', hasPaper: false,
    material: MATERIAL.PLASTIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: false, hasInside: false,
  },
  longDrinkTransparente: {
    id: 'longDrinkTransparente', name: 'Long Drink Transparente', shortName: 'L.Drink Transp.', group: 'Bebidas',
    count: 1, file: 'model-long-drink-transparente.obj', hasPaper: false,
    material: MATERIAL.GLASS, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: false, hasInside: false,
  },
  longDrinkBranco: {
    id: 'longDrinkBranco', name: 'Long Drink Branco', shortName: 'L.Drink Branco', group: 'Bebidas',
    count: 1, file: 'model-longdrink-branco.obj', hasPaper: false,
    material: MATERIAL.PLASTIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: false, hasInside: false,
  },
  squeezeMosquetao: {
    id: 'squeezeMosquetao', name: 'Squeeze com Mosquetão', shortName: 'Squeeze', group: 'Bebidas',
    count: 1, file: 'model-squeeze-mosquetao.obj', hasPaper: false,
    material: MATERIAL.PLASTIC, printMode: PRINT_MODE.CYLINDRICAL,
    hasHandle: true, hasInside: false,
    partOverrides: {
      handle_chrome: MATERIAL.METAL,
      handle_chrome_button_01: MATERIAL.METAL,
      handle_chrome_button_02: MATERIAL.METAL,
      internal: MATERIAL.HIDDEN,
    },
  },
}

export const DEFAULT_MODEL_ID = 'single'

export const MODEL_GROUPS = [
  'Canecas',
  'Vestuário',
  'Casa',
  'Acessórios',
  'Bebidas',
]

export function getModel(modelId) {
  return MODELS[modelId] || MODELS[DEFAULT_MODEL_ID]
}
