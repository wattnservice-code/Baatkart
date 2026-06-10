import { useEffect } from 'react'

export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let lock: WakeLockSentinel | null = null

    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // System denied (e.g. battery saver) — fail silently
      }
    }

    // Re-acquire after the screen was unlocked / app foregrounded
    const onVisibility = () => {
      if (document.visibilityState === 'visible') request()
    }

    request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release().catch(() => {})
    }
  }, [])
}
