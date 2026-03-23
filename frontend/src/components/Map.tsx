import { useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import type { PathOptions, LeafletMouseEvent } from 'leaflet'
import type { Feature } from 'geojson'
import { bretagne } from '@/data/geoData'
import type { DeptStats, Filters } from '@/types'
import { priceColor } from '@/utils/colors'
import { Badge } from '@/components/ui/badge'

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
    const color = stats ? priceColor(stats.prixMedian, minP, maxP) : '#e0e0e0'
    return {
      fillColor: color,
      fillOpacity: isSelected ? 0.82 : 0.68,
      // Bordure fine blanche entre départements — style choroplèthe data.gouv.fr
      color: isSelected ? '#FF385C' : 'rgba(255,255,255,0.9)',
      weight: isSelected ? 2.5 : 1,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: Feature, layer: any) {
    const code = feature.properties?.code as string
    const nom  = feature.properties?.nom  as string
    const stats = statsMap[code]

    if (stats) {
      layer.bindTooltip(
        `<div class="dept-tooltip">
          <p style="font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px">${nom}</p>
          <p style="font-size:26px;font-weight:700;color:#FF385C;margin:0;line-height:1">
            ${stats.prixMedian.toLocaleString('fr-FR')}
            <span style="font-size:14px;color:#aaa;font-weight:400;margin-left:2px">€/m²</span>
          </p>
          <div style="height:1px;background:#f0f0f0;margin:8px 0 6px"></div>
          <p style="font-size:12px;color:#666;margin:0">
            ${stats.nbTransactions.toLocaleString('fr-FR')} <span style="color:#999">transactions</span>
          </p>
        </div>`,
        { sticky: true, opacity: 1, className: '' }
      )
    }

    layer.on({
      mouseover(e: LeafletMouseEvent) {
        e.target.setStyle({
          fillOpacity: 0.9,
          weight: 2.5,
          color: '#FF385C',
        })
        e.target.bringToFront()
      },
      mouseout() {
        layer.setStyle(style(feature))
      },
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
    <div className="relative flex-1 h-full">
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

      {/* Badges contexte */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2 pointer-events-none">
        <Badge variant="secondary" className="bg-white/95 text-foreground border shadow-sm text-xs font-medium">
          {filters.annee === 'all' ? '2018 – 2024' : filters.annee}
        </Badge>
        <Badge variant="secondary" className="bg-white/95 text-foreground border shadow-sm text-xs font-medium">
          {filters.typeBien === 'all' ? 'Tous types' : filters.typeBien}
        </Badge>
        {filters.departement !== 'all' && (
          <Badge className="bg-primary text-primary-foreground text-xs font-medium shadow-sm">
            Dept. {filters.departement}
          </Badge>
        )}
      </div>
    </div>
  )
}
