import L from 'leaflet'

// leaflet-rotate's dist build references a bare global `L` (no internal import),
// so it must be exposed on globalThis BEFORE the plugin module evaluates.
// This file is imported first by leafletRotateSetup.ts to guarantee that order.
;(globalThis as unknown as { L: typeof L }).L = L

export default L
