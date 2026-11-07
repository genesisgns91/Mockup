import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/*
  Acessibilidade: a cena 3D recebe foco do teclado e pode ser
  girada com as setas (Shift = passo maior) e aproximada com + / -.
  Também ganha uma descrição para leitores de tela.
*/
export function KeyboardOrbit() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)

  useEffect(() => {
    const el = gl.domElement

    el.tabIndex = 0
    el.setAttribute('role', 'img')
    el.setAttribute(
      'aria-label',
      'Visualização 3D do produto. Use as setas do teclado para girar e as teclas mais e menos para aproximar ou afastar.'
    )

    const onKey = (event) => {
      if (!controls) return

      const step = event.shiftKey ? 0.3 : 0.12
      const offset = camera.position.clone().sub(controls.target)
      const sph = new THREE.Spherical().setFromVector3(offset)

      switch (event.key) {
        case 'ArrowLeft':
          sph.theta -= step
          break
        case 'ArrowRight':
          sph.theta += step
          break
        case 'ArrowUp':
          sph.phi -= step
          break
        case 'ArrowDown':
          sph.phi += step
          break
        case '+':
        case '=':
          sph.radius *= 0.9
          break
        case '-':
        case '_':
          sph.radius *= 1.1
          break
        default:
          return
      }

      event.preventDefault()

      sph.phi = THREE.MathUtils.clamp(
        sph.phi,
        controls.minPolarAngle ?? 0.01,
        controls.maxPolarAngle ?? Math.PI - 0.01
      )

      sph.radius = THREE.MathUtils.clamp(
        sph.radius,
        controls.minDistance || 0.5,
        Number.isFinite(controls.maxDistance) ? controls.maxDistance : 50
      )

      offset.setFromSpherical(sph)
      camera.position.copy(controls.target).add(offset)
      controls.update()
    }

    el.addEventListener('keydown', onKey)

    return () => el.removeEventListener('keydown', onKey)
  }, [gl, camera, controls])

  return null
}
