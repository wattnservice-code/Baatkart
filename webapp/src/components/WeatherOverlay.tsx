import { useEffect, useState, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { waveClass, seriesRange, WindSparkline, WaveBars } from './forecastCharts'
import { track } from '../analytics'
import type { SeriesPoint } from './forecastCharts'
import { fetchWeather, fetchOcean, wxEmoji } from '../weather'
import type { WxPoint, WavePoint } from '../weather'

export default function WeatherOverlay() {
  const weatherVisible    = useMapStore((s) => s.weatherVisible)
  const hideWxTide        = useMapStore((s) => s.hideWxTide)
  const position          = useMapStore((s) => s.position)
  const setCurrentWeather = useMapStore((s) => s.setCurrentWeather)
  const [wx, setWx]       = useState<WxPoint | null>(null)
  const [wave, setWave]   = useState<WavePoint | null>(null)
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

    fetchWeather(position.lat, position.lng)
      .then(({ wx, windSeries }) => {
        setWx(wx)
        setCurrentWeather({ windSpeed: wx.windSpeed, windDir: wx.windDir, temp: wx.temp })
        setErr(null)
        setWindSeries(windSeries)
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

    fetchOcean(position.lat, position.lng)
      .then((ocean) => { if (ocean) { setWave(ocean.wave); setWaveSeries(ocean.waveSeries) } })
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
              onClick={(e) => { e.stopPropagation(); if (!expanded) track('forecast_expanded'); setExpanded((v) => !v) }}
            >
              {expanded ? '▲ Skjul varsel' : '▼ Varsel 8t'}
            </button>
          )}
          {expanded && (
            <div className="wx-forecast" onClick={(e) => e.stopPropagation()}>
              {windSeries.length >= 2 && (
                <div className="wx-forecast-row">
                  <span className="wx-forecast-label">🌬 {seriesRange(windSeries)}</span>
                  <div className="wx-forecast-col">
                    <WindSparkline points={windSeries} />
                    <div className="wx-forecast-hours"><span>nå</span><span>+8t</span></div>
                  </div>
                </div>
              )}
              {waveSeries.length >= 2 && (
                <div className="wx-forecast-row">
                  <span className="wx-forecast-label">🌊 {seriesRange(waveSeries)} m</span>
                  <div className="wx-forecast-col">
                    <WaveBars points={waveSeries} />
                    <div className="wx-forecast-hours"><span>nå</span><span>+8t</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
