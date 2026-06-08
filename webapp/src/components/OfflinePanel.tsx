import { useEffect, useState } from 'react'
import { X, Download, Trash2, Map } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { saveTile, countTiles, clearAllTiles, estimateStorageMB } from '../offline/tileDb'
import { tilesForBounds, estimateCount, tileUrl, tileKey, type Bounds } from '../offline/tileCalc'

interface Props { onClose: () => void }

type Status = 'idle' | 'selecting' | 'downloading' | 'done' | 'error'

const MIN_ZOOM = 8
const MAX_ZOOM = 13
const CONCURRENCY = 4

export default function OfflinePanel({ onClose }: Props) {
  const mapBounds   = useMapStore((s) => s.mapBounds)

  const [status, setStatus]     = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [total, setTotal]       = useState(0)
  const [storedCount, setStoredCount] = useState(0)
  const [storageMB, setStorageMB]     = useState(0)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    countTiles().then(setStoredCount)
    estimateStorageMB().then(setStorageMB)
  }, [status])

  const bounds: Bounds | null = mapBounds
    ? { north: mapBounds.north, south: mapBounds.south, east: mapBounds.east, west: mapBounds.west }
    : null

  const estimated = bounds ? estimateCount(bounds, MIN_ZOOM, MAX_ZOOM) : 0

  const startDownload = async () => {
    if (!bounds) return
    const tiles = tilesForBounds(bounds, MIN_ZOOM, MAX_ZOOM)
    setTotal(tiles.length * 2) // sjokaart + seamark
    setProgress(0)
    setStatus('downloading')
    setError(null)

    let done = 0
    const allTasks: (() => Promise<void>)[] = []

    for (const { z, x, y } of tiles) {
      for (const layer of ['sjokaart', 'seamark'] as const) {
        const key = tileKey(z, x, y, layer)
        const url = tileUrl(z, x, y, layer)
        allTasks.push(async () => {
          try {
            const res = await fetch(url, { mode: 'cors' })
            if (res.ok) {
              const blob = await res.blob()
              await saveTile(key, blob)
            }
          } catch { /* skip failed tiles */ }
          done++
          setProgress(done)
        })
      }
    }

    // Run with limited concurrency
    let idx = 0
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (idx < allTasks.length) {
        await allTasks[idx++]()
      }
    })

    try {
      await Promise.all(workers)
      setStatus('done')
    } catch {
      setStatus('error')
      setError('Nedlasting feilet')
    }
  }

  const handleClear = async () => {
    await clearAllTiles()
    setStoredCount(0)
    setStorageMB(0)
    setStatus('idle')
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0

  return (
    <div className="offline-panel">
      <div className="spot-panel-header">
        <span>Offline kart</span>
        <button onClick={onClose}><X size={18} /></button>
      </div>

      {/* Storage info */}
      <div className="offline-info">
        <span>{storedCount} tiles lagret</span>
        <span>{storageMB} MB brukt</span>
      </div>

      {/* Current map bounds */}
      <div className="offline-area">
        <div className="offline-area-label">
          <Map size={14} /> Synlig kartområde
        </div>
        {bounds ? (
          <div className="offline-area-coords">
            {bounds.north.toFixed(2)}°N – {bounds.south.toFixed(2)}°N &nbsp;|&nbsp;
            {bounds.west.toFixed(2)}°E – {bounds.east.toFixed(2)}°E
          </div>
        ) : (
          <div className="offline-area-coords">Ingen kartbounds</div>
        )}
        <div className="offline-estimate">
          Zoom {MIN_ZOOM}–{MAX_ZOOM} → ca. {estimated.toLocaleString()} tiles
          {estimated > 20000 && <span className="offline-warn"> (stort område!)</span>}
        </div>
      </div>

      {/* Progress */}
      {status === 'downloading' && (
        <div className="offline-progress">
          <div className="offline-progress-bar">
            <div className="offline-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span>{progress} / {total} ({pct}%)</span>
        </div>
      )}

      {status === 'done' && (
        <div className="offline-done">✓ Nedlasting fullført</div>
      )}

      {error && <div className="offline-error">{error}</div>}

      {/* Actions */}
      <div className="offline-actions">
        <button
          className="offline-btn offline-btn-primary"
          onClick={startDownload}
          disabled={!bounds || status === 'downloading' || estimated === 0}
        >
          <Download size={16} />
          {status === 'downloading' ? 'Laster ned…' : 'Last ned synlig område'}
        </button>
        {storedCount > 0 && (
          <button className="offline-btn offline-btn-danger" onClick={handleClear}>
            <Trash2 size={16} /> Slett alle offline-kart
          </button>
        )}
      </div>
    </div>
  )
}
