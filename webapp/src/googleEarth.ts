// Builds a Google Earth Web URL. The /search/<lat>,<lng> segment drops a
// visible pin at the coordinates; the /@... segment sets the camera in an
// angled 3D view (not flat top-down). Camera params: lat,lng,altitude(a),
// distance(d),fov(y),heading(h),tilt(t),roll(r). tilt ~60 = nice 3D angle.
export function googleEarthUrl(lat: number, lng: number): string {
  return `https://earth.google.com/web/search/${lat},${lng}/@${lat},${lng},0a,2500d,35y,0h,60t,0r`
}

// Open an external URL via a transient anchor. In a standalone PWA this hands
// the link to the system browser / native app and keeps the PWA intact, so
// returning to the app doesn't land on a blank leftover tab (unlike
// window.open, which spawns an empty window in the PWA's own stack).
function openExternal(url: string): void {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function openGoogleEarth(lat: number, lng: number): void {
  openExternal(googleEarthUrl(lat, lng))
}

// Official Google Maps URL API — reliably drops a visible pin on ALL devices
// (opens the Maps app on mobile, web on desktop). Satellite is one tap away.
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

export function openGoogleMaps(lat: number, lng: number): void {
  openExternal(googleMapsUrl(lat, lng))
}
