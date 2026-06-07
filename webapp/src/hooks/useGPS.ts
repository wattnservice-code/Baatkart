import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

const ALPHA = 0.25 // EMA smoothing — lower = smoother, higher = more responsive

export function useGPS() {
  const setPosition = useMapStore((s) => s.setPosition)
  const smoothed = useRef<{ lat: number; lng: number } | null>(null)
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

        // Heading from device if available, otherwise calculate from movement
        let heading = pos.coords.heading ?? 0
        if ((pos.coords.heading === null || pos.coords.heading === undefined) && lastPos.current) {
          const dlat = lat - lastPos.current.lat
          const dlng = lng - lastPos.current.lng
          const dist = Math.sqrt(dlat * dlat + dlng * dlng)
          // Only update heading if moved enough to be meaningful
          if (dist > 0.00005) {
            heading = (Math.atan2(dlng, dlat) * 180) / Math.PI
            if (heading < 0) heading += 360
          } else if (lastPos.current) {
            heading = 0
          }
        }

        lastPos.current = { lat, lng, timestamp }

        setPosition({
          lat: smoothed.current.lat,
          lng: smoothed.current.lng,
          speed: speed ?? 0,
          heading,
          accuracy,
          timestamp,
        })
      },
      (err) => console.warn('GPS-feil:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [setPosition])
}
