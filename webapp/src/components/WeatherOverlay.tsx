import { useEffect, useState, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { waveClass, seriesRange, WindSparkline, WaveBars } from './forecastCharts'
import type { SeriesPoint } from './forecastCharts'

interface WxData {
  windSpeed: number
  windDir: number
  temp: number
  symbol: string
}

interface WaveData {
  height: number
  dir: number
  seaTemp?: number
}

function wxEmoji(code: string): string {
  if (!code) return ''
  if (code.includes('thunder'))      return '⛈️'
  if (code.includes('snow'))         return '❄️'
  if (code.includes('sleet'))        return '🌨️'
  if (code.includes('heavyrain'))    return '🌧️'
  if (code.includes('rain'))         return '🌧️'
  if (code.includes('lightrain') || code.includes('drizzle')) return '🌦️'
  if (code.includes('fog'))          return '🌫️'
  if (code.startsWith('clearsky'))   return '☀️'
  if (code.startsWith('fair'))       return '🌤️'
  if (code.includes('partlycloudy')) return '⛅'
  if (code.includes('cloudy'))       return '☁️'
  return '🌡️'
}

export default function WeatherOverlay() {
  const weatherVisible    = useMapStore((s) => s.weatherVisible)
  const hideWxTide        = useMapStore((s) => s.hideWxTide)
  const position          = useMapStore((s) => s.position)
  const setCurrentWeather = useMapStore((s) => s.setCurrentWeather)
  const [wx, setWx]       = useState<WxData | null>(null)
  const [wave, setWave]   = useState<WaveData | null>(null)
  const [windSeries, setWindSeries] = useState<SeriesPoint[]>([])
  const [waveSeries, setWaveSeries] = useState<SeriesPoint[]>([])
  const [expanded, setExpanded] = useState(false)
  const [err, setErr]     = useState<string | null>(null)
  const [place, setPlace] = useState<string | null>(null)
  const fetchedKey        = useRef<string | null>(null)
  const waveKey           = useRef<string | null>(null)
  const placeKey          = useRef<string | null>(null)

  useEffect(() => {
    if (!weatherVisible) return
    if (!position) { setErr('no-gps'); return }
    const key = `${position.lat.toFixed(2)},${position.lng.toFixed(2)}`
    if (fetchedKey.current === key) return
    fetchedKey.current = key
    setErr(null)
    setWx(null)
    setWindSeries([])

    fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${position.lat.toFixed(4)}&lon=${position.lng.toFixed(4)}`,
      { headers: { 'User-Agent': 'BaatKart/1.0 frode.sighaug@gmail.com' } }
    )
      .then((r) => r.json())
      .then((data) => {
        const series = data.properties.timeseries
        const ts0 = series[0].data
        const d = ts0.instant.details
        const symbol = ts0.next_1_hours?.summary?.symbol_code
          ?? ts0.next_6_hours?.summary?.symbol_code
          ?? ''
        const w = { windSpeed: d.wind_speed, windDir: d.wind_from_direction, temp: d.air_temperature, symbol }
        setWx(w)
        setCurrentWeather(w)
        setErr(null)
        setWindSeries(
          series.slice(0, 8).map((p: any, i: number) => ({ hour: i, v: p.data.instant.details.wind_speed }))
        )
      })
      .catch(() => setErr('api'))
  }, [weatherVisible, position?.lat, position?.lng, setCurrentWeather])

  useEffect(() => {
    if (!weatherVisible || !position) return
    const key = `${position.lat.toFixed(2)},${position.lng.toFixed(2)}`
    if (waveKey.current === key) return
    waveKey.current = key
    setWave(null)
    setWaveSeries([])

    fetch(
      `https://api.met.no/weatherapi/oceanforecast/2.0/complete?lat=${position.lat.toFixed(4)}&lon=${position.lng.toFixed(4)}`,
      { headers: { 'User-Agent': 'BaatKart/1.0 frode.sighaug@gmail.com' } }
    )
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => {
        const series = data.properties?.timeseries ?? []
        const d = series[0]?.data?.instant?.details
        if (!d || d.sea_surface_wave_height == null) return
        setWave({
          height:  d.sea_surface_wave_height,
          dir:     d.sea_surface_wave_from_direction ?? 0,
          seaTemp: d.sea_water_temperature,
        })
        setWaveSeries(
          series.slice(0, 8)
            .filter((p: any) => p.data?.instant?.details?.sea_surface_wave_height != null)
            .map((p: any, i: number) => ({ hour: i, v: p.data.instant.details.sea_surface_wave_height }))
        )
      })
      .catch(() => {}) // wave er valgfritt — stille feil utenfor kystdekning
  }, [weatherVisible, position?.lat, position?.lng])

  useEffect(() => {
    if (!weatherVisible || !position) return
    const key = `${position.lat.toFixed(2)},${position.lng.toFixed(2)}`
    if (placeKey.current === key) return
    placeKey.current = key

    fetch(
      `https://api.kartverket.no/stedsnavn/v1/punkt` +
      `?nord=${position.lat.toFixed(4)}&ost=${position.lng.toFixed(4)}` +
      `&koordsys=4258&radius=5000&treffPerSide=10&utkoordsys=4258`
    )
      .then((r) => r.json())
      .then((data) => {
        const navn = (data?.navn ?? []) as Array<{
          meterFraPunkt?: number
          stedsnavn?: Array<{ skrivemåte?: string; navnestatus?: string }>
        }>
        if (!navn.length) { setPlace(null); return }
        const nearest = navn.reduce((a, b) =>
          (b.meterFraPunkt ?? 1e9) < (a.meterFraPunkt ?? 1e9) ? b : a
        )
        const sn = nearest.stedsnavn ?? []
        const main = sn.find((s) => s.navnestatus === 'hovednavn') ?? sn[0]
        setPlace(main?.skrivemåte ?? null)
      })
      .catch(() => setPlace(null))
  }, [weatherVisible, position?.lat, position?.lng])

  if (!weatherVisible) return null

  const ms = wx ? wx.windSpeed.toFixed(1) : null

  return (
    <div className="info-panel" onClick={hideWxTide} title="Trykk for å lukke" style={{ cursor: 'pointer' }}>
      {err === 'no-gps' ? (
        <span className="info-error">Ingen GPS-posisjon</span>
      ) : err === 'api' ? (
        <span className="info-error">Vær utilgjengelig</span>
      ) : !wx ? (
        <span className="info-loading">Laster vær…</span>
      ) : (
        <>
          {place && <div className="tide-station">{place}</div>}
          <div className="wx-row">
            <span className="wx-arrow" style={{ transform: `rotate(${wx.windDir + 180}deg)` }}>↑</span>
            <span className="wx-val">{ms} m/s</span>
            <span className="wx-sub">{Math.round(wx.windDir)}°</span>
          </div>
          <div className="wx-temp">
            {wx.symbol && <span className="wx-symbol">{wxEmoji(wx.symbol)}</span>}
            {Math.round(wx.temp)}°C
          </div>
          {wave && (
            <div className="wx-row">
              <span className="wx-arrow" style={{ transform: `rotate(${wave.dir + 180}deg)` }}>↑</span>
              <span className={`wx-val ${waveClass(wave.height)}`}>
                🌊 {wave.height.toFixed(1)} m
              </span>
              {wave.seaTemp != null && (
                <span className="wx-sub">{Math.round(wave.seaTemp)}° sjø</span>
              )}
            </div>
          )}
          {(windSeries.length >= 2 || waveSeries.length >= 2) && (
            <button
              className="wx-expand-toggle"
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
            >
              {expanded ? '▲ Skjul varsel' : '▼ Varsel 8t'}
            </button>
          )}
          {expanded && (
            <div className="wx-forecast" onClick={(e) => e.stopPropagation()}>
              {windSeries.length >= 2 && (
                <div className="wx-forecast-row">
                  <span className="wx-forecast-label">🌬 {seriesRange(windSeries)}</span>
                  <WindSparkline points={windSeries} />
                </div>
              )}
              {waveSeries.length >= 2 && (
                <div className="wx-forecast-row">
                  <span className="wx-forecast-label">🌊 {seriesRange(waveSeries)} m</span>
                  <WaveBars points={waveSeries} />
                </div>
              )}
              <div className="wx-forecast-hours">
                <span>nå</span><span>+8t</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
