import { useState, useRef } from 'react'
import { Search, X, Navigation, MapPin, Bookmark, BookmarkCheck, Flag, Globe } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { openGoogleEarth } from '../googleEarth'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface Props {
  onClose: () => void
}

export default function SearchBar({ onClose }: Props) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setNavPreview = useMapStore((s) => s.setNavPreview)
  const setFlyTo      = useMapStore((s) => s.setFlyTo)
  const setSearchPin  = useMapStore((s) => s.setSearchPin)
  const addSpot       = useMapStore((s) => s.addSpot)
  const savedSpots    = useMapStore((s) => s.savedSpots)
  const addWaypoint   = useMapStore((s) => s.addWaypoint)
  const waypoints     = useMapStore((s) => s.waypoints)

  const search = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=no`
      const res = await fetch(url, { headers: { 'Accept-Language': 'no' } })
      setResults(await res.json())
    } catch { setResults([]) }
    setLoading(false)
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 400)
  }

  const selectResult = (r: NominatimResult, nav: boolean) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const name = r.display_name.split(',')[0]
    if (nav) setNavPreview({ lat, lng, name })
    else { setSearchPin({ lat, lng, name }); setFlyTo({ lat, lng }) }
    onClose()
  }

  const saveResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const name = r.display_name.split(',')[0]
    addSpot({ id: `search-${r.place_id}`, lat, lng, name })
  }

  const isSaved = (r: NominatimResult) =>
    savedSpots.some((s) => s.id === `search-${r.place_id}`)

  const addAsWaypoint = (r: NominatimResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon)
    const name = r.display_name.split(',')[0]
    addWaypoint({ id: `wp-search-${r.place_id}`, lat, lng, name })
  }

  const isWaypoint = (r: NominatimResult) =>
    waypoints.some((w) => w.id === `wp-search-${r.place_id}`)

  return (
    <div className="search-overlay">
      <div className="search-input-row">
        <Search size={17} className="search-icon-left" />
        <input
          autoFocus
          className="search-input"
          placeholder="Søk etter sted i Norge..."
          value={query}
          onChange={onChange}
        />
        {loading && <span className="search-spinner">↻</span>}
        <button className="search-close-btn" onClick={onClose}><X size={17} /></button>
      </div>
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.place_id} className="search-result-item">
              <span className="search-result-name">
                {r.display_name.split(',').slice(0, 2).join(', ')}
              </span>
              <div className="search-result-btns">
                <button title="Vis på kart" onClick={() => selectResult(r, false)}>
                  <MapPin size={15} />
                </button>
                <button title="Vis i Google Earth (3D)" style={{ background: '#065f46' }}
                  onClick={() => openGoogleEarth(parseFloat(r.lat), parseFloat(r.lon))}>
                  <Globe size={15} color="#34d399" />
                </button>
                <button
                  title={isSaved(r) ? 'Lagret' : 'Lagre sted'}
                  style={isSaved(r) ? { background: '#15803d' } : undefined}
                  onClick={() => { if (!isSaved(r)) saveResult(r) }}
                >
                  {isSaved(r) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                </button>
                <button
                  title={isWaypoint(r) ? 'Lagt til som waypoint' : 'Legg til som waypoint'}
                  style={isWaypoint(r) ? { background: '#7c3aed' } : undefined}
                  onClick={() => { if (!isWaypoint(r)) addAsWaypoint(r) }}
                >
                  <Flag size={15} />
                </button>
                <button title="Naviger hit" onClick={() => selectResult(r, true)}>
                  <Navigation size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
