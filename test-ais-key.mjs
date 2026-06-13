// Standalone AIS key tester — runs from Node (server context), no browser.
// Reads the key from aiskey.local.txt (gitignored) so it never enters chat/git.
// Run: node test-ais-key.mjs
import { readFileSync } from 'node:fs'

let key
try {
  key = readFileSync(new URL('./aiskey.local.txt', import.meta.url), 'utf8').trim()
} catch {
  console.log('FEIL: fant ikke aiskey.local.txt — lim nøkkelen inn i den filen først.')
  process.exit(1)
}
if (!key) { console.log('FEIL: aiskey.local.txt er tom.'); process.exit(1) }
console.log(`Tester nøkkel (lengde ${key.length} tegn)…`)

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')
const t = setTimeout(() => { console.log('RESULTAT: ⏳ Ingen melding på 10s — uventet.'); process.exit(0) }, 10000)

ws.onopen = () => {
  console.log('• Handshake OK — sender abonnering…')
  ws.send(JSON.stringify({
    APIKey: key,
    // Wide box around Norway so we catch traffic regardless of map view.
    BoundingBoxes: [[[57, 4], [72, 32]]],
    FilterMessageTypes: ['PositionReport'],
  }))
}
ws.onmessage = async (e) => {
  // aisstream sends binary frames — decode ArrayBuffer/Blob, not String(e.data).
  let txt
  if (typeof e.data === 'string') txt = e.data
  else if (e.data instanceof ArrayBuffer) txt = new TextDecoder().decode(e.data)
  else if (typeof e.data.arrayBuffer === 'function') txt = new TextDecoder().decode(await e.data.arrayBuffer())
  else txt = String(e.data)

  if (txt.includes('"error"') || txt.includes('"Error"')) {
    console.log('RESULTAT: ❌ SERVERFEIL — svar:', txt.slice(0, 300))
    clearTimeout(t); process.exit(0)
  }
  try {
    const m = JSON.parse(txt)
    if (m.MessageType === 'PositionReport') {
      const name = (m.MetaData?.ShipName || '').trim() || `MMSI ${m.MetaData?.MMSI}`
      console.log(`RESULTAT: ✅ NØKKELEN VIRKER — mottok fartøy: ${name}`)
      clearTimeout(t); process.exit(0)
    }
  } catch { /* ignore */ }
}
ws.onclose = (e) => {
  clearTimeout(t)
  if (e.code === 1006) {
    console.log('RESULTAT: ❌ Lukket med 1006 uten feilmelding — nøkkel ikke aktiv / avvist.')
  } else {
    console.log(`RESULTAT: lukket med kode ${e.code} ${e.reason || ''}`)
  }
  process.exit(0)
}
ws.onerror = () => { /* close-handler reporter resultatet */ }
