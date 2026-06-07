import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

export function useGPS() {
  const setPosition = useMapStore((s) => s.setPosition)
  const lastPos = useRef<{ lat: number; lng: number; timestamp: number } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords
        const timestamp = pos.timestamp

        let heading = 0
        if (lastPos.current) {
          const dlat = lat - lastPos.current.lat
          const dlng = lng - lastPos.current.lng
          heading = (Math.atan2(dlng, dlat) * 180) / Math.PI
          if (heading < 0) heading += 360
        }

        lastPos.current = { lat, lng, timestamp }

        setPosition({
          lat,
          lng,
          speed: speed ?? 0,
          heading: pos.coords.heading ?? heading,
          accuracy,
          timestamp,
        })
      },
      (err) => console.warn('GPS-feil:', err.message),
      { enableHighAccuracy: true, maximumAge: 1000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [setPosition])
}
