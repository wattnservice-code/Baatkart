import { describe, it, expect } from 'vitest'
import { haversineM, bearingDeg, destPoint, cardinal, mobDrift } from './geo'

describe('haversineM', () => {
  it('er 0 for samme punkt', () => {
    expect(haversineM(59.9, 10.7, 59.9, 10.7)).toBe(0)
  })
  it('1 breddegrad ≈ 111.2 km', () => {
    expect(haversineM(0, 0, 1, 0)).toBeCloseTo(111194.9, 0)
  })
  it('er symmetrisk', () => {
    const a = haversineM(59.9, 10.7, 60.4, 5.3)
    const b = haversineM(60.4, 5.3, 59.9, 10.7)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('bearingDeg', () => {
  it('nord = 0°', () => { expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 4) })
  it('øst = 90°',  () => { expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 4) })
  it('sør = 180°', () => { expect(bearingDeg(0, 0, -1, 0)).toBeCloseTo(180, 4) })
  it('vest = 270°',() => { expect(bearingDeg(0, 0, 0, -1)).toBeCloseTo(270, 4) })
  it('alltid i [0,360)', () => {
    const b = bearingDeg(10, 10, 9.9, 9.9)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
  })
})

describe('destPoint', () => {
  it('nord 111.2 km ≈ +1 breddegrad', () => {
    const [lat, lng] = destPoint(0, 0, 0, 111194.9)
    expect(lat).toBeCloseTo(1, 3)
    expect(lng).toBeCloseTo(0, 3)
  })
  it('er invers av haversine+bearing', () => {
    const [lat, lng] = destPoint(59.9, 10.7, 45, 5000)
    expect(haversineM(59.9, 10.7, lat, lng)).toBeCloseTo(5000, 0)
    expect(bearingDeg(59.9, 10.7, lat, lng)).toBeCloseTo(45, 1)
  })
})

describe('cardinal', () => {
  it.each([
    [0, 'N'], [45, 'NØ'], [90, 'Ø'], [135, 'SØ'],
    [180, 'S'], [225, 'SV'], [270, 'V'], [315, 'NV'], [360, 'N'],
  ])('%i° → %s', (deg, label) => {
    expect(cardinal(deg)).toBe(label)
  })
  it('håndterer negative grader', () => { expect(cardinal(-90)).toBe('V') })
  it('håndterer > 360', () => { expect(cardinal(450)).toBe('Ø') })
})

describe('mobDrift', () => {
  it('returnerer null uten vind og strøm', () => {
    expect(mobDrift(59.9, 10.7, 100, null, null)).toBeNull()
  })

  it('vind fra nord driver personen sørover', () => {
    // windDir er "fra"-retning → leeway går nedvinds (sør)
    const d = mobDrift(59.9, 10.7, 100, { windSpeed: 10, windDir: 0 }, null)
    expect(d).not.toBeNull()
    expect(d!.bearing).toBeCloseTo(180, 1)
    // leeway 3,5 % av 10 m/s = 0,35 m/s × 100 s = 35 m
    expect(d!.distance).toBeCloseTo(35, 0)
  })

  it('strøm mot øst driver personen østover', () => {
    const d = mobDrift(59.9, 10.7, 100, null, { speed: 0.5, dir: 90 })
    expect(d).not.toBeNull()
    expect(d!.bearing).toBeCloseTo(90, 1)
    expect(d!.distance).toBeCloseTo(50, 0)
  })

  it('usikkerhetsradius vokser med driftet', () => {
    const d = mobDrift(59.9, 10.7, 100, null, { speed: 0.5, dir: 90 })
    // 30 m base + 30 % av 50 m = 45 m
    expect(d!.radius).toBeCloseTo(45, 0)
  })

  it('vind og strøm summeres som vektorer', () => {
    // vind fra nord (sørover) + strøm mot sør → samme retning, legges sammen
    const d = mobDrift(59.9, 10.7, 100, { windSpeed: 10, windDir: 0 }, { speed: 0.35, dir: 180 })
    expect(d!.bearing).toBeCloseTo(180, 1)
    expect(d!.distance).toBeCloseTo(70, 0) // 35 (vind) + 35 (strøm)
  })
})
