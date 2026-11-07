/*
  ==========================================================
  SALVAMENTO AUTOMÁTICO (neste navegador)

  • Configurações (modelo, cores, medidas, fundo, exportação…)
    ficam no localStorage como JSON pequeno.
  • As imagens enviadas ficam no IndexedDB como arquivos (Blob),
    porque o localStorage não comporta imagens grandes.
  Tudo é opcional e tolerante a falhas: se o navegador bloquear
  o armazenamento (modo privado, por exemplo), o app segue
  funcionando normalmente, apenas sem restaurar ao recarregar.
  ==========================================================
*/

const SETTINGS_KEY = 'almatie-mockup:project:v1'
const DB_NAME = 'almatie-mockup'
const STORE = 'blobs'

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const data = raw ? JSON.parse(raw) : null

    return data && data.v === 1 ? data : null
  } catch {
    return null
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ v: 1, ...settings }))
  } catch {
    // sem espaço ou bloqueado: ignora
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'))
      return
    }

    const req = indexedDB.open(DB_NAME, 1)

    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run(mode, fn) {
  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const result = fn(tx.objectStore(STORE))

    tx.oncomplete = () => {
      db.close()
      resolve(result && 'result' in result ? result.result : undefined)
    }

    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function putBlob(key, blob, name) {
  try {
    await run('readwrite', (store) => store.put({ blob, name }, key))
  } catch {
    // ignora
  }
}

export async function getBlob(key) {
  try {
    return (await run('readonly', (store) => store.get(key))) || null
  } catch {
    return null
  }
}

export async function deleteBlob(key) {
  try {
    await run('readwrite', (store) => store.delete(key))
  } catch {
    // ignora
  }
}
