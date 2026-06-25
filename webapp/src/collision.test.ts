import { describe, it, expect } from 'vitest'
import { computeCPA, isDanger, type OwnState, type CpaTarget } from './collision'

const M_PER_DEG_LAT = 111194.9
const northOf = (lat: number, meters: number) => lat + meters / M_PER_DEG_LAT

const stationaryOwn: OwnState = { lat: 0, lng: 0, speedMs: 0, courseDeg: 0 }

function target(over: Partial<CpaTarget>): CpaTarget {
  return { lat: 0, lng: 0, sog: 0, heading: 0, cog: 0, ...over }
}

describe('computeCPA', () => {
  it('avstand og peiling til fartøy rett nord', () => {
    const t = target({ lat: northOf(0, 1000) })
    const cpa = computeCPA(stationaryOwn, t)!
    expect(cpa.rangeM).toBeCloseTo(1000, 0)
    expect(cpa.bearingDeg).toBeCloseTo(0, 1)
  })

  it('fartøy på direkte kollisjonskurs gir cpa≈0', () => {
    // 1000 m nord, går rett sør (heading 180) med 10 knop
    const t = target({ lat: northOf(0, 1000), sog: 10, heading: 180 })
    const cpa = computeCPA(stationaryOwn, t)!
    expect(cpa.cpaM).toBeCloseTo(0, 0)
    expect(cpa.tcpaMin).toBeGreaterThan(0)
    expect(cpa.tcpaMin).toBeCloseTo(3.24, 1) // 1000 m / (10 kn) ≈ 194 s
  })

  it('fartøy som beveger seg bort gir negativ tcpa', () => {
    const t = target({ lat: northOf(0, 1000), sog: 10, heading: 0 }) // nordover, vekk
    const cpa = computeCPA(stationaryOwn, t)!
    expect(cpa.tcpaMin).toBeLessThan(0)
  })

  it('parallell kurs uten relativ bevegelse', () => {
    // begge går nord med samme fart → ingen relativ hastighet
    const own: OwnState = { lat: 0, lng: 0, speedMs: 5, courseDeg: 0 }
    const t = target({ lat: northOf(0, 1000), sog: 5 / 0.514444, heading: 0 })
    const cpa = computeCPA(own, t)!
    expect(cpa.tcpaMin).toBe(0)
    expect(cpa.cpaM).toBeCloseTo(1000, 0)
  })

  it('faller tilbake til cog når heading mangler (0)', () => {
    const t = target({ lat: northOf(0, 1000), sog: 10, heading: 0, cog: 180 })
    const cpa = computeCPA(stationaryOwn, t)!
    expect(cpa.cpaM).toBeCloseTo(0, 0) // bruker cog=180 → kollisjonskurs
  })
})

describe('isDanger', () => {
  it('null → ikke farlig', () => { expect(isDanger(null)).toBe(false) })

  it('nær passering innen 15 min → farlig', () => {
    const t = target({ lat: northOf(0, 1000), sog: 15, heading: 180 })
    expect(isDanger(computeCPA(stationaryOwn, t))).toBe(true)
  })

  it('fartøy som går bort → ikke farlig', () => {
    const t = target({ lat: northOf(0, 1000), sog: 15, heading: 0 })
    expect(isDanger(computeCPA(stationaryOwn, t))).toBe(false)
  })

  it('passerer langt unna (> 0,5 nm) → ikke farlig', () => {
    // 3000 m øst, går sør → passerer 3000 m unna, godt over 0,5 nm (926 m)
    const t = target({ lng: 3000 / (M_PER_DEG_LAT), sog: 10, heading: 180 })
    expect(isDanger(computeCPA(stationaryOwn, t))).toBe(false)
  })

  it('treff først om mer enn 15 min → ikke farlig', () => {
    // langt unna og sakte → kollisjon, men TCPA > 15 min
    const t = target({ lat: northOf(0, 10000), sog: 1, heading: 180 })
    const cpa = computeCPA(stationaryOwn, t)!
    expect(cpa.tcpaMin).toBeGreaterThan(15)
    expect(isDanger(cpa)).toBe(false)
  })
})
