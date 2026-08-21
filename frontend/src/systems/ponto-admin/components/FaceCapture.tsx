import { useState, useRef, useEffect, useCallback } from 'react'
import { detectFaceWithLandmarks, useFaceDetectionLoader, type FaceDetectResult } from '../hooks/useFaceDetection'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type PoseReq = 'frontal' | 'turn_left' | 'turn_right' | 'chin_down'

type FaceStatus =
  | 'no_face'
  | 'too_far' | 'too_close'
  | 'move_left' | 'move_right' | 'move_up' | 'move_down'
  | 'bad_lighting'
  | 'need_frontal'
  | 'need_turn_left' | 'need_turn_right'
  | 'need_chin_down'
  | 'ready'

// ─── Passos ──────────────────────────────────────────────────────────────────

const STEPS: { label: string; instruction: string; hint: string; pose: PoseReq }[] = [
  { label: 'Frontal', instruction: 'Olhe direto para a câmera',           hint: 'Rosto reto, olhar para a lente',           pose: 'frontal'    },
  { label: 'Esq.',    instruction: 'Vire o rosto para a esquerda',        hint: 'Gire o rosto ~20° para sua esquerda',      pose: 'turn_left'  },
  { label: 'Dir.',    instruction: 'Vire o rosto para a direita',         hint: 'Gire o rosto ~20° para sua direita',       pose: 'turn_right' },
  { label: 'Baixo',  instruction: 'Incline o queixo levemente para baixo', hint: 'Abaixe o queixo uns 10–15°',             pose: 'chin_down'  },
  { label: 'Final',  instruction: 'Olhe novamente direto para a câmera', hint: 'Confirma a posição frontal',               pose: 'frontal'    },
]

// ─── Mensagens de status ──────────────────────────────────────────────────────

const MSG: Record<FaceStatus, { color: string; text: string }> = {
  no_face:        { color: '#E24B4A', text: 'Posicione o rosto no oval'              },
  too_far:        { color: '#C9960C', text: '↕  Aproxime-se da câmera'              },
  too_close:      { color: '#C9960C', text: '↕  Afaste-se um pouco'                 },
  move_left:      { color: '#C9960C', text: '←  Mova para a esquerda'               },
  move_right:     { color: '#C9960C', text: '→  Mova para a direita'                },
  move_up:        { color: '#C9960C', text: '↑  Levante o rosto'                    },
  move_down:      { color: '#C9960C', text: '↓  Abaixe o rosto'                     },
  bad_lighting:   { color: '#E24B4A', text: '⚡  Iluminação insuficiente — acenda mais luzes' },
  need_frontal:   { color: '#C9960C', text: '↩  Vire o rosto de volta para a câmera' },
  need_turn_left: { color: '#C9960C', text: '←  Vire mais para a sua esquerda'      },
  need_turn_right:{ color: '#C9960C', text: '→  Vire mais para a sua direita'        },
  need_chin_down: { color: '#C9960C', text: '↓  Abaixe mais o queixo'               },
  ready:          { color: '#2a9d5c', text: 'Perfeito! Mantenha a posição...'        },
}

// ─── Estimativa de pose via keypoints ────────────────────────────────────────

