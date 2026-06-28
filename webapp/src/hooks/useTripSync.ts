import { useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { useMapStore } from '../store/useMapStore'
import { fetchTrips, pushMissing } from '../sync/tripSync'

// Ved innlogging: hent skyturer, flett inn lokalt, last opp lokale som mangler.
export function useTripSync(user: User | null) {
  const mergeRemoteTrips = useMapStore((s) => s.mergeRemoteTrips)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const remote = await fetchTrips()
      if (cancelled) return
      mergeRemoteTrips(remote)
      const remoteIds = new Set(remote.map((t) => t.id))
      await pushMissing(useMapStore.getState().savedTracks, remoteIds)
    })()
    return () => { cancelled = true }
  }, [user, mergeRemoteTrips])
}
