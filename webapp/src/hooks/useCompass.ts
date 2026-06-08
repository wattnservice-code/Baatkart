import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

const ALPHA = 0.08 // heavy smoothing — lower = smoother

export function useCompass(enabled: boolean) {
  const setHeading = useMapStore((s) => s.setHeading)
  const smoothedRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handler = (e: DeviceOrientationEvent) => {
      const raw = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
        ?? (e.alpha !== null ? (360 - e.alpha) % 360 : null)
      if (raw === null) return

      if (smoothedRef.current === null) {
        smoothedRef.current = raw
      } else {
        // Shortest-path interpolation (handles 359° → 1° correctly)
        let diff = raw - smoothedRef.current
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
        smoothedRef.current = (smoothedRef.current + ALPHA * diff + 360) % 360
      }

      setHeading(smoothedRef.current)
    }

    const listen = async () => {
      const DevOr = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (typeof DevOr.requestPermission === 'function') {
        const perm = await DevOr.requestPermission()
        if (perm !== 'granted') return
      }
      window.addEventListener('deviceorientationabsolute', handler as EventListener, true)
      window.addEventListener('deviceorientation', handler as EventListener, true)
    }

    listen()
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true)
      window.removeEventListener('deviceorientation', handler as EventListener, true)
      smoothedRef.current = null
    }
  }, [enabled, setHeading])
}
