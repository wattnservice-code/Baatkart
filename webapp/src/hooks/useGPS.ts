import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

const ALPHA = 0.25               // EMA for position
const MIN_SPEED = 0.8            // m/s below this = show 0
const MAX_SPEED_ACCURACY = 20    // m — only trust speed when GPS is this accurate or better

// Adaptive EMA: slow response (heavy smoothing) when near-stationary,
// fast response at speed. Ramps from 0.10 at 0 m/s to 0.40 at 5 m/s (~10 kn).
function speedAlpha(smoothedMs: number): number {
  return 0.10 + Math.min(1, smoothedMs / 5) * 0.30
}

export function useGPS() {
  const setPosition = useMapStore((s) => s.setPosition)
  const smoothed = useRef<{ lat: number; lng: number } | null>(null)
  const smoothedSpeed = useRef<number>(0)
  const lastHeading = useRef<number>(0)
  const lastPos = useRef<{ lat: number; lng: number; timestamp: number } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords
        const timestamp = pos.timestamp

        // Skip updates with poor accuracy (> 50m)
        if (accuracy > 50) return

        // Exponential moving average to reduce jitter
        if (!smoothed.current) {
          smoothed.current = { lat, lng }
        } else {
          smoothed.current = {
            lat: ALPHA * lat + (1 - ALPHA) * smoothed.current.lat,
            lng: ALPHA * lng + (1 - ALPHA) * smoothed.current.lng,
          }
        }

        // Only trust speed when GPS is accurate — indoor noise typically gives accuracy > 20m
        const rawSpeed = accuracy <= MAX_SPEED_ACCURACY ? (speed ?? 0) : 0
        const alpha = speedAlpha(smoothedSpeed.current)
        smoothedSpeed.current = alpha * rawSpeed + (1 - alpha) * smoothedSpeed.current
        const filteredSpeed = smoothedSpeed.current < MIN_SPEED ? 0 : smoothedSpeed.current

        // Only update heading when moving — freeze arrow when stationary
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

        setPosition({
          lat: smoothed.current.lat,
          lng: smoothed.current.lng,
          speed: filteredSpeed,
          heading: lastHeading.current,
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
