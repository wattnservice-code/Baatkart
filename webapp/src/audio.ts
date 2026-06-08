let ctx: AudioContext | null = null

export function unlockAudio() {
  if (ctx) {
    ctx.resume().catch(() => {})
    return
  }
  try {
    ctx = new AudioContext()
    ctx.resume().catch(() => {})
  } catch { /* not supported */ }
}

export function beep(freq = 660, duration = 0.6, volume = 0.5) {
  if (!ctx) {
    try { ctx = new AudioContext() } catch { return }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  try {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch { /* ignore */ }
}
