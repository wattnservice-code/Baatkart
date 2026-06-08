export interface TileCoord { z: number; x: number; y: number }
export interface Bounds { north: number; south: number; east: number; west: number }

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

export function tilesForBounds(bounds: Bounds, minZoom: number, maxZoom: number): TileCoord[] {
  const tiles: TileCoord[] = []
  for (let z = minZoom; z <= maxZoom; z++) {
    const x0 = lngToTileX(bounds.west, z)
    const x1 = lngToTileX(bounds.east, z)
    const y0 = latToTileY(bounds.north, z)
    const y1 = latToTileY(bounds.south, z)
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        tiles.push({ z, x, y })
      }
    }
  }
  return tiles
}

export function estimateCount(bounds: Bounds, minZoom: number, maxZoom: number): number {
  return tilesForBounds(bounds, minZoom, maxZoom).length
}

export function tileUrl(z: number, x: number, y: number, layer: 'sjokaart' | 'seamark'): string {
  if (layer === 'sjokaart') {
    return `https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/${z}/${y}/${x}.png`
  }
  return `https://tiles.openseamap.org/seamark/${z}/${x}/${y}.png`
}

export function tileKey(z: number, x: number, y: number, layer: 'sjokaart' | 'seamark'): string {
  return `${layer}/${z}/${x}/${y}`
}
