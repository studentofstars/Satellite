import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Popup, Polyline, useMap, useMapEvents, Marker } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import L from 'leaflet'
import { Home } from 'lucide-react'
import satIconUrl from '../assets/satellite-icon.svg'
import 'leaflet/dist/leaflet.css'
import { calculateSatelliteGroundTrack } from '../lib/satelliteTracker'
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY

interface SatellitePosition {
  id: number | string
  name: string
  type: string
  noradId: number | null
  status: string
  latitude: number
  longitude: number
  altitude: number
  velocity: number
  launchDate?: string
  signalStrength?: number
  lastUpdate?: Date
  isDeepSpace?: boolean
}

interface SatelliteMapProps {
  satellites: SatellitePosition[]
  selectedSatellite: SatellitePosition | null
  onSelectSatellite: (sat: SatellitePosition) => void
  onHome?: () => void
}

const INITIAL_MAP_CENTER: [number, number] = [20.5937, 78.9629]
const INITIAL_MAP_ZOOM = 2

const getSatelliteColor = (status: string) => {
  const color = status === 'active' ? '#00ff41' : status === 'maintenance' ? '#ffea00' : '#ff0040'
  return color
}

// Component to handle map view updates
function MapController({ selectedSatellite }: { selectedSatellite: SatellitePosition | null }) {
  const map = useMap()
  const previousSelectedId = useRef<number | string | null>(null)
  
  useEffect(() => {
    if (!selectedSatellite || selectedSatellite.isDeepSpace) {
      previousSelectedId.current = null
      return
    }
    if (previousSelectedId.current === selectedSatellite.id) return

    previousSelectedId.current = selectedSatellite.id
    map.flyTo([selectedSatellite.latitude, selectedSatellite.longitude], Math.max(map.getZoom(), 5), {
      duration: 0.8
    })
  }, [selectedSatellite?.id, selectedSatellite?.latitude, selectedSatellite?.longitude, map])
  
  return null
}

function ZoomActivityController({
  setIsZooming,
  setZoomLevel
}: {
  setIsZooming: (isZooming: boolean) => void
  setZoomLevel: (zoomLevel: number) => void
}) {
  const map = useMapEvents({
    zoomstart: () => setIsZooming(true),
    zoomend: () => {
      setZoomLevel(map.getZoom())
      setIsZooming(false)
    }
  })

  useEffect(() => {
    setZoomLevel(map.getZoom())
  }, [map, setZoomLevel])

  return null
}

