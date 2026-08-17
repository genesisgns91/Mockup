import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, useLoader, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, useTexture } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import * as THREE from 'three'
import { useDecalTexture } from '../hooks/useDecalTexture.js'

function SceneBackground({ background }) {
  const { scene } = useThree()

  useEffect(() => {
    if (background.type === 'color') {
      scene.background = new THREE.Color(background.color)
      return () => {
        scene.background = null
      }
    }
  }, [background.type, background.color, scene])

  if (background.type === 'image' && background.image) {
    return <BackgroundImage url={background.image} />
  }
  return null
}

function BackgroundImage({ url }) {
  const { scene } = useThree()
  const texture = useTexture(url)
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    scene.background = texture
    return () => {
      scene.background = null
    }
  }, [texture, scene])
  return null
}

const TARGET_HEIGHT = 1.7 // world units a single mug's height should occupy
const MODEL_URLS = {
  1: '/model.obj',
  2: '/model-duo.obj',
  3: '/model-trio.obj',
}

// Shared "ceramic" PBR tuning used for every part of the mug (body, handle,
// inside, print). Kept fairly matte (moderate roughness, modest clearcoat,
// restrained envMapIntensity) so white ceramic reads as white under the
// HDRI instead of picking up dark environment reflections.
const CERAMIC_PARAMS = {
  metalness: 0.0,
  clearcoat: 0.7,
  clearcoatRoughness: 0.3,
  envMapIntensity: 0.5,
}

// Object names in the OBJ files follow the pattern "<part>" and "<part>.001"
// (and "<part>.002" for the third mug in the trio file). Strip the suffix to
// find the part.
function baseName(name) {
  return name.replace(/\.\d+$/, '')
}

function Mug({ art, mugColors, mugCount, onFrame }) {
  const obj = useLoader(OBJLoader, MODEL_URLS[mugCount] || MODEL_URLS[1])
  const group = useMemo(() => obj.clone(true), [obj])
  const [measurements, setMeasurements] = useState(null)
  const groupRef = useRef(null)

  // Auto-fit: scale the model to a consistent on-screen size and place its
  // base on the ground plane (y = 0), regardless of the model's native units
  // or how many mugs are laid out side by side.
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(group)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const scale = TARGET_HEIGHT / size.y
    group.scale.setScalar(scale)
    group.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
    onFrame?.({ width: size.x * scale, height: size.y * scale, depth: size.z * scale })
  }, [group, onFrame])

  useEffect(() => {
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(mugColors.body),
      roughness: 0.42,
      ...CERAMIC_PARAMS,
    })
    const insideMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(mugColors.inside),
      roughness: 0.48,
      ...CERAMIC_PARAMS,
    })
    const handleMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(mugColors.handle),
      roughness: 0.42,
      ...CERAMIC_PARAMS,
    })

    let printRadiusUnits = null
    let printHeightUnits = null

    group.traverse((child) => {
      if (!child.isMesh) return

      const name = baseName(child.name)

      // Technical helper geometry from Blender (empties/pivots) — never rendered.
      if (name === 'pivot') {
        child.visible = false
        return
      }

      child.castShadow = true
      child.receiveShadow = true

      if (name === 'inside') {
        child.material = insideMaterial
      } else if (name === 'handle') {
        child.material = handleMaterial
      } else if (name === 'decal') {
        // Legacy single-mug file has a redundant "decal" shell identical to
        // "print" — hide it, the artwork now paints directly onto "print".
        child.visible = false
      } else if (name !== 'print' && name.startsWith('print')) {
        // Leftover Blender alignment quads from the trio model (e.g.
        // "printA", "printB") that duplicate/overlap the real "print"
        // shells — never rendered, same treatment as the legacy "decal" shell.
        child.visible = false
      } else if (name === 'print') {
        if (printRadiusUnits === null) {
          // IMPORTANT: in the 2- and 3-mug models each mug's geometry is
          // baked at its own offset position in the file (there's no
          // per-object transform, the multi-mug layout is baked directly
          // into the vertex coordinates). So the radius must be measured
          // from THIS mesh's own center, not from the world origin —
          // otherwise mugs positioned away from the origin get a wildly
          // inflated "radius" (distance-to-origin instead of distance-to-
          // own-axis), which under-scales the artwork on the canvas and
          // makes it wrap only partway around the mug.
          const pos = child.geometry.attributes.position
          let minY = Infinity
          let maxY = -Infinity
          let sumX = 0
          let sumZ = 0
          for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i)
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            sumX += pos.getX(i)
            sumZ += pos.getZ(i)
          }
          const centerX = sumX / pos.count
          const centerZ = sumZ / pos.count

          let rSum = 0
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i) - centerX
            const z = pos.getZ(i) - centerZ
            rSum += Math.hypot(x, z)
          }
          printRadiusUnits = rSum / pos.count
          printHeightUnits = maxY - minY
        }
        // material assigned in the texture effect below
      } else {
        // "other" and "bottom" share the body's ceramic color.
        child.material = bodyMaterial
      }
    })

    if (printRadiusUnits !== null) {
      setMeasurements({ radiusUnits: printRadiusUnits, heightUnits: printHeightUnits })
    }

    return () => {
      bodyMaterial.dispose()
      insideMaterial.dispose()
      handleMaterial.dispose()
    }
  }, [group, mugColors.body, mugColors.inside, mugColors.handle])

  const { texture, warning } = useDecalTexture({
    artImage: art.image,
    artWidthMM: art.widthMM,
    artHeightMM: art.heightMM,
    offsetXMM: art.offsetXMM,
    offsetYMM: art.offsetYMM,
    mugRadiusUnits: measurements?.radiusUnits,
    mugHeightUnits: measurements?.heightUnits,
    mugRealHeightMM: art.mugRealHeightMM,
    baseColor: mugColors.body,
  })

  useEffect(() => {
    art.onWarning?.(warning)
  }, [warning, art])

  useEffect(() => {
    if (!texture) return
    // Color stays neutral white here: the ceramic body color is already
    // baked into the canvas texture itself (see useDecalTexture), so the
    // "print" mesh always shows the right color even without artwork.
    const printMaterial = new THREE.MeshPhysicalMaterial({
      map: texture,
      color: new THREE.Color(0xffffff),
      roughness: 0.42,
      ...CERAMIC_PARAMS,
    })
    group.traverse((child) => {
      if (child.isMesh && baseName(child.name) === 'print') {
        child.material = printMaterial
        child.material.needsUpdate = true
      }
    })
    return () => printMaterial.dispose()
  }, [group, texture])

  return <primitive ref={groupRef} object={group} />
}

