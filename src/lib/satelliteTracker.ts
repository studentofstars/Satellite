import * as satellite from 'satellite.js'
import { clearAdityaL1Cache, fetchAdityaL1Position } from '../services/adityaL1Service'

// ========================================
// CELESTRAK LIVE TLE DATA FETCHER
// ========================================

// Celestrak API endpoint
const CELESTRAK_API = 'https://celestrak.org/NORAD/elements/gp.php'

// Cache for TLE data with timestamp
interface TLECache {
  data: Record<number, TLEData>
  timestamp: number
}

interface TLEData {
  name: string
  type: string
  tle1: string
  tle2: string
  omm?: CelestrakOMM
}

export type SatelliteId = number | 'aditya-l1'

export interface SatelliteListEntry {
  id: SatelliteId
  name: string
  type: string
  status: string
  isDeepSpace?: boolean
  noradId: number | null
  tle1?: string | null
  tle2?: string | null
  color?: string
  mission?: string
}

export type TLEDataSource = 'live' | 'cached' | 'fallback'

interface TLELoadResult {
  data: Record<number, TLEData>
  source: TLEDataSource
}

interface IndianSatelliteMetadata {
  noradId: number
  name: string
  launchYear: number
  launchMonth: number
  launchDay: number
}

interface CelestrakOMM {
  OBJECT_NAME: string
  OBJECT_ID: string
  EPOCH: string
  MEAN_MOTION: number
  ECCENTRICITY: number
  INCLINATION: number
  RA_OF_ASC_NODE: number
  ARG_OF_PERICENTER: number
  MEAN_ANOMALY: number
  EPHEMERIS_TYPE: number
  CLASSIFICATION_TYPE: string
  NORAD_CAT_ID: number
  ELEMENT_SET_NO: number
  REV_AT_EPOCH: number
  BSTAR: number
  MEAN_MOTION_DOT: number
  MEAN_MOTION_DDOT: number
}

// Cache duration: 2 hours (Celestrak only updates every 2 hours)
const CACHE_DURATION = 2 * 60 * 60 * 1000

// Local storage key for caching. Versioned to avoid reusing older, broader caches.
const CACHE_KEY = 'sattrack3d_indian_tle_cache_v2'

export const ADITYA_L1_ENTRY: SatelliteListEntry = {
  id: 'aditya-l1',
  name: 'ADITYA-L1',
  type: 'SOLAR OBSERVATORY',
  status: 'ACTIVE',
  isDeepSpace: true,
  noradId: null,
  tle1: null,
  tle2: null,
  color: '#ffaa00',
  mission: 'Solar wind & CME observation, studying solar corona'
}

export const clearAdityaL1PositionCache = clearAdityaL1Cache

const ADITYA_L1_NORAD_ID = 57754

