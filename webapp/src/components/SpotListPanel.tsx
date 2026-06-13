import { useState, useRef } from 'react'
import { X, Trash2, Navigation, LocateFixed, MapPin, Globe, Bookmark, BookmarkCheck } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { useOnline } from '../hooks/useOnline'
import { openGoogleEarth } from '../googleEarth'
import { iconEmoji } from '../spotIcons'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface Props {
  onClose: () => void
  onAddGps?: () => void
  onAddMap?: () => void
}

export default function SpotListPanel({ onClose, onAddGps, onAddMap }: Props) {
  const savedSpots    = useMapStore((s) => s.savedSpots)
  const position      = useMapStore((s) => s.position)
  const removeSpot    = useMapStore((s) => s.removeSpot)
  const addSpot       = useMapStore((s) => s.addSpot)
  const setFlyTo      = useMapStore((s) => s.setFlyTo)
  const setSearchPin  = useMapStore((s) => s.setSearchPin)
  const setNavPreview = useMapStore((s) => s.setNavPreview)
  const activeSpotId  = useMapStore((s) => s.activeSpotId)
  const setActiveSpot = useMapStore((s) => s.setActiveSpot)

  const isOnline = useOnline()

  const [query, setQuery]         = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [results, setResults]     = useState<NominatimResult[]>([])
  const [loading, setLoading]     = useState(false)
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered = savedSpots.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  )
  const confirmSpot = savedSpots.find((s) => s.id === confirmId)

  // Online geocoding (Nominatim) — runs as you type, when online
  const searchWeb = async (q: string) => {
    if (!isOnline || q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=no`
      const res = await fetch(url, { headers: { 'Accept-Language': 'no' } })
      setResults(await res.json())
    } catch { setResults([]) }
    setLoading(false)
  }

  const onQueryChange = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchWeb(q), 400)
  }

  // Saved-spot actions
  const goToSpot = (id: string, lat: number, lng: number) => { setActiveSpot(id); setFlyTo({ lat, lng }); onClose() }
  const navSpot  = (lat: number, lng: number, name: string) => { setNavPreview({ lat, lng, name }); onClose() }
  const handleAddGps = () => { onClose(); onAddGps?.() }
  const handleAddMap = () => { onClose(); onAddMap?.() }

  // Web-result actions
  const webName  = (r: NominatimResult) => r.display_name.split(',')[0]
  const showWeb  = (r: NominatimResult) => { setSearchPin({ lat: +r.lat, lng: +r.lon, name: webName(r) }); setFlyTo({ lat: +r.lat, lng: +r.lon }); onClose() }
  const navWeb   = (r: NominatimResult) => { setNavPreview({ lat: +r.lat, lng: +r.lon, name: webName(r) }); onClose() }
  const saveWeb  = (r: NominatimResult) => addSpot({ id: `search-${r.place_id}`, lat: +r.lat, lng: +r.lon, name: webName(r) })
  const isSaved  = (r: NominatimResult) => savedSpots.some((s) => s.id === `search-${r.place_id}`)

  const searching = query.trim().length >= 2

  return (
    <>
      <div className="settings-sheet">
        <div className="settings-head">
          <span className="settings-title">Steder</span>
          <button className="settings-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="settings-body">
          {/* Quick add */}
          <div className="spots-actions">
            <button className="spots-action-btn" onClick={handleAddGps} disabled={!position}>
              <LocateFixed size={20} />
              <span>Min posisjon</span>
            </button>
            <button className="spots-action-btn" onClick={handleAddMap}>
              <MapPin size={20} />
              <span>Velg på kartet</span>
            </button>
          </div>

          {/* One search box — filters saved spots and searches the web */}
          <div className="spots-search">
            <input
              className="spot-panel-search-input"
              placeholder="Søk i steder eller adresse…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>

          {/* Saved spots */}
          <div className="spot-section-head">Mine steder</div>
          {filtered.length === 0 && (
            <div className="spot-panel-empty">
              {savedSpots.length === 0 ? 'Ingen steder lagret ennå' : 'Ingen treff'}
            </div>
          )}
          {filtered.map((spot) => (
            <div
              key={spot.id}
              className={`spot-panel-item ${activeSpotId === spot.id ? 'spot-panel-item-active' : ''}`}
              onClick={() => goToSpot(spot.id, spot.lat, spot.lng)}
            >
              <div className="spot-panel-info">
                <span className="spot-panel-name">{iconEmoji(spot.icon)} {spot.name}</span>
                <span className="spot-panel-coords">{spot.lat.toFixed(4)}°N {spot.lng.toFixed(4)}°E</span>
              </div>
              <div className="spot-panel-actions" onClick={(e) => e.stopPropagation()}>
                <button className="spot-panel-btn spot-panel-nav" onClick={() => navSpot(spot.lat, spot.lng, spot.name)} title="Naviger hit">
                  <Navigation size={15} />
                </button>
                {isOnline && (
                  <button className="spot-panel-btn" style={{ background: '#065f46' }}
                    onClick={() => openGoogleEarth(spot.lat, spot.lng)}
                    title="Vis i Google Earth">
                    <Globe size={15} color="#34d399" />
                  </button>
                )}
                <button className="spot-panel-btn spot-panel-delete" onClick={() => setConfirmId(spot.id)} title="Slett">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {/* Web search results — only while searching */}
          {searching && (
            <>
              <div className="spot-section-head">
                Søk på nett {loading && <span className="search-spinner">↻</span>}
              </div>
              {!isOnline && (
                <div className="spot-panel-empty">Krever nettilgang</div>
              )}
              {isOnline && results.length === 0 && !loading && (
                <div className="spot-panel-empty">Ingen treff på nett</div>
              )}
              {results.map((r) => (
                <div key={r.place_id} className="spot-panel-item" onClick={() => showWeb(r)}>
                  <div className="spot-panel-info">
                    <span className="spot-panel-name">🔍 {webName(r)}</span>
                    <span className="spot-panel-coords">{r.display_name.split(',').slice(1, 3).join(', ').trim()}</span>
                  </div>
                  <div className="spot-panel-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="spot-panel-btn spot-panel-nav" onClick={() => navWeb(r)} title="Naviger hit">
                      <Navigation size={15} />
                    </button>
                    <button className="spot-panel-btn" style={{ background: '#065f46' }}
                      onClick={() => openGoogleEarth(+r.lat, +r.lon)} title="Vis i Google Earth">
                      <Globe size={15} color="#34d399" />
                    </button>
                    <button
                      className="spot-panel-btn"
                      style={isSaved(r) ? { background: '#15803d' } : undefined}
                      onClick={() => { if (!isSaved(r)) saveWeb(r) }}
                      title={isSaved(r) ? 'Lagret' : 'Lagre sted'}
                    >
                      {isSaved(r) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {confirmSpot && (
        <div className="dialog-overlay" onClick={() => setConfirmId(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Slett sted</div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Slette <strong style={{ color: 'white' }}>"{confirmSpot.name}"</strong>?
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmId(null)}>Avbryt</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => { removeSpot(confirmSpot.id); setConfirmId(null) }}>
                <Trash2 size={15} /> Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
