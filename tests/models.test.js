import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { MODELS, DEFAULT_MODEL_ID, MODEL_GROUPS, getModel } from '../src/config/models.js'
import { getModelsByGroup } from '../src/components/ModelPicker.jsx'

const publicDir = path.resolve(__dirname, '../public')

describe('catálogo de modelos', () => {
  it('o modelo padrão existe e está visível', () => {
    expect(MODELS[DEFAULT_MODEL_ID]).toBeDefined()
    expect(MODELS[DEFAULT_MODEL_ID].hidden).toBeFalsy()
  })

  it('a chave de cada modelo é igual ao seu id', () => {
    for (const [key, model] of Object.entries(MODELS)) {
      expect(model.id).toBe(key)
    }
  })

  it('todo modelo visível aponta para um arquivo .obj que existe em public/', () => {
    for (const model of Object.values(MODELS)) {
      if (model.hidden) continue

      const file = model.file || 'model.obj'
      expect(fs.existsSync(path.join(publicDir, file)), `${model.id}: ${file}`).toBe(true)
    }
  })

  it('todo modelo tem ao menos uma área de arte e uma parte colorível', () => {
    for (const model of Object.values(MODELS)) {
      expect(model.printZones.length, model.id).toBeGreaterThan(0)
      expect(model.colorParts.length, model.id).toBeGreaterThan(0)
    }
  })

  it('todo modelo visível tem miniatura', () => {
    for (const model of Object.values(MODELS)) {
      if (model.hidden) continue
      expect(fs.existsSync(path.join(publicDir, 'thumbnails', `${model.id}.png`)), model.id).toBe(true)
    }
  })

  it('os modelos com defeito estão ocultos da lista', () => {
    for (const id of ['azulejoRetangular', 'mousepad', 'mochilaSaco', 'longDrinkTransparente']) {
      expect(MODELS[id].hidden, id).toBe(true)
    }

    const listed = getModelsByGroup().flatMap((g) => g.items.map((m) => m.id))

    expect(listed).not.toContain('mousepad')
    expect(listed).toContain(DEFAULT_MODEL_ID)
  })

  it('modelo desconhecido cai no padrão', () => {
    expect(getModel('nao-existe').id).toBe(DEFAULT_MODEL_ID)
  })

  it('todo grupo usado existe na lista de categorias', () => {
    for (const model of Object.values(MODELS)) {
      expect(MODEL_GROUPS).toContain(model.group)
    }
  })
})
