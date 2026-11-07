/*
  ==========================================================
  ARQUIVOS DE IMAGEM

  • prepareImage: lê o arquivo e, se for gigante, reduz para um
    tamanho seguro de textura (celulares costumam travar com
    fotos de 6000 px+). Devolve a imagem pronta e o arquivo
    (reduzido ou original) para guardar.
  • Registro de URLs: cada URL de blob criada é anotada e
    liberada da memória quando nada mais a usa (ver useHistory).
  ==========================================================
*/

export const MAX_IMAGE_PX = 4096

const registry = new Map() // url -> blob

export function registerUrl(url, blob) {
  registry.set(url, blob)
}

export function getBlobForUrl(url) {
  return registry.get(url) || null
}

export function pruneUrls(keep) {
  for (const url of [...registry.keys()]) {
    if (!keep.has(url)) {
      registry.delete(url)

      try {
        URL.revokeObjectURL(url)
      } catch {
        // URL já liberada
      }
    }
  }
}

export function isImageFile(file) {
  return Boolean(file && file.type && file.type.startsWith('image/'))
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error('Não foi possível ler essa imagem. Tente outro arquivo.'))

    img.src = url
  })
}

export async function prepareImage(file, name, { maxSize = MAX_IMAGE_PX } = {}) {
  let blob = file
  let url = URL.createObjectURL(blob)
  let img

  try {
    img = await loadImage(url)
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }

  let resized = false
  const longest = Math.max(img.naturalWidth, img.naturalHeight)

  if (longest > maxSize) {
    const k = maxSize / longest
    const w = Math.max(1, Math.round(img.naturalWidth * k))
    const h = Math.max(1, Math.round(img.naturalHeight * k))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)

    const type = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'

    const out = await new Promise((resolve) =>
      canvas.toBlob(resolve, type, 0.92)
    )

    if (out) {
      URL.revokeObjectURL(url)

      blob = out
      url = URL.createObjectURL(blob)
      img = await loadImage(url)
      resized = true
    }
  }

  registerUrl(url, blob)

  return {
    img,
    blob,
    url,
    name: name || file.name || 'imagem',
    resized,
    width: img.naturalWidth,
    height: img.naturalHeight,
  }
}


/*
  Reúne todas as URLs de imagem usadas por um conjunto de
  "fotografias" do projeto (para saber quais ainda são necessárias).
*/
export function collectUrls(snapshots) {
  const urls = new Set()

  for (const snap of snapshots) {
    if (!snap) continue

    for (const zone of Object.values(snap.artZones || {})) {
      if (zone?.image?.src) urls.add(zone.image.src)
    }

    if (snap.background?.image) urls.add(snap.background.image)
  }

  return urls
}
