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

// MOB alarm: loud SOS-pattern that repeats until stopMobAlarm() is called.
// AudioContext created inside user gesture (button click) → works on iOS.
let mobInterval: ReturnType<typeof setInterval> | null = null

function mobBurst() {
  // Three short + one long (SOS-ish)
  beep(880, 0.2, 1.0, 0.0)
  beep(880, 0.2, 1.0, 0.3)
  beep(880, 0.2, 1.0, 0.6)
  beep(660, 0.6, 1.0, 1.0)
  try { navigator.vibrate?.([200, 100, 200, 100, 200, 200, 600]) } catch { /* unsupported */ }
}

export function startMobAlarm() {
  if (mobInterval) return
  mobBurst()
  mobInterval = setInterval(mobBurst, 4000)
}

export function stopMobAlarm() {
  if (mobInterval) { clearInterval(mobInterval); mobInterval = null }
}
