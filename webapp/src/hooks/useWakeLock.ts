import { useEffect } from 'react'

export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let lock: WakeLockSentinel | null = null
    let released = false

    const request = async () => {
      if (released) return
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => {
          // Re-acquire if the system released it and we're still visible
          if (!released && document.visibilityState === 'visible') request()
        })
      } catch {
        // Battery saver or system denial — fail silently
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') request()
    }

    request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release().catch(() => {})
    }
  }, [])
}
