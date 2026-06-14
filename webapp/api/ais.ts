// Vercel serverless function — proxies Barentswatch AIS Live API.
// Credentials stay server-side; browser never sees BW_CLIENT_ID / BW_CLIENT_SECRET.
// Set both env vars in the Vercel dashboard under Settings → Environment Variables.

const TOKEN_URL = 'https://id.barentswatch.no/connect/token'
const AIS_URL   = 'https://live.ais.barentswatch.no/v1/latest/combined'

interface TokenCache { value: string; exp: number }
let tokenCache: TokenCache | null = null

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp - 30_000) return tokenCache.value
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     process.env.BW_CLIENT_ID!,
      client_secret: process.env.BW_CLIENT_SECRET!,
      scope:         'ais',
    }).toString(),
  })
  if (!r.ok) throw new Error(`Token ${r.status}: ${await r.text()}`)
  const { access_token, expires_in } = await r.json() as { access_token: string; expires_in: number }
  tokenCache = { value: access_token, exp: Date.now() + expires_in * 1_000 }
  return access_token
}

type Req = { query: Record<string, string | string[]> }
type Res = { status(n: number): Res; json(d: unknown): void; setHeader(k: string, v: string): void }

export default async function handler(req: Req, res: Res) {
  if (!process.env.BW_CLIENT_ID || !process.env.BW_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Sett BW_CLIENT_ID og BW_CLIENT_SECRET i Vercel' })
  }
  try {
    const { xmin, ymin, xmax, ymax } = req.query
    const token = await getToken()
    const params = new URLSearchParams({
      Xmin: String(xmin), Ymin: String(ymin),
      Xmax: String(xmax), Ymax: String(ymax),
    })
    const r = await fetch(`${AIS_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return res.status(r.status).json({ error: `Barentswatch ${r.status}: ${await r.text()}` })
    const data = await r.json()
    res.setHeader('Cache-Control', 'no-store')
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
