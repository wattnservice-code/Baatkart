// Builds a Google Earth Web URL that opens in an angled 3D view (not flat
// top-down). URL params after @: lat,lng,altitude(a),distance(d),fov(y),
// heading(h),tilt(t),roll(r). tilt 0 = straight down, ~60 = nice 3D angle.
export function googleEarthUrl(lat: number, lng: number): string {
  return `https://earth.google.com/web/@${lat},${lng},0a,2500d,35y,0h,60t,0r`
}

export function openGoogleEarth(lat: number, lng: number): void {
  window.open(googleEarthUrl(lat, lng), '_blank', 'noopener')
}
