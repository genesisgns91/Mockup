export const MODELS = {
    single: {
      id: 'single',
      name: '1 Caneca',
      shortName: 'Caneca',
      count: 1,
      file: 'model.obj',
      hasPaper: false,
    },
  
    duo: {
      id: 'duo',
      name: '2 Canecas',
      shortName: '2 Canecas',
      count: 2,
      file: 'model-duo.obj',
      hasPaper: false,
    },
  
    trio: {
      id: 'trio',
      name: '3 Canecas',
      shortName: '3 Canecas',
      count: 3,
      file: 'model-trio.obj',
      hasPaper: false,
    },
  
    trioPaper: {
      id: 'trioPaper',
      name: '3 Canecas + Folha',
      shortName: '3 + Folha',
      count: 3,
      file: 'model-trio-paper.obj',
      hasPaper: true,
    },
  }
  
  export const DEFAULT_MODEL_ID = 'single'