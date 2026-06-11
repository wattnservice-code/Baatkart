import { useEffect, useState, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

interface WxData {
  windSpeed: number  // m/s
  windDir: number    // degrees, FROM direction
  temp: number       // celsius
  symbol: string     // met.no symbol_code
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
  const weatherVisible     = useMapStore((s) => s.weatherVisible)
  const toggleWeather      = useMapStore((s) => s.toggleWeather)
  const position           = useMapStore((s) => s.position)
  const setCurrentWeather  = useMapStore((s) => s.setCurrentWeather)
  const [wx, setWx]        = useState<WxData | null>(null)
  const [err, setErr]      = useState<string | null>(null)
  const fetchedKey         = useRef<string | null>(null)

  useEffect(() => {
    if (!weatherVisible) return
    if (!position) { setErr('no-gps'); return }
    const key = `${position.lat.toFixed(2)},${position.lng.toFixed(2)}`
    if (fetchedKey.current === key) return
    fetchedKey.current = key
    setErr(null)
    setWx(null)

    fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${position.lat.toFixed(4)}&lon=${position.lng.toFixed(4)}`,
      { headers: { 'User-Agent': 'BaatKart/1.0 frode.sighaug@gmail.com' } }
    )
      .then((r) => r.json())
      .then((data) => {
        const ts0 = data.properties.timeseries[0].data
        const d = ts0.instant.details
        const symbol = ts0.next_1_hours?.summary?.symbol_code
          ?? ts0.next_6_hours?.summary?.symbol_code
          ?? ''
        const w = { windSpeed: d.wind_speed, windDir: d.wind_from_direction, temp: d.air_temperature, symbol }
        setWx(w)
        setCurrentWeather(w)
        setErr(null)
      })
      .catch(() => setErr('api'))
  }, [weatherVisible, position?.lat, position?.lng, setCurrentWeather])

  if (!weatherVisible) return null

  const ms = wx ? wx.windSpeed.toFixed(1) : null

  return (
    <div className="info-panel" onClick={toggleWeather} title="Trykk for å lukke" style={{ cursor: 'pointer' }}>
      {err === 'no-gps' ? (
        <span className="info-error">Ingen GPS-posisjon</span>
      ) : err === 'api' ? (
        <span className="info-error">Vær utilgjengelig</span>
      ) : !wx ? (
        <span className="info-loading">Laster vær…</span>
      ) : (
        <>
          <div className="wx-row">
            {/* Arrow points direction wind blows TO */}
            <span className="wx-arrow" style={{ transform: `rotate(${wx.windDir + 180}deg)` }}>↑</span>
            <span className="wx-val">{ms} m/s</span>
            <span className="wx-sub">{Math.round(wx.windDir)}°</span>
          </div>
          <div className="wx-temp">
            {wx.symbol && <span className="wx-symbol">{wxEmoji(wx.symbol)}</span>}
            {Math.round(wx.temp)}°C
          </div>
        </>
      )}
    </div>
  )
}
