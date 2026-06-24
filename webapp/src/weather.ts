// Shared MET Norway (Yr) weather + ocean fetching and symbol mapping.
// Previously duplicated between WeatherOverlay and MapControls.
import type { SeriesPoint } from './components/forecastCharts'

const MET_HEADERS = { 'User-Agent': 'BaatKart/1.0 frode.sighaug@gmail.com' }

export interface WxPoint { windSpeed: number; windDir: number; temp: number; symbol: string }
export interface WavePoint { height: number; dir: number; seaTemp?: number }

// MET symbol_code → emoji.
export function wxEmoji(code: string): string {
  if (!code) return ''
  if (code.includes('thunder'))      return '⛈️'
  if (code.includes('snow'))         return '❄️'
  if (code.includes('sleet'))        return '🌨️'
  if (code.includes('lightrain') || code.includes('drizzle')) return '🌦️'
  if (code.includes('rain'))         return '🌧️'
  if (code.includes('fog'))          return '🌫️'
  if (code.startsWith('clearsky'))   return '☀️'
  if (code.startsWith('fair'))       return '🌤️'
  if (code.includes('partlycloudy')) return '⛅'
  if (code.includes('cloudy'))       return '☁️'
  return '🌡️'
}

// Wind/temp forecast at a point. Throws on network/parse error.
export async function fetchWeather(lat: number, lng: number): Promise<{ wx: WxPoint; windSeries: SeriesPoint[] }> {
  const res = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`,
    { headers: MET_HEADERS }
  )
  const data = await res.json()
  const series = data.properties.timeseries
  const ts0 = series[0].data
  const d = ts0.instant.details
  const symbol = ts0.next_1_hours?.summary?.symbol_code ?? ts0.next_6_hours?.summary?.symbol_code ?? ''
  const wx: WxPoint = { windSpeed: d.wind_speed, windDir: d.wind_from_direction, temp: d.air_temperature, symbol }
  const windSeries: SeriesPoint[] = series.slice(0, 8).map((p: any, i: number) => ({ hour: i, v: p.data.instant.details.wind_speed }))
  return { wx, windSeries }
}

// Wave/sea-temp forecast at a point. Returns null outside coastal coverage.
export async function fetchOcean(lat: number, lng: number): Promise<{ wave: WavePoint; waveSeries: SeriesPoint[] } | null> {
  const res = await fetch(
    `https://api.met.no/weatherapi/oceanforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`,
    { headers: MET_HEADERS }
  )
  if (!res.ok) return null
  const data = await res.json()
  const series = data.properties?.timeseries ?? []
  const d = series[0]?.data?.instant?.details
  if (!d || d.sea_surface_wave_height == null) return null
  const wave: WavePoint = {
    height:  d.sea_surface_wave_height,
    dir:     d.sea_surface_wave_from_direction ?? 0,
    seaTemp: d.sea_water_temperature,
  }
  const waveSeries: SeriesPoint[] = series.slice(0, 8)
    .filter((p: any) => p.data?.instant?.details?.sea_surface_wave_height != null)
    .map((p: any, i: number) => ({ hour: i, v: p.data.instant.details.sea_surface_wave_height }))
  return { wave, waveSeries }
}
