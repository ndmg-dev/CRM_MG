import { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'

let modelsLoaded = false
let loadingPromise: Promise<void> | null = null

async function loadModels(): Promise<void> {
  if (modelsLoaded) return
  if (loadingPromise) return loadingPromise
  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
    ])
    modelsLoaded = true
  })()
  return loadingPromise
}

export interface FaceDetectResult {
  detected: boolean
  bbox: { x: number; y: number; w: number; h: number } | null
  // 5 pontos: [olho_esq, olho_dir, nariz, boca_esq, boca_dir] — coordenadas absolutas em px
  kps: number[][] | null
  img_width: number
  img_height: number
}

const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 })

export async function detectFaceWithLandmarks(
  video: HTMLVideoElement,
): Promise<FaceDetectResult> {
  const w = video.videoWidth  || 640
  const h = video.videoHeight || 480

  if (!modelsLoaded) return { detected: false, bbox: null, kps: null, img_width: w, img_height: h }

  // Tenta detecção com landmarks
  const result = await faceapi
    .detectSingleFace(video, detectorOptions)
    .withFaceLandmarks(true) // true = tiny 68-point model

  if (result) {
    const { x, y, width, height } = result.detection.box
    const pts = result.landmarks.positions
    // Mapeia os 68 pontos para os mesmos 5 do InsightFace
    // Índices 0-based: olho_esq≈36-41, olho_dir≈42-47, nariz≈30, boca_esq=48, boca_dir=54
    const eyeL   = avgPoints(pts.slice(36, 42))
    const eyeR   = avgPoints(pts.slice(42, 48))
    const nose   = [pts[30].x, pts[30].y]
    const mouthL = [pts[48].x, pts[48].y]
    const mouthR = [pts[54].x, pts[54].y]
    return {
      detected: true,
      bbox: { x, y, w: width, h: height },
      kps: [eyeL, eyeR, nose, mouthL, mouthR],
      img_width: w,
      img_height: h,
    }
  }

  // Fallback: só detecção sem landmarks (pose check será ignorado)
  const det = await faceapi.detectSingleFace(video, detectorOptions)
  if (!det) return { detected: false, bbox: null, kps: null, img_width: w, img_height: h }

  const { x, y, width, height } = det.box
  return {
    detected: true,
    bbox: { x, y, w: width, h: height },
    kps: null,
    img_width: w,
    img_height: h,
  }
}

function avgPoints(pts: faceapi.Point[]): number[] {
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length
  return [x, y]
}

export function useFaceDetectionLoader() {
  const [ready, setReady] = useState(modelsLoaded)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (!modelsLoaded) {
      loadModels().then(() => { if (mountedRef.current) setReady(true) })
    }
    return () => { mountedRef.current = false }
  }, [])

  return ready
}
