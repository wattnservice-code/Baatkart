import { useEffect, useState, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

interface WxData {
  windSpeed: number  // m/s
  windDir: number    // degrees, FROM direction
  temp: number       // celsius
}

export default function WeatherOverlay() {
  const weatherVisible     = useMapStore((s) => s.weatherVisible)
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
        const d = data.properties.timeseries[0].data.instant.details
        const w = { windSpeed: d.wind_speed, windDir: d.wind_from_direction, temp: d.air_temperature }
        setWx(w)
        setCurrentWeather(w)
        setErr(null)
      })
      .catch(() => setErr('api'))
  }, [weatherVisible, position?.lat, position?.lng, setCurrentWeather])

  if (!weatherVisible) return null

  const ms = wx ? wx.windSpeed.toFixed(1) : null

  return (
    <div className="info-panel">
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
          <div className="wx-temp">{Math.round(wx.temp)}°C</div>
        </>
      )}
    </div>
  )
}
