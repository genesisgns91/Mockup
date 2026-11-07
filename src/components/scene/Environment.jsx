import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import * as THREE from 'three'


/*
  Ambiente de estúdio (reflexos/iluminação) GERADO LOCALMENTE,
  sem depender de nenhum arquivo .hdr baixado de CDN externa.
  Mais rápido e continua funcionando mesmo em redes restritas.
*/
export function StudioEnvironment() {
  const { gl, scene } = useThree()

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)

    const envTexture = pmrem.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture

    scene.environment = envTexture

    return () => {
      scene.environment = null
      envTexture.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return null
}

/*
  ==========================================================
  FUNDO

  Fundo sólido continua sendo desenhado pelo Three.js
  (scene.background = Color), como antes.

  Fundo de IMAGEM agora é responsabilidade do App.jsx,
  renderizado em HTML por trás do canvas (que fica
  transparente). Isso permite controle total de encaixe,
  zoom e posição por arraste, com a mesma composição
  aplicada também na exportação (PNG/vídeo).
  ==========================================================
*/
export function SceneBackground({ background }) {
  const { scene } = useThree()

  useEffect(() => {
    if (background.type === 'color') {
      scene.background = new THREE.Color(
        background.color
      )

      return () => {
        scene.background = null
      }
    }

    scene.background = null

    return undefined
  }, [
    background.type,
    background.color,
    scene,
  ])

  return null
}
