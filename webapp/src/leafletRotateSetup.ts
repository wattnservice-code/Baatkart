// Order matters: leafletGlobal sets globalThis.L, THEN the plugin patches it.
import './leafletGlobal'
// @ts-ignore — untyped side-effect import; the plugin patches L.Map in place
import 'leaflet-rotate/dist/leaflet-rotate-src.js'

declare module 'leaflet' {
  interface Map {
    setBearing(bearing: number): this
    getBearing(): number
    rotateTo(bearing: number, options?: { animate?: boolean; duration?: number }): this
  }
  interface MapOptions {
    rotate?: boolean
    bearing?: number
    rotateControl?: boolean | object
    touchRotate?: boolean | string
    shiftKeyRotate?: boolean
  }
  interface MarkerOptions {
    rotation?: number
    rotateWithView?: boolean
  }
}
