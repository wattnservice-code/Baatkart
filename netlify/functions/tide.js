const https = require('https')

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BaatKart/1.0' } }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    }).on('error', reject)
  })
}

exports.handler = async (event) => {
  const { lat, lon } = event.queryStringParameters || {}
  if (!lat || !lon) return { statusCode: 400, body: 'Missing lat/lon' }

  const now = new Date()
  const end = new Date(now.getTime() + 48 * 3600 * 1000)
  const fmt = (d) => d.toISOString().slice(0, 19)   // 2024-06-07T10:30:00

  const url =
    `https://api.sehavniva.no/tideapi.php` +
    `?lat=${lat}&lon=${lon}` +
    `&fromtime=${fmt(now)}&totime=${fmt(end)}` +
    `&interval=10&lang=nb&tide_request=locationdata`

  try {
    const { status, body } = await get(url)
    if (status !== 200) return { statusCode: 502, body: `API returned ${status}` }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800',
      },
      body,
    }
  } catch (err) {
    return { statusCode: 502, body: String(err) }
  }
}
