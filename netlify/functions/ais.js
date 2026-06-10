const https = require('https')

// Token cache – persists across warm Lambda invocations
let cachedToken = null
let tokenExpiry = 0

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(body)
    const u = new URL(url)
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': data.length,
          'User-Agent': 'BaatKart/1.0',
        },
      },
      (res) => {
        let buf = ''
        res.on('data', (c) => { buf += c })
        res.on('end', () => resolve({ status: res.statusCode, body: buf }))
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function httpsGet(url, token) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'BaatKart/1.0' } }, (res) => {
      let buf = ''
      res.on('data', (c) => { buf += c })
      res.on('end', () => resolve({ status: res.statusCode, body: buf }))
    }).on('error', reject)
  })
}

async function getToken(clientId, clientSecret) {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'ais',
  }).toString()
  const { status, body: res } = await httpsPost('https://id.barentswatch.no/connect/token', body)
  if (status !== 200) throw new Error(`Token feil: ${status} ${res}`)
  const data = JSON.parse(res)
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

exports.handler = async (event) => {
  const { north, south, east, west } = event.queryStringParameters || {}
  if (!north || !south || !east || !west) return { statusCode: 400, body: 'Mangler bbox-parametere' }

  const clientId = process.env.BARENTSWATCH_CLIENT_ID
  const clientSecret = process.env.BARENTSWATCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return { statusCode: 503, body: 'AIS ikke konfigurert' }

  try {
    const token = await getToken(clientId, clientSecret)
    const url =
      `https://live.ais.barentswatch.no/v1/latest/combined` +
      `?Xmin=${west}&Ymin=${south}&Xmax=${east}&Ymax=${north}`
    const { status, body } = await httpsGet(url, token)
    if (status !== 200) return { statusCode: 502, body: `AIS API svarte ${status}` }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
      body,
    }
  } catch (err) {
    return { statusCode: 502, body: String(err) }
  }
}
