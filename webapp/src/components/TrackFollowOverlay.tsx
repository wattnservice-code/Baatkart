import { useMemo } from 'react'
import { useMapStore } from '../store/useMapStore'
import type { SavedTrack } from '../store/useMapStore'
import { formatDist } from './NavOverlay'

const R = 6371000

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingRad(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  return Math.atan2(
    Math.sin(Δλ) * Math.cos(φ2),
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  )
}

// Project pos onto segment A-B and return the fraction t ∈ [0,1] along the segment
function projT(pLat: number, pLng: number, aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dx = bLng - aLng, dy = bLat - aLat
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return 0
  return Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / len2))
}

interface XTEResult {
  xte: number       // meters, + = right of track, − = left
  distToEnd: number // meters remaining to last track point
}

function calcXTE(pos: { lat: number; lng: number }, track: SavedTrack): XTEResult | null {
  const pts = track.points
  if (pts.length < 2) return null

  // Find nearest segment by projecting pos onto each and taking minimum distance
  let bestSeg = 0
  let bestDist = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1]
    const t = projT(pos.lat, pos.lng, A.lat, A.lng, B.lat, B.lng)
    const nLat = A.lat + t * (B.lat - A.lat)
    const nLng = A.lng + t * (B.lng - A.lng)
    const d = haversineM(pos.lat, pos.lng, nLat, nLng)
    if (d < bestDist) { bestDist = d; bestSeg = i }
  }

  const A = pts[bestSeg], B = pts[bestSeg + 1]

  // Spherical cross-track distance
  const d13 = haversineM(A.lat, A.lng, pos.lat, pos.lng) / R
  const θ13 = bearingRad(A.lat, A.lng, pos.lat, pos.lng)
  const θ12 = bearingRad(A.lat, A.lng, B.lat, B.lng)
  const xte = Math.asin(Math.max(-1, Math.min(1, Math.sin(d13) * Math.sin(θ13 - θ12)))) * R

  // Along-track distance (how far along segment A-B we are)
  const xteRad = xte / R
  const cosXte = Math.cos(xteRad)
  const atd = cosXte === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, Math.cos(d13) / cosXte))) * R
  const segLen = haversineM(A.lat, A.lng, B.lat, B.lng)
  let distToEnd = Math.max(0, segLen - atd)
  for (let i = bestSeg + 1; i < pts.length - 1; i++) {
    distToEnd += haversineM(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng)
  }

  return { xte, distToEnd }
}

export default function TrackFollowOverlay() {
  const followingTrack     = useMapStore((s) => s.followingTrack)
  const position           = useMapStore((s) => s.position)
  const distUnit           = useMapStore((s) => s.distUnit)
  const stopFollowingTrack = useMapStore((s) => s.stopFollowingTrack)

  const result = useMemo(() => {
    if (!followingTrack || !position) return null
    return calcXTE(position, followingTrack)
  }, [followingTrack, position])

  if (!followingTrack) return null

  const xteAbs = result ? Math.abs(result.xte) : null
  const side   = result ? (result.xte < -1 ? '←' : result.xte > 1 ? '→' : null) : null
  const xteColor = xteAbs === null ? '#64748b'
    : xteAbs < 25  ? '#22c55e'
    : xteAbs < 100 ? '#f59e0b'
    : '#ef4444'

  return (
    <div className="track-follow-overlay">
      <div className="track-follow-name">⬡ {followingTrack.name}</div>
      <div className="track-follow-stats">
        <span className="track-follow-xte" style={{ color: xteColor }}>
          {result === null
            ? 'Beregner…'
            : xteAbs! < 15
            ? '● På sporet'
            : `${side} ${formatDist(xteAbs!, distUnit)} avvik`}
        </span>
        {result && (
          <span className="track-follow-dist">
            {formatDist(result.distToEnd, distUnit)} igjen
          </span>
        )}
      </div>
      <button className="track-follow-stop" onClick={stopFollowingTrack}>Stopp ✕</button>
    </div>
  )
}
