// Shared module-level variable so MapView's rAF loop can feed the smoothed
// bearing to MapControls' compass rose without going through React state.
let _bearing = 0
export const getCurrentBearing = () => _bearing
export const setCurrentBearing = (b: number) => { _bearing = b }