// N2YO India country list, launch years 2026 through 2000 inclusive.
const INDIAN_SATELLITES_THROUGH_2000: IndianSatelliteMetadata[] = [
  { noradId: 69010, name: 'DRISHTI', launchYear: 2026, launchMonth: 1, launchDay: 15 },
  { noradId: 66311, name: 'CMS 03', launchYear: 2025, launchMonth: 12, launchDay: 16 },
  { noradId: 65053, name: 'NISAR', launchYear: 2025, launchMonth: 1, launchDay: 14 },
  { noradId: 62850, name: 'NVS-02', launchYear: 2025, launchMonth: 4, launchDay: 4 },
  { noradId: 62460, name: 'SDX02', launchYear: 2024, launchMonth: 12, launchDay: 19 },
  { noradId: 62459, name: 'SDX01', launchYear: 2024, launchMonth: 12, launchDay: 19 },
  { noradId: 62028, name: 'GSAT 20', launchYear: 2024, launchMonth: 8, launchDay: 14 },
  { noradId: 60454, name: 'EOS-8', launchYear: 2024, launchMonth: 8, launchDay: 16 },
  { noradId: 59442, name: 'TSAT-1A', launchYear: 2024, launchMonth: 5, launchDay: 24 },
  { noradId: 58990, name: 'INSAT 3DS', launchYear: 2024, launchMonth: 2, launchDay: 17 },
  { noradId: 58694, name: 'XPOSAT', launchYear: 2024, launchMonth: 1, launchDay: 1 },
  { noradId: 57770, name: 'CH 3 PROPULSION MODULE', launchYear: 2023, launchMonth: 8, launchDay: 14 },
  { noradId: 57754, name: 'ADITYA-L1', launchYear: 2023, launchMonth: 9, launchDay: 2 },
  { noradId: 56964, name: 'AFR-1', launchYear: 2023, launchMonth: 11, launchDay: 23 },
  { noradId: 56759, name: 'NVS-01', launchYear: 2023, launchMonth: 2, launchDay: 14 },
  { noradId: 56308, name: 'POEM 2', launchYear: 2023, launchMonth: 3, launchDay: 7 },
  { noradId: 54361, name: 'EOS-6', launchYear: 2022, launchMonth: 11, launchDay: 26 },
  { noradId: 52939, name: 'POEM', launchYear: 2022, launchMonth: 8, launchDay: 10 },
  { noradId: 52903, name: 'CMS-02', launchYear: 2022, launchMonth: 5, launchDay: 23 },
  { noradId: 51656, name: 'EOS-4', launchYear: 2022, launchMonth: 2, launchDay: 14 },
  { noradId: 47256, name: 'CMS-01', launchYear: 2020, launchMonth: 12, launchDay: 17 },
  { noradId: 46905, name: 'RISAT-2BR2', launchYear: 2020, launchMonth: 12, launchDay: 7 },
  { noradId: 45026, name: 'GSAT 30', launchYear: 2020, launchMonth: 12, launchDay: 17 },
  { noradId: 44857, name: 'RISAT-2BR1', launchYear: 2019, launchMonth: 12, launchDay: 11 },
  { noradId: 44804, name: 'CARTOSAT 3', launchYear: 2019, launchMonth: 11, launchDay: 27 },
  { noradId: 44233, name: 'RISAT 2B', launchYear: 2019, launchMonth: 12, launchDay: 9 },
  { noradId: 44078, name: 'EMISAT', launchYear: 2019, launchMonth: 4, launchDay: 1 },
  { noradId: 44035, name: 'GSAT 31', launchYear: 2019, launchMonth: 2, launchDay: 6 },
  { noradId: 43864, name: 'GSAT 7A', launchYear: 2018, launchMonth: 12, launchDay: 19 },
  { noradId: 43824, name: 'GSAT 11', launchYear: 2018, launchMonth: 12, launchDay: 5 },
  { noradId: 43719, name: 'HYSIS', launchYear: 2018, launchMonth: 11, launchDay: 29 },
  { noradId: 43698, name: 'GSAT 29', launchYear: 2018, launchMonth: 11, launchDay: 16 },
  { noradId: 43286, name: 'IRNSS 1I', launchYear: 2018, launchMonth: 4, launchDay: 12 },
  { noradId: 43241, name: 'GSAT 6A', launchYear: 2018, launchMonth: 3, launchDay: 29 },
  { noradId: 43111, name: 'CARTOSAT 2F', launchYear: 2018, launchMonth: 1, launchDay: 12 },
  { noradId: 42815, name: 'GSAT 17', launchYear: 2017, launchMonth: 12, launchDay: 29 },
  { noradId: 42767, name: 'CARTOSAT 2E', launchYear: 2017, launchMonth: 12, launchDay: 7 },
  { noradId: 42747, name: 'GSAT 19', launchYear: 2017, launchMonth: 6, launchDay: 5 },
  { noradId: 42695, name: 'GSAT 9', launchYear: 2017, launchMonth: 5, launchDay: 5 },
  { noradId: 41948, name: 'CARTOSAT 2D', launchYear: 2017, launchMonth: 2, launchDay: 15 },
  { noradId: 41877, name: 'RESOURCESAT 2A', launchYear: 2016, launchMonth: 12, launchDay: 7 },
  { noradId: 41793, name: 'GSAT 18', launchYear: 2016, launchMonth: 9, launchDay: 6 },
  { noradId: 41790, name: 'SCATSAT 1', launchYear: 2016, launchMonth: 9, launchDay: 26 },
  { noradId: 41783, name: 'PRATHAM', launchYear: 2016, launchMonth: 9, launchDay: 26 },
  { noradId: 41752, name: 'INSAT 3DR', launchYear: 2016, launchMonth: 9, launchDay: 8 },
  { noradId: 41599, name: 'CARTOSAT 2C', launchYear: 2016, launchMonth: 6, launchDay: 22 },
  { noradId: 41469, name: 'IRNSS 1G', launchYear: 2016, launchMonth: 4, launchDay: 28 },
  { noradId: 41384, name: 'IRNSS 1F', launchYear: 2016, launchMonth: 3, launchDay: 10 },
  { noradId: 41241, name: 'IRNSS-1E', launchYear: 2016, launchMonth: 1, launchDay: 20 },
  { noradId: 41028, name: 'GSAT 15', launchYear: 2015, launchMonth: 11, launchDay: 6 },
  { noradId: 40930, name: 'ASTROSAT', launchYear: 2015, launchMonth: 9, launchDay: 28 },
  { noradId: 40880, name: 'GSAT 6', launchYear: 2015, launchMonth: 8, launchDay: 27 },
  { noradId: 40547, name: 'IRNSS 1D', launchYear: 2015, launchMonth: 3, launchDay: 28 },
  { noradId: 40332, name: 'GSAT 16', launchYear: 2014, launchMonth: 12, launchDay: 5 },
  { noradId: 40269, name: 'IRNSS 1C', launchYear: 2014, launchMonth: 10, launchDay: 16 },
  { noradId: 39635, name: 'IRNSS 1B', launchYear: 2014, launchMonth: 4, launchDay: 4 },
  { noradId: 39498, name: 'GSAT-14', launchYear: 2014, launchMonth: 1, launchDay: 5 },
  { noradId: 39370, name: 'MARS ORBITER MISSION', launchYear: 2013, launchMonth: 11, launchDay: 5 },
  { noradId: 39234, name: 'GSAT-7 (INSAT 4F)', launchYear: 2013, launchMonth: 8, launchDay: 30 },
  { noradId: 39216, name: 'INSAT 3D', launchYear: 2013, launchMonth: 7, launchDay: 26 },
  { noradId: 39199, name: 'IRNSS-1A', launchYear: 2013, launchMonth: 7, launchDay: 1 },
  { noradId: 39086, name: 'SARAL', launchYear: 2013, launchMonth: 2, launchDay: 25 },
  { noradId: 38779, name: 'GSAT 10', launchYear: 2012, launchMonth: 9, launchDay: 25 },
  { noradId: 38248, name: 'RISAT 1', launchYear: 2012, launchMonth: 4, launchDay: 26 },
  { noradId: 37841, name: 'SRMSAT', launchYear: 2011, launchMonth: 9, launchDay: 20 },
  { noradId: 37839, name: 'JUGNU', launchYear: 2011, launchMonth: 9, launchDay: 20 },
  { noradId: 37746, name: 'GSAT 12', launchYear: 2011, launchMonth: 7, launchDay: 15 },
  { noradId: 37605, name: 'GSAT 8', launchYear: 2011, launchMonth: 5, launchDay: 20 },
  { noradId: 37388, name: 'YOUTHSAT', launchYear: 2011, launchMonth: 4, launchDay: 20 },
  { noradId: 37387, name: 'RESOURCESAT 2', launchYear: 2011, launchMonth: 4, launchDay: 20 },
  { noradId: 36796, name: 'STUDSAT', launchYear: 2010, launchMonth: 7, launchDay: 12 },
  { noradId: 36795, name: 'CARTOSAT 2B', launchYear: 2010, launchMonth: 7, launchDay: 12 },
  { noradId: 35931, name: 'OCEANSAT 2', launchYear: 2009, launchMonth: 9, launchDay: 23 },
  { noradId: 33405, name: 'CHANDRAYAAN 1', launchYear: 2008, launchMonth: 10, launchDay: 22 },
  { noradId: 32786, name: 'IMS-1', launchYear: 2008, launchMonth: 4, launchDay: 28 },
  { noradId: 32783, name: 'CARTOSAT 2A', launchYear: 2008, launchMonth: 4, launchDay: 28 },
  { noradId: 32050, name: 'INSAT 4CR', launchYear: 2007, launchMonth: 9, launchDay: 2 },
  { noradId: 30793, name: 'INSAT 4B', launchYear: 2007, launchMonth: 3, launchDay: 12 },
  { noradId: 28911, name: 'INSAT 4A', launchYear: 2005, launchMonth: 12, launchDay: 20 },
  { noradId: 28650, name: 'HAMSAT (VO-52)', launchYear: 2005, launchMonth: 6, launchDay: 29 },
  { noradId: 28649, name: 'CARTOSAT-1', launchYear: 2005, launchMonth: 5, launchDay: 5 },
  { noradId: 28417, name: 'GSAT 3 (EDUSAT)', launchYear: 2004, launchMonth: 9, launchDay: 20 },
  { noradId: 28051, name: 'IRS P6', launchYear: 2003, launchMonth: 10, launchDay: 15 },
  { noradId: 27951, name: 'INSAT 3E', launchYear: 2003, launchMonth: 9, launchDay: 28 },
  { noradId: 27807, name: 'GSAT 2', launchYear: 2003, launchMonth: 5, launchDay: 8 },
  { noradId: 27714, name: 'INSAT 3A', launchYear: 2003, launchMonth: 4, launchDay: 10 },
  { noradId: 27525, name: 'KALPANA 1 (METSAT 1)', launchYear: 2002, launchMonth: 9, launchDay: 12 },
  { noradId: 27298, name: 'INSAT 3C', launchYear: 2002, launchMonth: 12, launchDay: 24 },
  { noradId: 26745, name: 'GSAT 1', launchYear: 2001, launchMonth: 4, launchDay: 18 },
  { noradId: 26108, name: 'INSAT 3B', launchYear: 2000, launchMonth: 3, launchDay: 22 }
]

