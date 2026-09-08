// Beep gerado via Web Audio API — sem asset de áudio pra carregar (o
// handoff não trouxe nenhum). Dois tons curtos, mais grave na virada pra
// descanso, mais agudo na virada pra foco — dá pra distinguir de ouvido
// sem olhar pra tela.
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

export function playPhaseChangeBeep(nextPhase: 'focus' | 'rest') {
  const audioCtx = getCtx()
  if (!audioCtx) return
  const freq = nextPhase === 'focus' ? 880 : 587
  const now = audioCtx.currentTime
  ;[0, 0.18].forEach((offset) => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, now + offset)
    gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.02)
    gain.gain.linearRampToValueAtTime(0, now + offset + 0.15)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(now + offset)
    osc.stop(now + offset + 0.16)
  })
}
