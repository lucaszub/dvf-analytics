import { useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import type { PathOptions, LeafletMouseEvent } from 'leaflet'
import type { Feature } from 'geojson'
import { bretagne } from '@/data/geoData'
import type { DeptStats, Filters } from '@/types'
import { priceColor } from '@/utils/colors'

interface MapProps {
  deptStats: DeptStats[]
  filters: Filters
}

function MapController({ filters }: { filters: Filters }) {
  const map = useMap()
  useEffect(() => {
    if (filters.departement === 'all') {
      map.setView([48.2, -3.0], 8)
    }
  }, [filters.departement, map])
  return null
}

function MapLayers({ deptStats, filters }: MapProps) {
  const map = useMap()
  const statsMap = Object.fromEntries(deptStats.map(d => [d.code, d]))
  const prices = deptStats.map(d => d.prixMedian).filter(p => p > 0)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)

  function style(feature?: Feature): PathOptions {
    if (!feature?.properties) return {}
    const code = feature.properties.code as string
    const stats = statsMap[code]
    const isSelected = filters.departement !== 'all' && filters.departement === code
    const color = stats ? priceColor(stats.prixMedian, minP, maxP) : '#e5e7eb'
    return {
      fillColor: color,
      fillOpacity: isSelected ? 0.80 : 0.65,
      color: isSelected ? '#09090b' : 'rgba(255,255,255,0.85)',
      weight: isSelected ? 2 : 1,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: Feature, layer: any) {
    const code  = feature.properties?.code as string
    const nom   = feature.properties?.nom  as string
    const stats = statsMap[code]

    if (stats) {
      layer.bindTooltip(
        `<div class="dept-tooltip">
          <p style="font-size:10px;font-weight:500;color:#71717a;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 5px">${nom}</p>
          <p style="font-size:22px;font-weight:700;color:#09090b;margin:0;line-height:1.1">
            ${stats.prixMedian.toLocaleString('fr-FR')}
            <span style="font-size:12px;color:#a1a1aa;font-weight:400;margin-left:2px">€/m²</span>
          </p>
          <div style="height:1px;background:#f4f4f5;margin:7px 0 6px"></div>
          <p style="font-size:11px;color:#71717a;margin:0">
            <span style="color:#09090b;font-weight:500">${stats.nbTransactions.toLocaleString('fr-FR')}</span> transactions
          </p>
        </div>`,
        { sticky: true, opacity: 1, className: '' }
      )
    }

    layer.on({
      mouseover(e: LeafletMouseEvent) {
        e.target.setStyle({ fillOpacity: 0.88, weight: 2, color: '#09090b' })
        e.target.bringToFront()
      },
      mouseout() { layer.setStyle(style(feature)) },
      click(e: LeafletMouseEvent) {
        map.fitBounds(e.target.getBounds(), { padding: [80, 80] })
      },
    })
  }

  return (
    <GeoJSON
      key={`${filters.departement}-${filters.typeBien}-${filters.annee}`}
      data={bretagne}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

export function Map({ deptStats, filters }: MapProps) {
  return (
    <div className="absolute inset-0">
      <MapContainer
        center={[48.2, -3.0]}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <MapController filters={filters} />
        <MapLayers deptStats={deptStats} filters={filters} />
      </MapContainer>
    </div>
  )
}