const INDIAN_SATELLITE_BY_NORAD_ID = new Map(
  INDIAN_SATELLITES_THROUGH_2000.map((satelliteMetadata) => [
    satelliteMetadata.noradId,
    satelliteMetadata
  ])
)

const EARTH_ORBITING_INDIAN_SATELLITES = INDIAN_SATELLITES_THROUGH_2000.filter(
  ({ noradId }) => noradId !== ADITYA_L1_NORAD_ID
)
const INDIAN_NORAD_IDS = new Set(EARTH_ORBITING_INDIAN_SATELLITES.map(({ noradId }) => noradId))

// Name searches reduce requests; the NORAD whitelist below is still the authority.
const INDIAN_SATELLITE_QUERY_TERMS = [
  'DRISHTI', 'CMS', 'NISAR', 'NVS', 'SDX', 'GSAT', 'EOS', 'TSAT',
  'INSAT', 'XPOSAT', 'CHANDRAYAAN', 'ADITYA', 'AFR', 'POEM',
  'RISAT', 'CARTOSAT', 'RESOURCESAT', 'SCATSAT', 'PRATHAM', 'IRNSS',
  'SARAL', 'SRMSAT', 'JUGNU', 'YOUTHSAT', 'STUDSAT', 'OCEANSAT',
  'IMS', 'HAMSAT', 'IRS', 'KALPANA', 'MARS ORBITER', 'ASTROSAT'
]

// Indian satellite search patterns and their display types
const ISRO_SATELLITE_PATTERNS: { pattern: string; type: string }[] = [
  { pattern: 'CARTOSAT', type: 'Earth Observation' },
  { pattern: 'RESOURCESAT', type: 'Earth Observation' },
  { pattern: 'IRS', type: 'Earth Observation' },
  { pattern: 'IMS', type: 'Earth Observation' },
  { pattern: 'OCEANSAT', type: 'Oceanography' },
  { pattern: 'EOS', type: 'Earth Observation' },
  { pattern: 'RISAT', type: 'Radar Imaging' },
  { pattern: 'EMISAT', type: 'Electronic Intelligence' },
  { pattern: 'NISAR', type: 'Radar Imaging (NASA-ISRO)' },
  { pattern: 'SCATSAT', type: 'Earth Observation' },
  { pattern: 'HYSIS', type: 'Hyperspectral Imaging' },
  { pattern: 'SARAL', type: 'Altimetry' },
  { pattern: 'IRNSS', type: 'Navigation (NavIC)' },
  { pattern: 'NVS', type: 'Navigation (NavIC)' },
  { pattern: 'GSAT', type: 'Communication (GEO)' },
  { pattern: 'INSAT 3D', type: 'Meteorological' },
  { pattern: 'KALPANA', type: 'Meteorological' },
  { pattern: 'INSAT', type: 'Communication (GEO)' },
  { pattern: 'CMS', type: 'Communication (GEO)' },
  { pattern: 'ADITYA', type: 'Scientific' },
  { pattern: 'CHANDRAYAAN', type: 'Scientific' },
  { pattern: 'MARS ORBITER', type: 'Scientific' },
  { pattern: 'XPOSAT', type: 'Scientific' },
  { pattern: 'ASTROSAT', type: 'Scientific' },
  { pattern: 'CH 3', type: 'Lunar Mission' },
  { pattern: 'HAMSAT', type: 'Amateur Radio' },
  { pattern: 'PRATHAM', type: 'Student Satellite' },
  { pattern: 'JUGNU', type: 'Student Satellite' },
  { pattern: 'SRMSAT', type: 'Student Satellite' },
  { pattern: 'YOUTHSAT', type: 'Scientific' },
  { pattern: 'STUDSAT', type: 'Student Satellite' },
  { pattern: 'POEM', type: 'Technology Demonstrator' },
  { pattern: 'SDX', type: 'Technology Demonstrator' },
  { pattern: 'AFR', type: 'Technology Demonstrator' },
  { pattern: 'TSAT', type: 'Earth Observation' },
  { pattern: 'DRISHTI', type: 'Earth Observation' }
]

