import type L from 'leaflet'

let _map: L.Map | null = null
export const setMapInstance = (m: L.Map | null) => { _map = m }
export const getMapInstance = () => _map