const ROTATE_SECONDS = 6

// Points the camera at the loaded model and pulls it back just enough that
// the whole thing (1, 2 or 3 mugs, any width) fits comfortably in view.
function CameraRig({ frame }) {
  const { camera, size, controls } = useThree()

  useEffect(() => {
    if (!frame) return
    const fovRad = (camera.fov * Math.PI) / 180
    const aspect = size.width / size.height
    const distForHeight = frame.height / 2 / Math.tan(fovRad / 2)
    const distForWidth = frame.width / 2 / (Math.tan(fovRad / 2) * aspect)
    const distance = Math.max(distForHeight, distForWidth) * 1.4

    const target = new THREE.Vector3(0, frame.height / 2, 0)
    const dir = new THREE.Vector3(0.85, 0.55, 1).normalize()
    camera.position.copy(dir.multiplyScalar(distance).add(target))
    camera.near = Math.max(0.01, distance / 100)
    camera.far = distance * 20
    camera.lookAt(target)
    camera.updateProjectionMatrix()

    if (controls) {
      controls.target.copy(target)
      controls.minDistance = distance * 0.45
      controls.maxDistance = distance * 2.5
      controls.update()
    }
  }, [frame, camera, size, controls])

  return null
}

function CaptureRig({ registerApi, spinTargetRef }) {
  const { gl, scene, camera, size } = useThree()
  const recordingRef = useRef(false)

  useFrame((_, delta) => {
    if (recordingRef.current && spinTargetRef.current) {
      spinTargetRef.current.rotation.y += (delta * Math.PI * 2) / ROTATE_SECONDS
    }
  })

  useEffect(() => {
    registerApi({
      screenshot: (multiplier = 3) => {
        const prevRatio = gl.getPixelRatio()
        const targetRatio = Math.min(4, prevRatio * multiplier)
        gl.setPixelRatio(targetRatio)
        gl.setSize(size.width, size.height, false)
        gl.render(scene, camera)
        const dataUrl = gl.domElement.toDataURL('image/png', 1.0)
        gl.setPixelRatio(prevRatio)
        gl.setSize(size.width, size.height, false)
        gl.render(scene, camera)
        return dataUrl
      },
      startRecording: (onDone) => {
        const canvas = gl.domElement
        const stream = canvas.captureStream(30)
        const candidates = [
          'video/mp4;codecs=avc1.42E01E',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm',
        ]
        const mimeType = candidates.find(
          (m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)
        )
        if (!window.MediaRecorder) {
          onDone(null, null, 'MediaRecorder não é suportado neste navegador.')
          return
        }
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType, videoBitsPerSecond: 10_000_000 } : undefined
        )
        const chunks = []
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data)
        }
        recorder.onstop = () => {
          recordingRef.current = false
          if (spinTargetRef.current) spinTargetRef.current.rotation.y = 0
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' })
          onDone(blob, mimeType, null)
        }
        recordingRef.current = true
        if (spinTargetRef.current) spinTargetRef.current.rotation.y = 0
        recorder.start()
        setTimeout(() => recorder.stop(), ROTATE_SECONDS * 1000)
      },
    })
  }, [registerApi, gl, scene, camera, size, spinTargetRef])

  return null
}

export default function MugScene({ art, background, mugColors, mugCount, registerApi, spinTargetRef }) {
  const [frame, setFrame] = useState(null)

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2.7, 1.8, 3.0], fov: 30 }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, preserveDrawingBuffer: true }}
    >
      <SceneBackground background={background} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={1.5}
        shadow-camera-bottom={-1.5}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} />
      <Environment preset="studio" />
      <group ref={spinTargetRef}>
        <Mug art={art} mugColors={mugColors} mugCount={mugCount} onFrame={setFrame} />
      </group>
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.55}
        scale={Math.max(4, (frame?.width || 2) * 1.6)}
        blur={2.4}
        far={1.2}
      />
      <OrbitControls makeDefault enablePan={false} minPolarAngle={Math.PI / 6} maxPolarAngle={Math.PI / 1.7} />
      <CameraRig frame={frame} />
      <CaptureRig registerApi={registerApi} spinTargetRef={spinTargetRef} />
    </Canvas>
  )
}
