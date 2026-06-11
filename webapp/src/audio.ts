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

export function beep(freq = 660, duration = 0.6, volume = 0.5, when = 0) {
  if (!ctx) {
    try { ctx = new AudioContext() } catch { return }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  try {
    const t0   = ctx.currentTime + when
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
    osc.start(t0)
    osc.stop(t0 + duration)
  } catch { /* ignore */ }
}

// Urgent collision alert: two sharp high beeps + phone vibration.
export function collisionAlarm() {
  beep(880, 0.18, 0.6, 0)
  beep(880, 0.18, 0.6, 0.28)
  try { navigator.vibrate?.([180, 90, 180]) } catch { /* unsupported */ }
}
