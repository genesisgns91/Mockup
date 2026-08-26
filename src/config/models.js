/*
  ==========================================================
  CATÁLOGO DE MODELOS

  Fonte única de verdade: para cada um dos 37 modelos, descreve:

  - printZones: as áreas onde o usuário pode anexar uma imagem.
    Cada zona é independente — um modelo pode ter várias (ex: frente
    e verso de uma almofada, ou uma arte por caneca num kit de 2).
    "meshNames" usa os nomes CRUS das peças no .obj (com sufixo
    ".001" etc quando existir), porque cada cópia pode receber uma
    arte diferente.

  - colorParts: as peças com cor própria e ajustável (corpo, alça,
    tampa, base, tiras...). A primeira sempre é "body" e funciona
    como parte "coringa": qualquer peça do modelo que não esteja
    listada em nenhum outro lugar (print zone, outra colorPart,
    fixedPart) cai automaticamente nela. "meshNames" aqui usa nomes
    JÁ NORMALIZADOS (sem o sufixo ".001"), porque a cor é
    compartilhada entre todas as cópias da peça.

  - fixedParts: peças de "ferragem" com cor fixa, não editável pelo
    usuário (aro metálico, espiral da agenda, botões cromados...).

  - glassOpacity: se presente, mostra um controle de transparência
    (só faz sentido em materiais de vidro).

  - glitterBand: caso especial da Caneca com Glitter — uma faixa que
    NÃO recebe a arte anexada, e sim uma cor com efeito brilhante
    (glitter), cobrindo 360° sem entrar na alça.
  ==========================================================
*/

export const MATERIAL = {
  CERAMIC: 'ceramic',
  GLASS: 'glass',
  FABRIC: 'fabric',
  LEATHER: 'leather',
  PLASTIC: 'plastic',
  METAL: 'metal',
  FOAM: 'foam',
  CARDBOARD: 'cardboard',
  GLITTER: 'glitter',
  HIDDEN: 'hidden',
}

export const PRINT_MODE = {
  CYLINDRICAL: 'cylindrical',
  FLAT: 'flat',
}

function body(meshNames = [], extra = {}) {
  return { key: 'body', label: 'Corpo', meshNames, material: MATERIAL.CERAMIC, default: '#ffffff', ...extra }
}

