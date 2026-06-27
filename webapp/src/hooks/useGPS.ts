import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

const ALPHA = 0.25
const MIN_SPEED = 0.8
const MAX_SPEED_ACCURACY = 20

function speedAlpha(smoothedMs: number): number {
  return 0.10 + Math.min(1, smoothedMs / 5) * 0.30
}

export function useGPS() {
  const setPosition   = useMapStore((s) => s.setPosition)
  const smoothed      = useRef<{ lat: number; lng: number } | null>(null)
  const smoothedSpeed = useRef<number>(0)
  const lastHeading   = useRef<number>(0)
  const lastPos       = useRef<{ lat: number; lng: number; timestamp: number } | null>(null)

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

        // When stationary and compass feature is active, use compass heading
        const compassHdg = useMapStore.getState().compassHeading
        const heading = filteredSpeed === 0 && compassHdg != null && !isNaN(compassHdg)
          ? compassHdg
          : lastHeading.current

        setPosition({
          lat: smoothed.current.lat,
          lng: smoothed.current.lng,
          speed: filteredSpeed,
          heading,
          accuracy,
          timestamp,
        })
        localStorage.setItem('lastPos', JSON.stringify({ lat: smoothed.current.lat, lng: smoothed.current.lng }))
      },
      (err) => console.warn('GPS-feil:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [setPosition])
}
