import { useEffect, useState } from 'react'
import { X, Download, Trash2, Map } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { saveTile, countTiles, clearAllTiles, estimateStorageMB, deleteTiles } from '../offline/tileDb'
import { tilesForBounds, estimateCount, tileUrl, tileKey, type Bounds } from '../offline/tileCalc'

interface OfflineArea {
  id: string
  name: string
  bounds: Bounds
  maxZoom: 13 | 15
  tileCount: number
  downloadedAt: string
}

const AREAS_KEY = 'baatkart-offline-areas'

function loadAreas(): OfflineArea[] {
  try { return JSON.parse(localStorage.getItem(AREAS_KEY) ?? '[]') } catch { return [] }
}

function saveAreas(areas: OfflineArea[]): void {
  localStorage.setItem(AREAS_KEY, JSON.stringify(areas))
}

interface Props { onClose: () => void }

type Status = 'idle' | 'downloading' | 'done' | 'error'

const MIN_ZOOM = 8
const CONCURRENCY = 4

export default function OfflinePanel({ onClose }: Props) {
  const mapBounds = useMapStore((s) => s.mapBounds)

  const [status, setStatus]               = useState<Status>('idle')
  const [progress, setProgress]           = useState(0)
  const [total, setTotal]                 = useState(0)
  const [storedCount, setStoredCount]     = useState(0)
  const [storageMB, setStorageMB]         = useState(0)
  const [error, setError]                 = useState<string | null>(null)
  const [maxZoom, setMaxZoom]             = useState<13 | 15>(13)
  const [areaName, setAreaName]           = useState('')
  const [areas, setAreas]                 = useState<OfflineArea[]>(loadAreas)

  useEffect(() => {
    countTiles().then(setStoredCount)
    estimateStorageMB().then(setStorageMB)
  }, [status])

  const bounds: Bounds | null = mapBounds
    ? { north: mapBounds.north, south: mapBounds.south, east: mapBounds.east, west: mapBounds.west }
    : null

  const estimated = bounds ? estimateCount(bounds, MIN_ZOOM, maxZoom) : 0

  const startDownload = async () => {
    if (!bounds) return
    const name = areaName.trim() || `Område ${new Date().toLocaleDateString('nb-NO')}`
    const tiles = tilesForBounds(bounds, MIN_ZOOM, maxZoom)
    const totalCount = tiles.length * 2
    setTotal(totalCount)
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
            if (res.ok) await saveTile(key, await res.blob())
          } catch { /* skip */ }
          done++
          setProgress(done)
        })
      }
    }

    let idx = 0
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (idx < allTasks.length) await allTasks[idx++]()
    })

    try {
      await Promise.all(workers)
      const newArea: OfflineArea = {
        id: Date.now().toString(),
        name,
        bounds,
        maxZoom,
        tileCount: totalCount,
        downloadedAt: new Date().toISOString(),
      }
      const updated = [...areas, newArea]
      saveAreas(updated)
      setAreas(updated)
      setAreaName('')
      setStatus('done')
    } catch {
      setStatus('error')
      setError('Nedlasting feilet')
    }
  }

  const handleDeleteArea = async (area: OfflineArea) => {
    const tiles = tilesForBounds(area.bounds, MIN_ZOOM, area.maxZoom)
    const keys: string[] = []
    for (const { z, x, y } of tiles) {
      for (const layer of ['sjokaart', 'seamark'] as const) {
        keys.push(tileKey(z, x, y, layer))
      }
    }
    await deleteTiles(keys)
    const updated = areas.filter((a) => a.id !== area.id)
    saveAreas(updated)
    setAreas(updated)
    countTiles().then(setStoredCount)
    estimateStorageMB().then(setStorageMB)
  }

  const handleClearAll = async () => {
    await clearAllTiles()
    saveAreas([])
    setAreas([])
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

      {/* Saved areas */}
      {areas.length > 0 && (
        <div className="offline-areas-list">
          <div className="offline-section-label">Lagrede områder</div>
          {areas.map((area) => (
            <div key={area.id} className="offline-area-row">
              <div className="offline-area-row-info">
                <span className="offline-area-row-name">{area.name}</span>
                <span className="offline-area-row-meta">
                  Zoom {MIN_ZOOM}–{area.maxZoom} · {area.tileCount.toLocaleString()} tiles
                  · {new Date(area.downloadedAt).toLocaleDateString('nb-NO')}
                </span>
              </div>
              <button className="offline-area-row-delete" onClick={() => handleDeleteArea(area)} title="Slett">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button className="offline-btn offline-btn-danger" onClick={handleClearAll} style={{ margin: '4px 12px 4px' }}>
            <Trash2 size={16} /> Slett alle
          </button>
        </div>
      )}

      {/* Download new area */}
      <div className="offline-area">
        <div className="offline-area-label">
          <Map size={14} /> Last ned synlig kartområde
        </div>
        {bounds ? (
          <div className="offline-area-coords">
            {bounds.north.toFixed(2)}°N – {bounds.south.toFixed(2)}°N &nbsp;|&nbsp;
            {bounds.west.toFixed(2)}°E – {bounds.east.toFixed(2)}°E
          </div>
        ) : (
          <div className="offline-area-coords">Ingen kartbounds</div>
        )}

        <input
          className="offline-name-input"
          type="text"
          placeholder="Navn på område (f.eks. Oslofjorden)"
          value={areaName}
          onChange={(e) => setAreaName(e.target.value)}
        />

        <div className="offline-zoom-choice">
          <button className={`offline-zoom-btn ${maxZoom === 13 ? 'offline-zoom-active' : ''}`} onClick={() => setMaxZoom(13)}>
            Oversikt<br/><span>Zoom 8–13 · raskere</span>
          </button>
          <button className={`offline-zoom-btn ${maxZoom === 15 ? 'offline-zoom-active' : ''}`} onClick={() => setMaxZoom(15)}>
            Detaljert<br/><span>Zoom 8–15 · bunnforhold</span>
          </button>
        </div>
        <div className="offline-estimate">
          Ca. {estimated.toLocaleString()} tiles
          {estimated > 30000 && <span className="offline-warn"> — stort område, kan ta tid</span>}
        </div>
      </div>

      {status === 'downloading' && (
        <div className="offline-progress">
          <div className="offline-progress-bar">
            <div className="offline-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span>{progress} / {total} ({pct}%)</span>
        </div>
      )}

      {status === 'done' && <div className="offline-done">✓ Nedlasting fullført</div>}
      {error && <div className="offline-error">{error}</div>}

      <div className="offline-actions">
        <button
          className="offline-btn offline-btn-primary"
          onClick={startDownload}
          disabled={!bounds || status === 'downloading' || estimated === 0}
        >
          <Download size={16} />
          {status === 'downloading' ? `Laster ned… ${pct}%` : 'Last ned'}
        </button>
      </div>

      <div className="offline-info">
        <span>{storedCount} tiles totalt</span>
        <span>{storageMB} MB brukt</span>
      </div>
    </div>
  )
}
