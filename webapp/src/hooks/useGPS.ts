import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

const ALPHA = 0.25               // EMA for position
const MIN_SPEED = 0.8            // m/s below this = show 0
const MAX_SPEED_ACCURACY = 20    // m — only trust speed when GPS is this accurate or better

function speedAlpha(smoothedMs: number): number {
  return 0.10 + Math.min(1, smoothedMs / 5) * 0.30
}

export function useGPS() {
  const setPosition     = useMapStore((s) => s.setPosition)
  const smoothed        = useRef<{ lat: number; lng: number } | null>(null)
  const smoothedSpeed   = useRef<number>(0)
  const lastHeading     = useRef<number>(0)
  const lastPos         = useRef<{ lat: number; lng: number; timestamp: number } | null>(null)
  const passiveHeading  = useRef<number | null>(null)

  // Passively read device orientation regardless of compass toggle —
  // used only as stationary fallback for the boat arrow direction.
  useEffect(() => {
    let usingAbsolute = false
    const handler = (e: Event, absolute: boolean) => {
      if (!absolute && usingAbsolute) return
      if (absolute) usingAbsolute = true
      const ev = e as DeviceOrientationEvent & { webkitCompassHeading?: number }
      const raw = ev.webkitCompassHeading ?? (ev.alpha !== null ? (360 - ev.alpha) % 360 : null)
      if (raw !== null) passiveHeading.current = raw
    }
    const absH = (e: Event) => handler(e, true)
    const relH = (e: Event) => handler(e, false)
    window.addEventListener('deviceorientationabsolute', absH, true)
    window.addEventListener('deviceorientation', relH, true)
    return () => {
      window.removeEventListener('deviceorientationabsolute', absH, true)
      window.removeEventListener('deviceorientation', relH, true)
    }
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords
        const timestamp = pos.timestamp

        if (accuracy > 50) return

        if (!smoothed.current) {
          smoothed.current = { lat, lng }
        } else {
          smoothed.current = {
            lat: ALPHA * lat + (1 - ALPHA) * smoothed.current.lat,
            lng: ALPHA * lng + (1 - ALPHA) * smoothed.current.lng,
          }
        }

        const rawSpeed = accuracy <= MAX_SPEED_ACCURACY ? (speed ?? 0) : 0
        const alpha = speedAlpha(smoothedSpeed.current)
        smoothedSpeed.current = alpha * rawSpeed + (1 - alpha) * smoothedSpeed.current
        const filteredSpeed = smoothedSpeed.current < MIN_SPEED ? 0 : smoothedSpeed.current

        if (filteredSpeed > 0) {
          if (pos.coords.heading != null && !isNaN(pos.coords.heading)) {
            lastHeading.current = pos.coords.heading
          } else if (lastPos.current) {
            const dlat = lat - lastPos.current.lat
            const dlng = lng - lastPos.current.lng
            if (Math.sqrt(dlat * dlat + dlng * dlng) > 0.00005) {
              let h = (Math.atan2(dlng, dlat) * 180) / Math.PI
              if (h < 0) h += 360
              lastHeading.current = h
            }
          }
        }

        lastPos.current = { lat, lng, timestamp }

        // Stationary heading priority:
        // 1. Compass feature heading (smoothed, from store)
        // 2. Passive sensor reading (raw, always available)
        // 3. Last known GPS course
        let heading = lastHeading.current
        if (filteredSpeed === 0) {
          const compassHdg = useMapStore.getState().compassHeading
          if (compassHdg != null && !isNaN(compassHdg)) {
            heading = compassHdg
          } else if (passiveHeading.current !== null) {
            heading = passiveHeading.current
          }
        }

        setPosition({
          lat: smoothed.current.lat,
          lng: smoothed.current.lng,
          speed: filteredSpeed,
          heading,
          accuracy,
          timestamp,
        })
      },
      (err) => console.warn('GPS-feil:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [setPosition])
}
