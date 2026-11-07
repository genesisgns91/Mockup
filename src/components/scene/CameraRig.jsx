import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'


export function CameraRig({ frame, reframeKey, resetToken }) {
  const {
    camera,
    size,
    controls,
    get,
  } = useThree()

  const pendingReframe = useRef(false)


  const applyFraming = () => {
    if (!frame) return

    const { width: sizeW, height: sizeH } = get().size

    const fovRad =
      (
        camera.fov *
        Math.PI
      ) / 180

    const aspect =
      sizeW / sizeH

    const distForHeight =
      frame.height /
      2 /
      Math.tan(fovRad / 2)

    const distForWidth =
      frame.width /
      2 /
      (
        Math.tan(fovRad / 2) *
        aspect
      )

    const distance =
      Math.max(
        distForHeight,
        distForWidth
      ) * 1.4


    const target =
      new THREE.Vector3(
        0,
        frame.height / 2,
        0
      )

    const dir =
      new THREE.Vector3(
        0.85,
        0.55,
        1
      ).normalize()


    camera.position.copy(
      dir
        .multiplyScalar(distance)
        .add(target)
    )

    camera.near =
      Math.max(
        0.01,
        distance / 100
      )

    camera.far =
      distance * 20

    camera.lookAt(target)

    camera.updateProjectionMatrix()


    if (controls) {
      controls.target.copy(target)

      controls.minDistance =
        distance * 0.45

      /*
        NOVO:
        Zoom out mais generoso, para dar mais
        espaço de composição/enquadramento.
      */
      controls.maxDistance =
        distance * 4.5

      controls.update()
    }

    /*
      BUGFIX:
      Esse efeito reposiciona a câmera para o
      enquadramento padrão. Antes, ele também rodava
      de novo sempre que "size" (tamanho do canvas)
      mudava — e no celular, rolar a página esconde/
      mostra a barra de endereço do navegador, o que
      dispara um resize do canvas e resetava qualquer
      ajuste manual que o usuário tivesse feito na
      posição da caneca.

      Agora o reposicionamento só acontece quando
      "frame" muda de verdade (ou seja, quando o
      modelo de caneca é trocado). camera/size/controls
      continuam sendo lidos normalmente aqui dentro,
      só não fazem o efeito rodar de novo sozinhos.
    */
  }

  /*
    Enquadramento automático: roda quando o modelo muda, quando
    o usuário pede "recentralizar" (resetToken) e quando o
    formato do quadro muda (reframeKey) — nesse último caso
    espera o canvas ganhar o novo tamanho antes de calcular.
  */
  useEffect(() => {
    applyFraming()
  }, [frame, resetToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const firstKey = useRef(true)

  useEffect(() => {
    if (firstKey.current) {
      firstKey.current = false
      return undefined
    }

    pendingReframe.current = true

    const fallback = setTimeout(() => {
      if (pendingReframe.current) {
        pendingReframe.current = false
        applyFraming()
      }
    }, 450)

    return () => clearTimeout(fallback)
  }, [reframeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingReframe.current) {
      pendingReframe.current = false
      applyFraming()
    }
  }, [size.width, size.height]) // eslint-disable-line react-hooks/exhaustive-deps


  return null
}