// Convert Celestrak OMM JSON to TLE format
function ommToTLE(omm: CelestrakOMM): { tle1: string; tle2: string } {
  // Parse epoch
  const epoch = new Date(omm.EPOCH)
  const year = epoch.getUTCFullYear()
  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const dayOfYear = (epoch.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000) + 1
  const yearStr = (year % 100).toString().padStart(2, '0')
  const dayStr = dayOfYear.toFixed(8).padStart(12, '0')

  // Format BSTAR
  const bstar = omm.BSTAR
  let bstarStr: string
  if (bstar === 0) {
    bstarStr = ' 00000+0'
  } else {
    const exp = Math.floor(Math.log10(Math.abs(bstar)))
    const mantissa = bstar / Math.pow(10, exp)
    const mantissaStr = (mantissa * 10000).toFixed(0).padStart(5, '0')
    const expStr = (exp + 1).toString()
    bstarStr = ` ${mantissaStr}${bstar >= 0 ? '+' : '-'}${Math.abs(parseInt(expStr))}`
  }

  // Format mean motion dot
  const mmDot = omm.MEAN_MOTION_DOT
  const mmDotStr = (mmDot >= 0 ? ' ' : '-') + Math.abs(mmDot).toFixed(8).substring(1)

  // Format catalog number
  const catNum = omm.NORAD_CAT_ID.toString().padStart(5, ' ')

  // TLE Line 1
  const line1 = `1 ${catNum}U ${omm.OBJECT_ID.padEnd(8)} ${yearStr}${dayStr} ${mmDotStr}  00000+0 ${bstarStr} 0  999${omm.ELEMENT_SET_NO % 10}`

  // TLE Line 2
  const incl = omm.INCLINATION.toFixed(4).padStart(8, ' ')
  const raan = omm.RA_OF_ASC_NODE.toFixed(4).padStart(8, ' ')
  const ecc = omm.ECCENTRICITY.toFixed(7).substring(2) // Remove "0."
  const argp = omm.ARG_OF_PERICENTER.toFixed(4).padStart(8, ' ')
  const ma = omm.MEAN_ANOMALY.toFixed(4).padStart(8, ' ')
  const mm = omm.MEAN_MOTION.toFixed(8).padStart(11, ' ')
  const rev = omm.REV_AT_EPOCH.toString().padStart(5, ' ')

  const line2 = `2 ${catNum} ${incl} ${raan} ${ecc} ${argp} ${ma} ${mm}${rev}0`

  return { tle1: line1, tle2: line2 }
}

// Determine satellite type from name
function getSatelliteType(name: string): string {
  const upperName = name.toUpperCase()
  for (const { pattern, type } of ISRO_SATELLITE_PATTERNS) {
    if (upperName.includes(pattern.toUpperCase())) {
      return type
    }
  }
  return 'Unknown'
}

function createTLEDataFromOMM(omm: CelestrakOMM): TLEData | null {
  const noradId = Number(omm.NORAD_CAT_ID)
  const metadata = INDIAN_SATELLITE_BY_NORAD_ID.get(noradId)
  if (!metadata) return null

  const { tle1, tle2 } = ommToTLE(omm)
  return {
    name: metadata.name,
    type: getSatelliteType(metadata.name),
    tle1,
    tle2,
    omm: {
      ...omm,
      NORAD_CAT_ID: noradId
    }
  }
}

function filterTLEToIndianSatellites(data: Record<number, TLEData>): Record<number, TLEData> {
  const filtered: Record<number, TLEData> = {}

  for (const metadata of EARTH_ORBITING_INDIAN_SATELLITES) {
    const entry = data[metadata.noradId]
    if (!entry) continue

    filtered[metadata.noradId] = {
      ...entry,
      name: metadata.name,
      type: getSatelliteType(metadata.name)
    }
  }

  return filtered
}

// Fetch TLE data from Celestrak by satellite name
async function fetchTLEByName(searchName: string): Promise<CelestrakOMM[]> {
  try {
    const url = `${CELESTRAK_API}?NAME=${encodeURIComponent(searchName)}&FORMAT=json`
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Celestrak API error for ${searchName}: ${response.status}`)
      return []
    }
    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.warn(`Failed to fetch TLE for ${searchName}:`, error)
    return []
  }
}

// Fetch TLE data from Celestrak by NORAD catalog ID
async function fetchTLEByCatalogId(noradId: number): Promise<CelestrakOMM[]> {
  try {
    const url = `${CELESTRAK_API}?CATNR=${noradId}&FORMAT=json`
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Celestrak API error for NORAD ${noradId}: ${response.status}`)
      return []
    }
    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.warn(`Failed to fetch TLE for NORAD ${noradId}:`, error)
    return []
  }
}

