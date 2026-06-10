import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

const ALPHA = 0.08

export function useCompass(enabled: boolean) {
  const setCompassHeading = useMapStore((s) => s.setCompassHeading)
  const smoothedRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      useMapStore.getState().setCompassHeading(NaN) // signal "disabled"
      smoothedRef.current = null
      return
    }

    const handler = (e: DeviceOrientationEvent) => {
      const raw = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
        ?? (e.alpha !== null ? (360 - e.alpha) % 360 : null)
      if (raw === null) return

      if (smoothedRef.current === null) {
        smoothedRef.current = raw
      } else {
        let diff = raw - smoothedRef.current
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
        smoothedRef.current = (smoothedRef.current + ALPHA * diff + 360) % 360
      }

      setCompassHeading(smoothedRef.current)
    }

    // Permission must already have been granted by the UI button (user gesture).
    // Just attach listeners here — no requestPermission call needed.
    window.addEventListener('deviceorientationabsolute', handler as EventListener, true)
    window.addEventListener('deviceorientation', handler as EventListener, true)
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true)
      window.removeEventListener('deviceorientation', handler as EventListener, true)
      smoothedRef.current = null
    }
  }, [enabled, setCompassHeading])
}