export default function SatelliteMap({ satellites, selectedSatellite, onSelectSatellite, onHome }: SatelliteMapProps) {
  const mapRef = useRef<LeafletMap | null>(null)
  const [isZooming, setIsZooming] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(2)

  const trackedSatellite = selectedSatellite
    ? satellites.find((sat) => sat.id === selectedSatellite.id) ?? selectedSatellite
    : null
  const selectedSatelliteIcon = useMemo(
    () =>
      L.divIcon({
        className: 'satellite-img',
        html: `
          <div class="satellite-img__inner">
            <img src="${satIconUrl}" alt="" />
          </div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      }),
    []
  )
  
  
const orbitPath = useMemo(() => {
  if (!trackedSatellite || trackedSatellite.isDeepSpace) return []

  return calculateSatelliteGroundTrack(
    trackedSatellite.noradId,
    trackedSatellite.lastUpdate ?? new Date(),
    145
  )
}, [
  trackedSatellite?.noradId,
  trackedSatellite?.lastUpdate,
  trackedSatellite?.latitude,
  trackedSatellite?.longitude
])


  const handleHomeClick = () => {
    const map = mapRef.current
    if (map) {
      map.closePopup()
      map.setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM, { animate: true })
    }
    onHome?.()
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-green-900/50">
      {/* Map Legend */}
      <div className="absolute top-2 right-2 z-[1000] bg-black/80 p-3 rounded border border-green-900/50 text-xs">
        <div className="text-green-400 font-bold mb-2">SATELLITE STATUS</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_#00ff41]"></span>
          <span className="text-green-400">Active</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_#ffea00]"></span>
          <span className="text-yellow-400">Maintenance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_8px_#ff0040]"></span>
          <span className="text-red-400">Critical</span>
        </div>
      </div>

      {/* Satellite Count */}
      <div className="absolute top-2 left-2 z-[1000] bg-black/80 px-3 py-2 rounded border border-green-900/50">
        <span className="text-green-400 text-xs font-bold">
          {satellites.length} SATELLITES TRACKED
        </span>
      </div>

      <MapContainer
        center={INITIAL_MAP_CENTER}
        zoom={INITIAL_MAP_ZOOM}
        style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
        ref={mapRef}
        worldCopyJump={true}
        minZoom={2}
        maxZoom={10}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | &copy; <a href="https://carto.com/">CARTO</a>'
          url={`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`}
        />

        {/* Map controller for animations */}
        <MapController selectedSatellite={trackedSatellite} />
        <ZoomActivityController setIsZooming={setIsZooming} setZoomLevel={setZoomLevel} />

        {/* Orbit path for selected satellite */}
        {trackedSatellite && orbitPath.map((segment, index) => (
          <Polyline
            key={`${trackedSatellite.id}-${index}`}
            positions={segment}
            pathOptions={{
              color: '#00ff41',
              weight: zoomLevel >= 6 ? 1.5 : 1.2,
              opacity: zoomLevel >= 6 ? 0.22 : 0.42,
              dashArray: zoomLevel >= 6 ? '3, 14' : '6, 10',
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        ))}

        {/* Satellite markers */}
        {satellites.filter((sat) => !sat.isDeepSpace).map((sat) => {
          const isSelected = trackedSatellite?.id === sat.id
          if (isZooming && !isSelected) return null

          const color = getSatelliteColor(sat.status)

          return [
            <CircleMarker
              key={`${sat.id}-hit-area`}
              center={[sat.latitude, sat.longitude]}
              radius={16}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.01,
                opacity: 0,
                weight: 0,
                className: 'satellite-hit-area'
              }}
              eventHandlers={{
                click: () => onSelectSatellite(sat)
              }}
            />,
            // Replace dot with a custom icon Marker when selected
            isSelected ? (
              <Marker
                key={sat.id}
                position={[sat.latitude, sat.longitude]}
                icon={selectedSatelliteIcon}
                zIndexOffset={1000}
                eventHandlers={{ click: () => onSelectSatellite(sat) }}
              >
                <Popup className="satellite-popup">
                  <div className="bg-black/90 text-green-400 p-2 rounded min-w-[200px]">
                    <div className="font-bold text-sm mb-2 border-b border-green-900/50 pb-1">
                      🛰️ {sat.name}
                    </div>
                    <div className="text-xs space-y-1">
                      <div><span className="text-green-600">Type:</span> {sat.type}</div>
                      <div><span className="text-green-600">NORAD:</span> {sat.noradId}</div>
                      <div><span className="text-green-600">Lat:</span> {sat.latitude.toFixed(4)}°</div>
                      <div><span className="text-green-600">Lng:</span> {sat.longitude.toFixed(4)}°</div>
                      <div><span className="text-green-600">Alt:</span> {sat.altitude.toLocaleString()} km</div>
                      <div><span className="text-green-600">Vel:</span> {sat.velocity} km/s</div>
                      <div className="pt-1 border-t border-green-900/50 mt-1">
                        <span className={`uppercase font-bold ${
                          sat.status === 'active' ? 'text-green-400' :
                          sat.status === 'maintenance' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          ● {sat.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ) : (
              <CircleMarker
                key={sat.id}
                center={[sat.latitude, sat.longitude]}
                radius={6}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 1,
                  opacity: 1,
                  weight: 1,
                  className: 'satellite-dot'
                }}
                eventHandlers={{ click: () => onSelectSatellite(sat) }}
              />
            )
          ]
        })}
      </MapContainer>

      <button
        type="button"
        onClick={handleHomeClick}
        className="absolute bottom-[34px] right-2 z-[1000] flex h-10 w-10 items-center justify-center rounded border border-green-900/60 bg-black/85 text-green-300 shadow-[0_0_12px_rgba(0,255,65,0.18)] transition hover:border-green-500 hover:bg-green-500/10"
        aria-label="Reset map view"
        title="Reset map view"
      >
        <Home className="h-4 w-4" />
      </button>

      {/* Ground Track Info */}
      {trackedSatellite && !trackedSatellite.isDeepSpace && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-black/80 px-3 py-2 rounded border border-green-900/50 text-xs">
          <span className="text-green-600">TRACKING: </span>
          <span className="text-green-400 font-bold">{trackedSatellite.name}</span>
          <span className="text-green-600 ml-2">| ALT: </span>
          <span className="text-green-400">{trackedSatellite.altitude.toLocaleString()} km</span>
        </div>
      )}

      {/* CSS for custom styling */}
      <style>{`
        .leaflet-container {
          background: #0a0a0f !important;
          font-family: 'JetBrains Mono', monospace;
        }
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip {
          background: rgba(0, 0, 0, 0.9) !important;
        }
        .satellite-dot {
          filter: drop-shadow(0 0 5px currentColor) drop-shadow(0 0 10px currentColor);
          cursor: pointer;
        }
        .satellite-hit-area {
          cursor: pointer;
        }
        .satellite-dot-selected {
          animation: satellite-glow 1.5s ease-in-out infinite;
        }
        .satellite-img {
          background: transparent !important;
          border: 0 !important;
        }
        .satellite-img__inner {
          height: 42px;
          width: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 0 8px #00ff41) drop-shadow(0 0 16px rgba(0, 255, 65, 0.45));
          animation: satellite-pulse 1.6s ease-in-out infinite;
          will-change: transform, filter, opacity;
        }
        .satellite-img__inner img {
          display: block;
          height: 100%;
          width: 100%;
        }
        @keyframes satellite-pulse {
          0%,100% { transform: scale(1); }
          50% {
            transform: scale(1.08);
            opacity: 0.88;
            filter: drop-shadow(0 0 12px #00ff41) drop-shadow(0 0 20px rgba(0, 255, 65, 0.65));
          }
        }
        @keyframes satellite-glow {
          0%, 100% { opacity: 1; stroke-opacity: 1; fill-opacity: 1; }
          50% { opacity: 0.7; stroke-opacity: 0.9; fill-opacity: 0.75; }
        }
        .leaflet-control-zoom a {
          background: rgba(0, 0, 0, 0.8) !important;
          color: #00ff41 !important;
          border-color: #00ff4130 !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(0, 255, 65, 0.2) !important;
        }
        .leaflet-control-attribution {
          background: rgba(0, 0, 0, 0.6) !important;
          color: #00ff4180 !important;
        }
        .leaflet-control-attribution a {
          color: #00ff41 !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