function checkPose(kps: number[][] | null, required: PoseReq): FaceStatus | 'ok' {
  if (!kps || kps.length < 5) return 'ok'

  const [eyeL, eyeR, nose, mouthL, mouthR] = kps
  const midX    = (eyeL[0] + eyeR[0]) / 2
  const eyeDist = Math.abs(eyeR[0] - eyeL[0]) || 1
  const yaw     = (nose[0] - midX) / eyeDist

  const mouthMidY   = (mouthL[1] + mouthR[1]) / 2
  const noseToMouth = (mouthMidY - nose[1]) / eyeDist

  const YAW_FRONT = 0.24
  const YAW_TURN  = 0.18
  const CHIN_THR  = 0.65

  switch (required) {
    case 'frontal':
      if (Math.abs(yaw) > YAW_FRONT) return 'need_frontal'
      return 'ok'
    case 'turn_left':
      if (yaw < YAW_TURN) return 'need_turn_left'
      return 'ok'
    case 'turn_right':
      if (yaw > -YAW_TURN) return 'need_turn_right'
      return 'ok'
    case 'chin_down':
      if (noseToMouth > CHIN_THR) return 'need_chin_down'
      return 'ok'
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

const DETECT_MS  = 500
const HOLD_TICKS = 5

interface Props {
  onComplete: (photos: string[]) => void
  onCancel:   () => void
}

export default function FaceCapture({ onComplete, onCancel }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busyRef   = useRef(false)
  const ticksRef  = useRef(0)
  const photosRef = useRef<string[]>([])
  const doneRef   = useRef(false)

  const [step,     setStep]     = useState(0)
  const [status,   setStatus]   = useState<FaceStatus>('no_face')
  const [photos,   setPhotos]   = useState<string[]>([])
  const [ticks,    setTicks]    = useState(0)
  const [camError, setCamError] = useState('')

  const modelsReady = useFaceDetectionLoader()

  useEffect(() => { photosRef.current = photos }, [photos])

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setCamError('Câmera não disponível. Verifique as permissões.'))
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const captureFrame = useCallback((quality = 0.80): string | null => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c || v.readyState < 2) return null
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', quality).split(',')[1]
  }, [])

  const checkLighting = useCallback((): boolean => {
    const c = canvasRef.current
    if (!c) return true
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let total = 0
    for (let i = 0; i < d.length; i += 4)
      total += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
    const luma = total / (d.length / 4)
    return luma >= 45 && luma <= 235
  }, [])

  const classifyFrame = useCallback((det: FaceDetectResult): FaceStatus | 'ok' => {
    if (!det.detected || !det.bbox) return 'no_face'
    const { x, y, w, h } = det.bbox
    const cx = (x + w / 2) / det.img_width
    const cy = (y + h / 2) / det.img_height
    const wr = w / det.img_width
    if (wr < 0.18) return 'too_far'
    if (wr > 0.75) return 'too_close'
    if (cx < 0.27) return 'move_left'
    if (cx > 0.73) return 'move_right'
    if (cy < 0.18) return 'move_down'
    if (cy > 0.72) return 'move_up'
    return 'ok'
  }, [])

  useEffect(() => {
    if (!modelsReady) return

    const id = setInterval(async () => {
      if (busyRef.current || doneRef.current) return
      const v = videoRef.current
      if (!v || v.readyState < 2) return
      busyRef.current = true
      try {
        captureFrame(0.72) // popula canvas para checkLighting
        if (!checkLighting()) {
          setStatus('bad_lighting'); ticksRef.current = 0; setTicks(0); return
        }

        const det = await detectFaceWithLandmarks(v)

        const frameStatus = classifyFrame(det)
        if (frameStatus !== 'ok') {
          setStatus(frameStatus as FaceStatus); ticksRef.current = 0; setTicks(0); return
        }

        const currentStepIndex = photosRef.current.length
        const requiredPose = STEPS[Math.min(currentStepIndex, STEPS.length - 1)].pose
        const poseStatus = checkPose(det.kps, requiredPose)
        if (poseStatus !== 'ok') {
          setStatus(poseStatus as FaceStatus); ticksRef.current = 0; setTicks(0); return
        }

        setStatus('ready')
        ticksRef.current += 1
        setTicks(ticksRef.current)

        if (ticksRef.current >= HOLD_TICKS) {
          const hq = captureFrame(0.80)
          if (!hq) return
          ticksRef.current = 0; setTicks(0)
          const next = [...photosRef.current, hq]
          photosRef.current = next
          setPhotos(next)
          if (next.length >= STEPS.length) {
            doneRef.current = true
            onComplete(next)
          } else {
            setStep(next.length)
            setStatus('no_face')
          }
        }
      } catch {
        // erro transitório, ignora
      } finally {
        busyRef.current = false
      }
    }, DETECT_MS)

    return () => clearInterval(id)
  }, [modelsReady, captureFrame, checkLighting, classifyFrame, onComplete])

  // ─── Render ────────────────────────────────────────────────────────────────

  const cfg          = MSG[status]
  const progressPct  = (ticks / HOLD_TICKS) * 100
  const secondsLeft  = Math.max(1, Math.ceil((HOLD_TICKS - ticks) * DETECT_MS / 1000))
  const isReady      = status === 'ready'
  const currentStep  = STEPS[Math.min(step, STEPS.length - 1)]

  if (camError) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 13, color: 'var(--mg-red)', marginBottom: 16 }}>{camError}</div>
        <button className="btn-ghost" onClick={onCancel}>Fechar</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        {STEPS.map((s, i) => (
          <div key={i} title={s.label} style={{
            height: 8,
            width: i === step && photos.length < STEPS.length ? 22 : 8,
            borderRadius: 4,
            background:
              i < photos.length ? '#2a9d5c' :
              i === step        ? '#C9960C' :
                                  'rgba(255,255,255,0.12)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
          Foto {Math.min(step + 1, STEPS.length)} de {STEPS.length} — {currentStep.instruction}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
          {!modelsReady ? 'Carregando detector...' : currentStep.hint}
        </div>
      </div>

      <div style={{
        position: 'relative', background: '#000',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        aspectRatio: '4/3',
      }}>
        <video ref={videoRef} autoPlay muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -52%)',
          width: '54%', aspectRatio: '3/4',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.48)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `3px solid ${cfg.color}`,
            transition: 'border-color 0.2s, box-shadow 0.2s',
            ...(isReady ? { boxShadow: `0 0 20px ${cfg.color}80` } : {}),
          }} />
          {isReady && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 60, fontWeight: 800, lineHeight: 1,
                color: '#2a9d5c',
                textShadow: '0 2px 14px rgba(0,0,0,0.95)',
              }}>
                {secondsLeft}
              </span>
            </div>
          )}
        </div>

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '22px 12px 10px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.82), transparent)',
        }}>
          <div style={{
            textAlign: 'center', fontSize: 12, fontWeight: 500,
            color: cfg.color, marginBottom: isReady ? 6 : 0,
            transition: 'color 0.2s',
          }}>
            {cfg.text}
          </div>
          {isReady && (
            <div style={{ height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
              <div style={{
                height: '100%', borderRadius: 2, background: '#2a9d5c',
                width: `${progressPct}%`, transition: 'width 0.45s linear',
              }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{
            flex: 1, aspectRatio: '1', borderRadius: 6, overflow: 'hidden',
            background: 'rgba(255,255,255,0.05)',
            border: `0.5px solid ${
              i < photos.length ? 'rgba(42,157,92,0.55)'  :
              i === step        ? 'rgba(201,150,12,0.55)' :
                                  'rgba(255,255,255,0.08)'
            }`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {i < photos.length ? (
              <img src={`data:image/jpeg;base64,${photos[i]}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={s.label} />
            ) : (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 2 }}>
                {s.label}
              </span>
            )}
          </div>
        ))}
      </div>

      <button className="btn-ghost" onClick={onCancel} style={{ fontSize: 12, padding: '7px 0' }}>
        Cancelar
      </button>
    </div>
  )
}
