// Builds a Google Earth Web URL. The /search/<lat>,<lng> segment drops a
// visible pin at the coordinates; the /@... segment sets the camera in an
// angled 3D view (not flat top-down). Camera params: lat,lng,altitude(a),
// distance(d),fov(y),heading(h),tilt(t),roll(r). tilt ~60 = nice 3D angle.
export function googleEarthUrl(lat: number, lng: number): string {
  return `https://earth.google.com/web/search/${lat},${lng}/@${lat},${lng},0a,2500d,35y,0h,60t,0r`
}

export function openGoogleEarth(lat: number, lng: number): void {
  window.open(googleEarthUrl(lat, lng), '_blank', 'noopener')
}