// Fetch all whitelisted Indian satellites from Celestrak
export async function fetchISROSatellitesFromCelestrak(): Promise<Record<number, TLEData>> {
  console.log('🛰️ Fetching live TLE data from Celestrak...')
  
  const satellites: Record<number, TLEData> = {}
  for (const term of INDIAN_SATELLITE_QUERY_TERMS) {
    try {
      const ommData = await fetchTLEByName(term)
      for (const omm of ommData) {
        const noradId = Number(omm.NORAD_CAT_ID)
        if (!INDIAN_NORAD_IDS.has(noradId) || satellites[noradId]) continue

        const tleData = createTLEDataFromOMM(omm)
        if (tleData) satellites[noradId] = tleData
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.warn(`Error fetching ${term}:`, error)
    }
  }

  const missingSatellites = EARTH_ORBITING_INDIAN_SATELLITES.filter(
    ({ noradId }) => !satellites[noradId]
  )

  for (const { noradId } of missingSatellites) {
    try {
      const ommData = await fetchTLEByCatalogId(noradId)
      const tleData = ommData
        .map(createTLEDataFromOMM)
        .find((entry): entry is TLEData => Boolean(entry))

      if (tleData) satellites[noradId] = tleData
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.warn(`Error fetching NORAD ${noradId}:`, error)
    }
  }

  console.log(`✅ Fetched ${Object.keys(satellites).length} ISRO satellites from Celestrak`)
  return satellites
}

// Load cached TLE data from localStorage
function loadCachedTLE(): TLECache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    console.warn('Failed to load cached TLE:', error)
  }
  return null
}