export const MODELS = {
  single: {
    id: 'single', name: '1 Caneca', shortName: 'Caneca', group: 'Canecas',
    count: 1, file: 'model.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },
  duo: {
    id: 'duo', name: '2 Canecas', shortName: '2 Canecas', group: 'Canecas',
    count: 2, file: 'model-duo.obj', hasPaper: false,
    printZones: [
      { key: 'mug1', label: 'Caneca 1', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'mug2', label: 'Caneca 2', meshNames: ['print.001'], mode: PRINT_MODE.CYLINDRICAL },
    ],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },
  trio: {
    id: 'trio', name: '3 Canecas', shortName: '3 Canecas', group: 'Canecas',
    count: 3, file: 'model-trio.obj', hasPaper: false,
    printZones: [
      { key: 'mug1', label: 'Caneca 1', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'mug2', label: 'Caneca 2', meshNames: ['print.001'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'mug3', label: 'Caneca 3', meshNames: ['print.002'], mode: PRINT_MODE.CYLINDRICAL },
    ],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },
  trioPaper: {
    id: 'trioPaper', name: '3 Canecas + Folha', shortName: '3 + Folha', group: 'Canecas',
    count: 3, file: 'model-trio-paper.obj', hasPaper: true,
    printZones: [
      { key: 'mug1', label: 'Caneca 1', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'mug2', label: 'Caneca 2', meshNames: ['print.001'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'mug3', label: 'Caneca 3', meshNames: ['print.002'], mode: PRINT_MODE.CYLINDRICAL },
    ],
    paperFromZone: 'mug1',
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },

  canecaGlitter: {
    id: 'canecaGlitter', name: 'Caneca com Glitter', shortName: 'C/ Glitter', group: 'Canecas',
    count: 1, file: 'model-CANECA-COM-GLITER.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte (parte de cima)', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'glitter', label: 'Faixa com Glitter (parte de baixo)', meshNames: ['strip', 'strip_print'], material: MATERIAL.GLITTER, default: '#d4af37' },
    ],
    glitterBand: { meshNames: ['strip', 'strip_print'], colorKey: 'glitter' },
  },
  canecaCoracao: {
    id: 'canecaCoracao', name: 'Caneca Coração', shortName: 'Coração', group: 'Canecas',
    count: 1, file: 'model-CANECA-CORACAO.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },
  canecaPequena: {
    id: 'canecaPequena', name: 'Caneca Pequena', shortName: 'Pequena', group: 'Canecas',
    count: 1, file: 'model-CANECA-PEQUENA.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },
  chopp: {
    id: 'chopp', name: 'Caneca de Chopp', shortName: 'Chopp', group: 'Canecas',
    count: 1, file: 'model-CHOP.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      { ...body(), material: MATERIAL.GLASS },
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.GLASS, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.GLASS, default: '#ffffff' },
    ],
    glassOpacity: { key: 'body', label: 'Transparência do vidro', default: 0.15 },
  },
  canecaCasal: {
    id: 'canecaCasal', name: 'Caneca Casal', shortName: 'Casal', group: 'Canecas',
    count: 2, file: 'model-caneca-casal.obj', hasPaper: false,
    printZones: [
      { key: 'heart', label: 'Caneca Coração', meshNames: ['heart_mug_print'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'normal', label: 'Caneca Tradicional', meshNames: ['mug_print'], mode: PRINT_MODE.CYLINDRICAL },
    ],
    colorParts: [
      body(['mug_body', 'heart_mug_body']),
      { key: 'handle', label: 'Alça', meshNames: ['heart_mug_handle', 'mug_handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['heart_mug_inside', 'mug_inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },
  canecaColher: {
    id: 'canecaColher', name: 'Caneca com Colher', shortName: 'C/ Colher', group: 'Canecas',
    count: 1, file: 'model-caneca-colher.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      body(['mug']),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'spoon', label: 'Colher', meshNames: ['spoon'], material: MATERIAL.METAL, default: '#c8c8c8' },
    ],
  },
  canecaConica: {
    id: 'canecaConica', name: 'Caneca Cônica', shortName: 'Cônica', group: 'Canecas',
    count: 1, file: 'model-caneca-conica.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },
  canecaMagica: {
    id: 'canecaMagica', name: 'Caneca Mágica', shortName: 'Mágica', group: 'Canecas',
    count: 2, file: 'model-magic.obj', hasPaper: false,
    printZones: [
      { key: 'mug1', label: 'Caneca 1', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'mug2', label: 'Caneca 2', meshNames: ['print.001'], mode: PRINT_MODE.CYLINDRICAL },
    ],
    colorParts: [
      { ...body(), default: '#0a0a0a' },
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#0a0a0a' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#0a0a0a' },
    ],
    /*
      Efeito "caneca mágica": a arte não fica estática — pulsa,
      alternando entre a caneca preta e a caneca com a arte revelada,
      simulando o efeito térmico real do produto.
    */
    magicAnimation: true,
  },
  duasCanecasDif: {
    id: 'duasCanecasDif', name: '2 Canecas Diferentes', shortName: '2 Diferentes', group: 'Canecas',
    count: 2, file: 'model-DOIS-DIF.obj', hasPaper: false,
    printZones: [
      { key: 'mug1', label: 'Caneca 1', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'mug2', label: 'Caneca 2', meshNames: ['print.001'], mode: PRINT_MODE.CYLINDRICAL },
    ],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'inside', label: 'Parte interna', meshNames: ['inside'], material: MATERIAL.CERAMIC, default: '#ffffff' },
    ],
  },
  copoTermico: {
    id: 'copoTermico', name: 'Copo Térmico (Trio)', shortName: 'C. Térmico', group: 'Canecas',
    count: 3, file: 'model-COPO-TERMICO.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print', 'print.001', 'print.002'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      { ...body(['cup', 'handle', 'bottom']), material: MATERIAL.METAL, default: '#d9d9d9' },
      { key: 'cover', label: 'Tampa', meshNames: ['cover'], material: MATERIAL.PLASTIC, default: '#1a1a1a' },
    ],
  },
  torreParXicara: {
    id: 'torreParXicara', name: 'Torre de Xícaras (Par)', shortName: 'Torre (Par)', group: 'Canecas',
    count: 2, file: 'model-torre-par-xicara.obj', hasPaper: false,
    printZones: [
      { key: 'cup1', label: 'Xícara 1', meshNames: ['body'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'cup2', label: 'Xícara 2', meshNames: ['body.001'], mode: PRINT_MODE.CYLINDRICAL },
    ],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'interior', label: 'Interior', meshNames: ['interior'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'base', label: 'Base / Suporte', meshNames: ['base'], material: MATERIAL.PLASTIC, default: '#e5e5e5' },
    ],
  },
  torreXicaras: {
    id: 'torreXicaras', name: 'Torre de Xícaras (Conjunto)', shortName: 'Torre', group: 'Canecas',
    count: 4, file: 'model-torre-xicaras.obj', hasPaper: false,
    printZones: [
      { key: 'art1', label: 'Arte 1 (xícaras 1 e 3)', meshNames: ['body', 'body.002'], mode: PRINT_MODE.CYLINDRICAL },
      { key: 'art2', label: 'Arte 2 (xícaras 2 e 4)', meshNames: ['body.001', 'body.003'], mode: PRINT_MODE.CYLINDRICAL },
    ],
    colorParts: [
      body(),
      { key: 'handle', label: 'Alça', meshNames: ['handle'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'interior', label: 'Interior', meshNames: ['interior'], material: MATERIAL.CERAMIC, default: '#ffffff' },
      { key: 'base', label: 'Base / Suporte', meshNames: ['base'], material: MATERIAL.PLASTIC, default: '#e5e5e5' },
    ],
  },

  camiseta: {
    id: 'camiseta', name: 'Camiseta', shortName: 'Camiseta', group: 'Vestuário',
    count: 1, file: 'model-CAMISETA.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Frente', meshNames: ['front'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Verso', meshNames: ['back'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [body()],
  },
  babylook: {
    id: 'babylook', name: 'Baby Look', shortName: 'Baby Look', group: 'Vestuário',
    count: 1, file: 'model-BABYLOOK.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Frente', meshNames: ['front'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Verso', meshNames: ['back'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [body()],
  },
  bone: {
    id: 'bone', name: 'Boné', shortName: 'Boné', group: 'Vestuário',
    count: 1, file: 'model-bone.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.FLAT }],
    colorParts: [{ ...body(['cap']), material: MATERIAL.FABRIC }],
  },
  chinelos: {
    id: 'chinelos', name: 'Chinelos (2 artes)', shortName: 'Chinelos', group: 'Vestuário',
    count: 2, file: 'model-chinelos.obj', hasPaper: false,
    printZones: [
      { key: 'left', label: 'Chinelo Esquerdo', meshNames: ['print.001'], mode: PRINT_MODE.FLAT },
      { key: 'right', label: 'Chinelo Direito', meshNames: ['print.002'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [
      { ...body(['flipflop']), material: MATERIAL.FOAM },
      { key: 'straps', label: 'Tiras', meshNames: ['slipper_straps'], material: MATERIAL.PLASTIC, default: '#e5e5e5' },
    ],
  },
  chinelosEspelhado: {
    id: 'chinelosEspelhado', name: 'Chinelos (Arte Espelhada)', shortName: 'Chinelos Esp.', group: 'Vestuário',
    count: 2, file: 'model-chinelo-arteespelhada.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte (espelhada nos dois pés)', meshNames: ['print.001', 'print.002'], mode: PRINT_MODE.FLAT }],
    colorParts: [
      { ...body(['flipflop']), material: MATERIAL.FOAM },
      { key: 'straps', label: 'Tiras', meshNames: ['slipper_straps'], material: MATERIAL.PLASTIC, default: '#e5e5e5' },
    ],
  },

  almofada: {
    id: 'almofada', name: 'Almofada', shortName: 'Almofada', group: 'Casa',
    count: 1, file: 'model-ALMOFADA.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Frente', meshNames: ['front'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Verso', meshNames: ['back'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [body()],
  },
  almofadaRetangular: {
    id: 'almofadaRetangular', name: 'Almofada Retangular', shortName: 'Almofada Ret.', group: 'Casa',
    count: 1, file: 'model-almofada-ret.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Frente', meshNames: ['front'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Verso', meshNames: ['back'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [body()],
  },
  azulejo: {
    id: 'azulejo', name: 'Azulejo', shortName: 'Azulejo', group: 'Casa',
    count: 1, file: 'model-AZULEJO.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.FLAT }],
    colorParts: [
      body(['back']),
      { key: 'support', label: 'Suporte', meshNames: ['support', 'second_support'], material: MATERIAL.PLASTIC, default: '#e5e5e5' },
    ],
  },
  azulejoRetangular: {
    id: 'azulejoRetangular', name: 'Azulejo Retangular', shortName: 'Azulejo Ret.', group: 'Casa',
    count: 1, file: 'model-azulejo-retangulo.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.FLAT }],
    colorParts: [
      body(['back']),
      { key: 'support', label: 'Suporte', meshNames: ['support', 'second_support'], material: MATERIAL.PLASTIC, default: '#e5e5e5' },
    ],
  },
  mousepad: {
    id: 'mousepad', name: 'Mousepad', shortName: 'Mousepad', group: 'Casa',
    count: 1, file: 'model-mousepad.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['mousepad'], mode: PRINT_MODE.FLAT }],
    colorParts: [
      body(),
      { key: 'base', label: 'Base de Borracha', meshNames: ['mousepad_base'], material: MATERIAL.FOAM, default: '#2b2b2b' },
    ],
    fixedParts: [
      { meshNames: ['mouse'], color: '#141414', material: MATERIAL.PLASTIC },
      { meshNames: ['mouse_wheel'], color: '#3a3a3a', material: MATERIAL.PLASTIC },
    ],
  },
  agenda: {
    id: 'agenda', name: 'Agenda', shortName: 'Agenda', group: 'Casa',
    count: 1, file: 'model-agenda.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Capa - Frente', meshNames: ['back'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Capa - Verso', meshNames: ['front'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [{ ...body(), material: MATERIAL.LEATHER }],
    fixedParts: [
      { meshNames: ['wire'], color: '#c9c9c9', material: MATERIAL.METAL },
      { meshNames: ['sheets'], color: '#f5f2ea', material: MATERIAL.CARDBOARD },
    ],
  },
  caixaCaneca: {
    id: 'caixaCaneca', name: 'Caixa para Caneca', shortName: 'Caixa', group: 'Casa',
    count: 1, file: 'model-CX-CANECA.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Frente', meshNames: ['front'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Verso', meshNames: ['back'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [
      { ...body(['right_side', 'left_side', 'top_side']), material: MATERIAL.CARDBOARD },
      { key: 'inside', label: 'Interior da Caixa', meshNames: ['inside'], material: MATERIAL.CARDBOARD, default: '#ffffff' },
    ],
  },
  chaveiroAlmofada: {
    id: 'chaveiroAlmofada', name: 'Chaveiro Almofada', shortName: 'Chaveiro', group: 'Acessórios',
    count: 1, file: 'model-chaveiro-almofada.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Frente', meshNames: ['front'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Verso', meshNames: ['back'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [body(['pillow'])],
    fixedParts: [{ meshNames: ['ring'], color: '#c9c9c9', material: MATERIAL.METAL }],
  },
  ecobag: {
    id: 'ecobag', name: 'Ecobag', shortName: 'Ecobag', group: 'Acessórios',
    count: 1, file: 'model-ecobag.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Frente', meshNames: ['front'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Verso', meshNames: ['back'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [
      body(),
      { key: 'strap', label: 'Alça', meshNames: ['strap'], material: MATERIAL.FABRIC, default: '#ffffff' },
    ],
  },
  mochilaSaco: {
    id: 'mochilaSaco', name: 'Mochila Saco', shortName: 'Mochila', group: 'Acessórios',
    count: 1, file: 'model-mochila-saco.obj', hasPaper: false,
    printZones: [
      { key: 'front', label: 'Frente', meshNames: ['front'], mode: PRINT_MODE.FLAT },
      { key: 'back', label: 'Verso', meshNames: ['back'], mode: PRINT_MODE.FLAT },
    ],
    colorParts: [
      body(),
      { key: 'support', label: 'Reforço', meshNames: ['support'], material: MATERIAL.PLASTIC, default: '#e5e5e5' },
      { key: 'cords', label: 'Cordão', meshNames: ['cords'], material: MATERIAL.FABRIC, default: '#e5e5e5' },
    ],
  },

  garrafa1: {
    id: 'garrafa1', name: 'Garrafa 1', shortName: 'Garrafa 1', group: 'Bebidas',
    count: 1, file: 'model-garrafa1.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      { ...body(), material: MATERIAL.PLASTIC },
      { key: 'cap', label: 'Tampa', meshNames: ['cap'], material: MATERIAL.PLASTIC, default: '#1a1a1a' },
    ],
  },
  garrafa2: {
    id: 'garrafa2', name: 'Garrafa 2', shortName: 'Garrafa 2', group: 'Bebidas',
    count: 1, file: 'model-garrafa2.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      { ...body(), material: MATERIAL.PLASTIC },
      { key: 'cap', label: 'Tampa', meshNames: ['cap'], material: MATERIAL.PLASTIC, default: '#1a1a1a' },
    ],
    fixedParts: [{ meshNames: ['thermometer'], color: '#dfe6e9', material: MATERIAL.GLASS }],
  },
  garrafinha: {
    id: 'garrafinha', name: 'Garrafinha', shortName: 'Garrafinha', group: 'Bebidas',
    count: 1, file: 'model-garrafinha.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      { ...body(), material: MATERIAL.PLASTIC },
      { key: 'cap', label: 'Tampa', meshNames: ['cap'], material: MATERIAL.PLASTIC, default: '#1a1a1a' },
    ],
  },
  longDrinkTransparente: {
    id: 'longDrinkTransparente', name: 'Long Drink Transparente', shortName: 'L.Drink Transp.', group: 'Bebidas',
    count: 1, file: 'model-long-drink-transparente.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [{ ...body(), material: MATERIAL.GLASS }],
    glassOpacity: { key: 'body', label: 'Transparência do copo', default: 0.15 },
  },
  longDrinkBranco: {
    id: 'longDrinkBranco', name: 'Long Drink Branco', shortName: 'L.Drink Branco', group: 'Bebidas',
    count: 1, file: 'model-longdrink-branco.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [{ ...body(), material: MATERIAL.PLASTIC }],
  },
  squeezeMosquetao: {
    id: 'squeezeMosquetao', name: 'Squeeze com Mosquetão', shortName: 'Squeeze', group: 'Bebidas',
    count: 1, file: 'model-squeeze-mosquetao.obj', hasPaper: false,
    printZones: [{ key: 'main', label: 'Arte', meshNames: ['print'], mode: PRINT_MODE.CYLINDRICAL }],
    colorParts: [
      { ...body(['bottom']), material: MATERIAL.PLASTIC },
      { key: 'cover', label: 'Tampa', meshNames: ['cover'], material: MATERIAL.PLASTIC, default: '#1a1a1a' },
      { key: 'handle', label: 'Alça', meshNames: ['handle', 'handle_support'], material: MATERIAL.PLASTIC, default: '#1a1a1a' },
    ],
    fixedParts: [
      { meshNames: ['handle_chrome', 'handle_chrome_button_01', 'handle_chrome_button_02'], color: '#d8d8d8', material: MATERIAL.METAL },
      { meshNames: ['internal'], color: '#000000', material: MATERIAL.HIDDEN },
    ],
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
