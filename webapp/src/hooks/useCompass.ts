import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

const ALPHA = 0.05       // sterkere utjevning mot støy
const DEAD_ZONE = 0.8    // ignorer endringer under 0.8 grader

export function useCompass(enabled: boolean) {
  const setCompassHeading = useMapStore((s) => s.setCompassHeading)
  const smoothedRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      useMapStore.getState().setCompassHeading(NaN)
      smoothedRef.current = null
      return
    }

    let usingAbsolute = false

    const handler = (e: DeviceOrientationEvent, absolute: boolean) => {
      // Foretrekk absolutt-eventet — ignorer relativ dersom absolutt allerede funker
      if (!absolute && usingAbsolute) return
      if (absolute) usingAbsolute = true

      const raw = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
        ?? (e.alpha !== null ? (360 - e.alpha) % 360 : null)
      if (raw === null) return

      if (smoothedRef.current === null) {
        smoothedRef.current = raw
      } else {
        let diff = raw - smoothedRef.current
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
        if (Math.abs(diff) < DEAD_ZONE) return   // ignorer mikroskopiske endringer
        smoothedRef.current = (smoothedRef.current + ALPHA * diff + 360) % 360
      }

      setCompassHeading(smoothedRef.current)
    }

    const absHandler = (e: Event) => handler(e as DeviceOrientationEvent, true)
    const relHandler = (e: Event) => handler(e as DeviceOrientationEvent, false)

    window.addEventListener('deviceorientationabsolute', absHandler, true)
    window.addEventListener('deviceorientation', relHandler, true)

    return () => {
      window.removeEventListener('deviceorientationabsolute', absHandler, true)
      window.removeEventListener('deviceorientation', relHandler, true)
      smoothedRef.current = null
    }
  }, [enabled, setCompassHeading])
}