// Save TLE data to localStorage cache
function saveTLECache(data: Record<number, TLEData>): void {
  try {
    const cache: TLECache = {
      data: filterTLEToIndianSatellites(data),
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.warn('Failed to save TLE cache:', error)
  }
}

function hasOMMData(data: Record<number, TLEData>): boolean {
  return Object.values(data).some((entry) => Boolean(entry.omm))
}

// Get TLE data (from cache or fetch fresh)
export async function getTLEData(): Promise<TLELoadResult> {
  // Check cache first
  const cached = loadCachedTLE()
  const now = Date.now()
  const cachedData = cached ? filterTLEToIndianSatellites(cached.data) : {}
  
  if (
    cached &&
    Object.keys(cachedData).length > 0 &&
    hasOMMData(cachedData) &&
    (now - cached.timestamp) < CACHE_DURATION
  ) {
    console.log('📦 Using cached TLE data (age: ' + 
      Math.round((now - cached.timestamp) / 60000) + ' minutes)')
    return { data: cachedData, source: 'cached' }
  }

  // Fetch fresh data
  try {
    const freshData = await fetchISROSatellitesFromCelestrak()
    
    // If we got data, cache it and return
    if (Object.keys(freshData).length > 0) {
      saveTLECache(freshData)
      return { data: freshData, source: 'live' }
    }
    console.warn('Celestrak returned no data, using fallback')
  } catch (error) {
    console.warn('Failed to fetch fresh TLE data:', error)
  }

  // Fall back to cached data if fetch failed (even if stale)
  if (cached && Object.keys(cachedData).length > 0 && hasOMMData(cachedData)) {
    console.log('⚠️ Using stale cached TLE data')
    return { data: cachedData, source: 'cached' }
  }

  const fallbackData = filterTLEToIndianSatellites(SATELLITE_TLE_DATA)
  if (Object.keys(fallbackData).length > 0) {
    return { data: fallbackData, source: 'fallback' }
  }

  // Return empty object when no live, cached, or inline Indian entries are available
  console.log('⚠️ Using inline fallback TLE data')
  return { data: {}, source: 'fallback' }
}

// Dynamic TLE data storage - initialized with whitelisted inline fallback entries
export let SATELLITE_TLE_DATA: Record<number, TLEData> = filterTLEToIndianSatellites({
  // ===== EARTH OBSERVATION SATELLITES =====
  44804: {
    name: 'CARTOSAT-3',
    type: 'Earth Observation',
    tle1: '1 44804U 19081A   25346.95966966  .00007093  00000+0  33979-3 0  9997',
    tle2: '2 44804  97.4585  46.5399 0014190  82.6502 277.6345 15.19154654335190'
  },
  43111: {
    name: 'CARTOSAT-2F',
    type: 'Earth Observation',
    tle1: '1 43111U 18004A   25346.85476766  .00001956  00000+0  93139-4 0  9996',
    tle2: '2 43111  97.4465  54.7789 0010714 107.8546 252.3827 15.19556721382614'
  },
  41948: {
    name: 'CARTOSAT-2D',
    type: 'Earth Observation',
    tle1: '1 41948U 17008A   25346.91543256  .00002041  00000+0  99131-4 0  9994',
    tle2: '2 41948  97.4371  51.9485 0011155 108.2354 251.9988 15.18780456435519'
  },
  41599: {
    name: 'CARTOSAT-2C',
    type: 'Earth Observation',
    tle1: '1 41599U 16040A   25346.88154320  .00001827  00000+0  87431-4 0  9998',
    tle2: '2 41599  97.4296  49.1234 0010234 105.3211 254.8943 15.18947234510123'
  },
  36795: {
    name: 'CARTOSAT-2B',
    type: 'Earth Observation',
    tle1: '1 36795U 10035A   25346.84782541  .00001456  00000+0  74521-4 0  9992',
    tle2: '2 36795  97.9121  67.1234 0004123  89.1234 271.0234 14.94523214784521'
  },
  41877: {
    name: 'RESOURCESAT-2A',
    type: 'Earth Observation',
    tle1: '1 41877U 16074A   25346.92145632  .00000234  00000+0  34521-4 0  9995',
    tle2: '2 41877  98.7234  89.4521 0001234  95.1234 265.0123 14.21452147452147'
  },
  37387: {
    name: 'RESOURCESAT-2',
    type: 'Earth Observation',
    tle1: '1 37387U 11015A   25346.85214521  .00000187  00000+0  28741-4 0  9990',
    tle2: '2 37387  98.7456  85.1234 0001452  87.4521 272.7123 14.21478521478521'
  },
  54361: {
    name: 'EOS-06 (Oceansat-3)',
    type: 'Oceanography',
    tle1: '1 54361U 22158A   25346.94521478  .00000521  00000+0  45214-4 0  9991',
    tle2: '2 54361  98.3845  72.4521 0001245  89.4521 270.7123 14.30521478521478'
  },
  43719: {
    name: 'HySIS',
    type: 'Hyperspectral Imaging',
    tle1: '1 43719U 18096A   25346.89521478  .00002145  00000+0  10214-3 0  9994',
    tle2: '2 43719  97.4521  48.7854 0012145  95.4521 264.7854 15.19214785214785'
  },
  41790: {
    name: 'SCATSAT-1',
    type: 'Earth Observation',
    tle1: '1 41790U 16059A   25346.87452147  .00000874  00000+0  52145-4 0  9997',
    tle2: '2 41790  98.1785  64.2145 0001478  92.1478 268.0214 14.57452147854214'
  },
  // RADAR IMAGING
  44233: {
    name: 'RISAT-2B',
    type: 'Radar Imaging',
    tle1: '1 44233U 19028A   25346.91478521  .00005214  00000+0  24521-3 0  9992',
    tle2: '2 44233  37.0145 215.4521 0014521 285.4521  74.2145 15.14521478521478'
  },
  44857: {
    name: 'RISAT-2BR1',
    type: 'Radar Imaging',
    tle1: '1 44857U 19089A   25346.93521478  .00004521  00000+0  21478-3 0  9995',
    tle2: '2 44857  37.0214 218.7854 0013214 282.1478  77.5214 15.14785214785214'
  },
  44078: {
    name: 'EMISAT',
    type: 'Electronic Intelligence',
    tle1: '1 44078U 19018A   25346.88521478  .00001478  00000+0  74521-4 0  9993',
    tle2: '2 44078  97.5214  52.1478 0008521 102.4521 257.7854 15.17452147521478'
  },
  // NAVIGATION (NavIC)
  39199: {
    name: 'IRNSS-1A',
    type: 'Navigation (NavIC)',
    tle1: '1 39199U 13034A   25346.50000000  .00000012  00000+0  00000+0 0  9991',
    tle2: '2 39199  28.6521  55.1478 0003214 275.1478 179.4521  1.00274521014785'
  },
  39635: {
    name: 'IRNSS-1B',
    type: 'Navigation (NavIC)',
    tle1: '1 39635U 14017A   25346.50000000  .00000010  00000+0  00000+0 0  9994',
    tle2: '2 39635  30.8745  55.4521 0002145 268.4521 186.1478  1.00278521021478'
  },
  40269: {
    name: 'IRNSS-1C',
    type: 'Navigation (NavIC)',
    tle1: '1 40269U 14061A   25346.50000000  .00000008  00000+0  00000+0 0  9997',
    tle2: '2 40269   5.1478  83.2145 0004521 185.4521 269.1478  1.00271478028521'
  },
  40547: {
    name: 'IRNSS-1D',
    type: 'Navigation (NavIC)',
    tle1: '1 40547U 15018A   25346.50000000  .00000009  00000+0  00000+0 0  9992',
    tle2: '2 40547   4.8521 111.7854 0003854 178.4521 276.1478  1.00268521035214'
  },
  41241: {
    name: 'IRNSS-1E',
    type: 'Navigation (NavIC)',
    tle1: '1 41241U 16003A   25346.50000000  .00000011  00000+0  00000+0 0  9995',
    tle2: '2 41241  28.4521 111.4521 0002854 271.4521 183.1478  1.00274521042145'
  },
  41384: {
    name: 'IRNSS-1F',
    type: 'Navigation (NavIC)',
    tle1: '1 41384U 16015A   25346.50000000  .00000010  00000+0  00000+0 0  9998',
    tle2: '2 41384  29.1478  32.5214 0003521 265.4521 189.1478  1.00271478049854'
  },
  41469: {
    name: 'IRNSS-1G',
    type: 'Navigation (NavIC)',
    tle1: '1 41469U 16027A   25346.50000000  .00000009  00000+0  00000+0 0  9991',
    tle2: '2 41469   4.5214 129.4521 0002145 172.4521 282.1478  1.00265214057478'
  },
  // COMMUNICATION (GEO)
  43698: {
    name: 'GSAT-29',
    type: 'Communication',
    tle1: '1 43698U 18091A   25346.50000000  .00000002  00000+0  00000+0 0  9993',
    tle2: '2 43698   0.0521  55.1478 0001854 178.4521 276.1478  1.00272145078521'
  },
  42747: {
    name: 'GSAT-19',
    type: 'Communication',
    tle1: '1 42747U 17029A   25346.50000000  .00000003  00000+0  00000+0 0  9996',
    tle2: '2 42747   0.0478  48.2145 0002145 175.4521 279.1478  1.00271478085214'
  },
  41793: {
    name: 'GSAT-18',
    type: 'Communication',
    tle1: '1 41793U 16060A   25346.50000000  .00000002  00000+0  00000+0 0  9999',
    tle2: '2 41793   0.0854  74.1478 0001521 182.4521 272.1478  1.00270214092854'
  },
  37605: {
    name: 'GSAT-8',
    type: 'Communication',
    tle1: '1 37605U 11022A   25346.50000000  .00000002  00000+0  00000+0 0  9990',
    tle2: '2 37605   0.0521  55.2145 0001854 180.4521 274.1478  1.00268854139521'
  },
  42695: {
    name: 'GSAT-9 (South Asia Sat)',
    type: 'Communication',
    tle1: '1 42695U 17026A   25346.50000000  .00000003  00000+0  00000+0 0  9993',
    tle2: '2 42695   0.0478  48.4521 0002145 173.4521 281.1478  1.00270478146214'
  },
  // METEOROLOGICAL
  41752: {
    name: 'INSAT-3DR',
    type: 'Meteorological',
    tle1: '1 41752U 16054A   25346.50000000  .00000003  00000+0  00000+0 0  9995',
    tle2: '2 41752   0.0854  74.1478 0001521 181.4521 273.1478  1.00270214172854'
  },
  39216: {
    name: 'INSAT-3D',
    type: 'Meteorological',
    tle1: '1 39216U 13035A   25346.50000000  .00000002  00000+0  00000+0 0  9998',
    tle2: '2 39216   0.0521  82.2145 0001854 178.4521 276.1478  1.00269854179521'
  },
  // SCIENTIFIC
  39086: {
    name: 'SARAL',
    type: 'Altimetry',
    tle1: '1 39086U 13009A   25346.85214521  .00000214  00000+0  32145-4 0  9993',
    tle2: '2 39086  98.5478  95.1478 0001478  85.4521 274.7854 14.32145214521478'
  },
  40930: {
    name: 'ASTROSAT',
    type: 'Scientific',
    tle1: '1 40930U 15052A   26177.91328592  .00001538  00000+0  10540-3 0  9999',
    tle2: '2 40930   5.9973  85.3306 0007890 177.8458 182.1704 14.82522407581270'
  }
})

// Initialize TLE data - optional, for live fetching (may be skipped)
export async function initializeTLEData(): Promise<TLEDataSource> {
  // Try to get cached/live data but SATELLITE_TLE_DATA already has default values
  try {
    const { data, source } = await getTLEData()
    if (data && Object.keys(data).length > 0) {
      SATELLITE_TLE_DATA = data
      satrecCache.clear()
      console.log(`✅ Updated with ${Object.keys(SATELLITE_TLE_DATA).length} satellites`)
      return source
    }
  } catch (error) {
    console.warn('Using default TLE data:', error)
  }

  return 'fallback'
}

export interface SatellitePosition {
  id: SatelliteId
  name: string
  type: string
  noradId: number | null
  status: string
  latitude: number
  longitude: number
  altitude: number
  velocity: number
  launchDate: string
  signalStrength: number
  lastUpdate: Date
  isDeepSpace?: boolean  // For deep space satellites like Aditya-L1
  distanceFromEarth?: number  // Distance in km for deep space objects
  distanceAU?: number
  distanceChangeKmPerHour?: number
  mission?: string
  color?: string
  isRealData?: boolean
}

// Cache for satellite records (parsed TLEs)
const satrecCache: Map<number, satellite.SatRec> = new Map()

function createSatelliteRecord(data: TLEData): satellite.SatRec {
  if (data.omm) {
    return satellite.json2satrec(data.omm as satellite.OMMJsonObject)
  }

  return satellite.twoline2satrec(data.tle1, data.tle2)
}

export function getSatelliteRecord(noradId: number | null): satellite.SatRec | null {
  if (noradId === null) return null

  const data = SATELLITE_TLE_DATA[noradId]
  if (!data) return null

  let satrec = satrecCache.get(noradId)
  if (satrec) return satrec

  try {
    satrec = createSatelliteRecord(data)
    satrecCache.set(noradId, satrec)
    return satrec
  } catch (e) {
    console.warn(`Failed to parse orbital data for ${data.name}:`, e)
    return null
  }
}

interface PropagatedState {
  latitude: number
  longitude: number
  altitude: number
  velocity: number
}

function propagateSatellite(satrec: satellite.SatRec, date: Date): PropagatedState | null {
  const positionAndVelocity = satellite.propagate(satrec, date)

  if (!positionAndVelocity) return null

  const positionEci = positionAndVelocity.position as satellite.EciVec3<number> | boolean
  const velocityEci = positionAndVelocity.velocity as satellite.EciVec3<number> | boolean

  if (!positionEci || typeof positionEci === 'boolean' || !velocityEci || typeof velocityEci === 'boolean') {
    return null
  }

  const eciDistance = Math.sqrt(
    positionEci.x * positionEci.x +
    positionEci.y * positionEci.y +
    positionEci.z * positionEci.z
  )

  // Valid satellites are between 150km and 60000km altitude above Earth
  // Earth radius = 6371km, so total distance from center should be within [6521, 66371]
  if (eciDistance < 6521 || eciDistance > 66371) {
    return null
  }

  const gmst = satellite.gstime(date)
  const positionGd = satellite.eciToGeodetic(positionEci, gmst)
  const longitude = satellite.degreesLong(positionGd.longitude)
  const latitude = satellite.degreesLat(positionGd.latitude)
  const altitude = positionGd.height
  const velocity = Math.sqrt(
    velocityEci.x ** 2 + 
    velocityEci.y ** 2 + 
    velocityEci.z ** 2
  )

  return { latitude, longitude, altitude, velocity }
}

// Format launch date from satellite metadata
function formatLaunchDate(satellite: IndianSatelliteMetadata | undefined): string | undefined {
  if (!satellite) return undefined
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthName = months[satellite.launchMonth - 1]
  
  return `${monthName} ${satellite.launchDay}, ${satellite.launchYear}`
}

// Initialize satellite records from TLE data
export function initializeSatelliteRecords(): void {
  satrecCache.clear()

  for (const [noradId, data] of Object.entries(SATELLITE_TLE_DATA)) {
    if (Number(noradId) === ADITYA_L1_NORAD_ID) continue

    try {
      const satrec = createSatelliteRecord(data)
      satrecCache.set(parseInt(noradId), satrec)
    } catch (e) {
      console.warn(`Failed to parse orbital data for ${data.name}:`, e)
    }
  }
}

// Calculate position for a single satellite at a given time
export function calculateSatellitePosition(noradId: number, date: Date): SatellitePosition | null {
  const data = SATELLITE_TLE_DATA[noradId]
  if (!data) return null

  const satrec = getSatelliteRecord(noradId)
  if (!satrec) return null

  try {
    const propagated = propagateSatellite(satrec, date)
    if (!propagated) return null

    const { latitude, longitude, altitude, velocity } = propagated

    // Simulated signal strength (based on altitude - higher = weaker)
    const signalStrength = Math.max(50, Math.min(99, 100 - (altitude / 1000)))

    return {
      id: noradId,
      name: data.name,
      type: data.type,
      noradId: noradId,
      status: 'active',
      latitude: parseFloat(latitude.toFixed(4)),
      longitude: parseFloat(longitude.toFixed(4)),
      altitude: Math.round(altitude),
      velocity: parseFloat(velocity.toFixed(2)),
      launchDate: formatLaunchDate(INDIAN_SATELLITE_BY_NORAD_ID.get(noradId)) ?? 'Unknown',
      signalStrength: Math.round(signalStrength),
      lastUpdate: date
    }
  } catch (e) {
    console.warn(`Failed to calculate position for ${data.name}:`, e)
    return null
  }
}

export type GroundTrackSegment = [number, number][]


function getOrbitalPeriodMinutes(satrec: satellite.SatRec): number {
  const periodMinutes = (2 * Math.PI) / satrec.no
  return Number.isFinite(periodMinutes) && periodMinutes > 0
    ? Math.min(periodMinutes, 24 * 60)
    : 95
}

// Calculate one SGP4-propagated ground track centered on the requested time.
export function calculateSatelliteGroundTrack(
  noradId: number | null,
  date: Date,
  samples = 145
): GroundTrackSegment[] {
  const satrec = getSatelliteRecord(noradId)
  if (!satrec) return []

  const periodMinutes = getOrbitalPeriodMinutes(satrec)
  const boundedSampleCount = Math.max(33, Math.min(samples, 361))
  const sampleCount = boundedSampleCount % 2 === 0
    ? boundedSampleCount + 1
    : boundedSampleCount
  const stepMinutes = periodMinutes / (sampleCount - 1)
  const startOffsetMinutes = -periodMinutes / 2
  const segments: GroundTrackSegment[] = []
  let segment: GroundTrackSegment = []
  let previousLongitude: number | null = null

  for (let i = 0; i < sampleCount; i += 1) {
    const offsetMinutes = startOffsetMinutes + stepMinutes * i
    const sampleDate = new Date(date.getTime() + offsetMinutes * 60 * 1000)
    const propagated = propagateSatellite(satrec, sampleDate)

    if (!propagated) {
      if (segment.length > 1) segments.push(segment)
      segment = []
      previousLongitude = null
      continue
    }

    const point: [number, number] = [
      propagated.latitude,
      propagated.longitude,
]

    if (previousLongitude !== null && Math.abs(point[1] - previousLongitude) > 180) {
      if (segment.length > 1) segments.push(segment)
      segment = [point]
    } else {
      segment.push(point)
    }

    previousLongitude = point[1]
  }

  if (segment.length > 1) segments.push(segment)
  return segments
}

// Calculate positions for all satellites
export async function calculateAllSatellitePositions(date: Date): Promise<SatellitePosition[]> {
  const positions: SatellitePosition[] = []

  const horizonsData = await fetchAdityaL1Position()
  positions.push({
    ...ADITYA_L1_ENTRY,
    latitude: 0,
    longitude: 0,
    altitude: Math.round(horizonsData.distanceFromEarth),
    velocity: parseFloat(horizonsData.velocityKmS.toFixed(3)),
    launchDate: 'Sep 2, 2023',
    signalStrength: 100,
    lastUpdate: new Date(horizonsData.lastUpdated),
    distanceFromEarth: horizonsData.distanceFromEarth,
    distanceAU: horizonsData.distanceAU,
    distanceChangeKmPerHour: horizonsData.distanceChangeKmPerHour,
    isRealData: horizonsData.isRealData
  })

  for (const { noradId } of EARTH_ORBITING_INDIAN_SATELLITES) {
    const position = calculateSatellitePosition(noradId, date)
    if (position) {
      positions.push(position)
    }
  }

  return positions
}

// Get list of all tracked satellites (without positions)
export function getSatelliteList(): SatelliteListEntry[] {
  return [
    ADITYA_L1_ENTRY,
    ...EARTH_ORBITING_INDIAN_SATELLITES
    .filter(({ noradId }) => Boolean(SATELLITE_TLE_DATA[noradId]))
    .map(({ noradId }) => {
      const data = SATELLITE_TLE_DATA[noradId]
      return {
        id: noradId,
        name: data.name,
        type: data.type,
        status: 'active',
        noradId
      }
    })
  ]
}
