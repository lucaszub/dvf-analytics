import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents, CircleMarker, Tooltip } from 'react-leaflet'
import type { PathOptions, LeafletMouseEvent, LatLngBoundsExpression } from 'leaflet'
import type { Feature, FeatureCollection } from 'geojson'
import { bretagne } from '@/data/geoData'
import type { DeptCode } from '@/types'
import { priceColor } from '@/utils/colors'
import type { CommuneResponse, CodePostalResponse, MutationResponse } from '@/data/api'

interface MapFilters {
  annee: number | 'all'
  typeBien: string
}

interface MapProps {
  communes: CommuneResponse[]
  codePostaux: CodePostalResponse[]
  communeGeoJSON: FeatureCollection | null
  selectedDept: DeptCode | 'all'
  selectedCommune: CommuneResponse | null
  onDeptSelect: (dept: DeptCode | 'all') => void
  onCommuneSelect: (commune: CommuneResponse) => void
  filters: MapFilters
  loading?: boolean
  mutations: MutationResponse[]
  loadingMutations?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPT_BOUNDS: Record<DeptCode, LatLngBoundsExpression> = {
  '22': [[47.9, -3.7], [48.8, -1.5]],
  '29': [[47.6, -5.1], [48.8, -3.0]],
  '35': [[47.6, -2.1], [48.7, -0.9]],
  '56': [[47.2, -3.8], [48.2, -1.7]],
}

const BRETAGNE_CENTER: [number, number] = [48.2, -3.0]
const BRETAGNE_ZOOM = 8

// ── MapController — handles fly/zoom on dept or commune change ────────────────

function MapController({
  selectedDept,
  selectedCommune,
}: {
  selectedDept: DeptCode | 'all'
  selectedCommune: CommuneResponse | null
}) {
  const map = useMap()

  useEffect(() => {
    if (selectedCommune) {
      const [lon, lat] = selectedCommune.coordinates
      map.setView([lat, lon], 13, { animate: true })
    } else if (selectedDept === 'all') {
      map.setView(BRETAGNE_CENTER, BRETAGNE_ZOOM, { animate: true })
    } else {
      const bounds = DEPT_BOUNDS[selectedDept]
      if (bounds) {
        map.fitBounds(bounds, { padding: [60, 60], animate: true })
      }
    }
  }, [selectedDept, selectedCommune, map])

  return null
}

// ── Department choropleth layer ───────────────────────────────────────────────

function DeptLayer({
  communes,
  selectedDept,
  onDeptSelect,
}: {
  communes: CommuneResponse[]
  selectedDept: DeptCode | 'all'
  onDeptSelect: (dept: DeptCode | 'all') => void
}) {
  const map = useMap()

  // Aggregate communes per dept to get median price for coloring
  const deptPrices: Record<string, number[]> = {}
  for (const c of communes) {
    if (!deptPrices[c.departmentCode]) deptPrices[c.departmentCode] = []
    deptPrices[c.departmentCode].push(c.pricePerSqm)
  }

  const deptMedian: Record<string, number> = {}
  for (const [code, prices] of Object.entries(deptPrices)) {
    const sorted = [...prices].sort((a, b) => a - b)
    deptMedian[code] = sorted[Math.floor(sorted.length / 2)] ?? 0
  }

  const totalTx = communes.reduce((s, c) => s + c.transactions, 0)
  const geoKey = `dept-${selectedDept}-${communes.length}-${totalTx}`

  function style(feature?: Feature): PathOptions {
    if (!feature?.properties) return {}
    const code = feature.properties.code as string
    const isSelected = selectedDept !== 'all' && selectedDept === code
    const isOtherDept = selectedDept !== 'all' && selectedDept !== code
    const median = deptMedian[code]
    const color = median ? priceColor(median) : '#e5e7eb'
    return {
      fillColor: color,
      fillOpacity: isSelected ? 0.08 : isOtherDept ? 0.04 : 0.72,
      color: isSelected ? '#09090b' : isOtherDept ? '#d4d4d8' : 'rgba(255,255,255,0.85)',
      weight: isSelected ? 1.5 : isOtherDept ? 0.5 : 1,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: Feature, layer: any) {
    const code = feature.properties?.code as string
    const nom  = feature.properties?.nom  as string
    const median = deptMedian[code]
    const deptCommunes = communes.filter(c => c.departmentCode === code)
    const totalVentes = deptCommunes.reduce((s, c) => s + c.transactions, 0)

    if (median) {
      layer.bindTooltip(
        `<div class="dept-tooltip">
          <p style="font-size:10px;font-weight:500;color:#71717a;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 5px">${nom}</p>
          <p style="font-size:22px;font-weight:700;color:#09090b;margin:0;line-height:1.1">
            ${median.toLocaleString('fr-FR')}
            <span style="font-size:12px;color:#a1a1aa;font-weight:400;margin-left:2px">€/m²</span>
          </p>
          <div style="height:1px;background:#f4f4f5;margin:7px 0 6px"></div>
          <p style="font-size:11px;color:#71717a;margin:0">
            <span style="color:#09090b;font-weight:500">${totalVentes.toLocaleString('fr-FR')}</span> transactions
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
      mouseout() {
        layer.setStyle(style(feature))
      },
      click(e: LeafletMouseEvent) {
        if (selectedDept === 'all') {
          onDeptSelect(code as DeptCode)
          map.fitBounds(e.target.getBounds(), { padding: [60, 60] })
        }
      },
    })
  }

  return (
    <GeoJSON
      key={geoKey}
      data={bretagne}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

// ── Commune GeoJSON choropleth layer (levels 2 & 3) ──────────────────────────
//
// Mode normal  (selectedCommune = null) : couleur par prix commune, clic pour sélection
// Mode CP      (selectedCommune ≠ null) : couleur par prix code postal de chaque commune,
//              commune sélectionnée mise en évidence, pas de clic

function CommuneGeoLayer({
  communeGeoJSON,
  communes,
  codePostaux,
  selectedCommune,
  onCommuneSelect,
}: {
  communeGeoJSON: FeatureCollection
  communes: CommuneResponse[]
  codePostaux: CodePostalResponse[]
  selectedCommune: CommuneResponse | null
  onCommuneSelect: (commune: CommuneResponse) => void
}) {
  const isCPMode = selectedCommune !== null

  // Mode normal — index communes par code INSEE
  const communeByCode: Record<string, CommuneResponse> = {}
  for (const c of communes) communeByCode[c.id] = c

  // Mode CP — index codes postaux par code CP
  const cpByCode: Record<string, CodePostalResponse> = {}
  for (const cp of codePostaux) cpByCode[cp.code] = cp

  const totalTx = isCPMode
    ? codePostaux.reduce((s, cp) => s + cp.transactions, 0)
    : communes.reduce((s, c) => s + c.transactions, 0)
  const geoKey = `communes-${isCPMode ? 'cp' : 'commune'}-${totalTx}-${communes.length}`

  function getPrice(feature: Feature): number {
    const code = feature.properties?.code as string
    if (isCPMode) {
      // Color by first code postal of this commune
      const cps = feature.properties?.codesPostaux as string[] | undefined
      const cp = cps?.map(c => cpByCode[c]).find(Boolean)
      return cp?.pricePerSqm ?? 0
    }
    return communeByCode[code]?.pricePerSqm ?? 0
  }

  function style(feature?: Feature): PathOptions {
    if (!feature) return {}
    const code = feature.properties?.code as string
    const isSelected = selectedCommune?.id === code
    const prix = getPrice(feature)
    const color = prix > 0 ? priceColor(prix) : '#e5e7eb'
    return {
      fillColor: color,
      fillOpacity: isSelected ? 0.85 : isCPMode ? 0.72 : 0.72,
      color: isSelected ? '#09090b' : 'rgba(255,255,255,0.7)',
      weight: isSelected ? 3 : 0.8,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: Feature, layer: any) {
    const code = feature.properties?.code as string

    if (isCPMode) {
      // Tooltip shows code postal price
      const cps = feature.properties?.codesPostaux as string[] | undefined
      const cp = cps?.map(c => cpByCode[c]).find(Boolean)
      const nom = feature.properties?.nom as string
      if (cp) {
        const evo = cp.evolution
        const evoStr = evo !== null ? ` · ${evo >= 0 ? '+' : ''}${evo.toFixed(1)}%` : ''
        layer.bindTooltip(
          `<div style="font-size:12px">
            <strong>${nom}</strong> · CP ${cp.code}<br/>
            ${cp.pricePerSqm.toLocaleString('fr-FR')} €/m²${evoStr}<br/>
            <span style="color:#71717a">${cp.transactions.toLocaleString('fr-FR')} ventes</span>
          </div>`,
          { sticky: true, opacity: 1 }
        )
      }
      layer.on({
        mouseover(e: LeafletMouseEvent) {
          if (selectedCommune?.id !== code)
            e.target.setStyle({ fillOpacity: 0.9, weight: 1.5, color: '#09090b' })
          e.target.bringToFront()
        },
        mouseout() { layer.setStyle(style(feature)) },
      })
    } else {
      // Mode normal — tooltip + clic
      const commune = communeByCode[code]
      if (commune) {
        const evo = commune.evolution
        const evoStr = evo !== null ? ` · ${evo >= 0 ? '+' : ''}${evo.toFixed(1)}%` : ''
        layer.bindTooltip(
          `<div style="font-size:12px">
            <strong>${commune.name}</strong><br/>
            ${commune.pricePerSqm.toLocaleString('fr-FR')} €/m²${evoStr}<br/>
            <span style="color:#71717a">${commune.transactions.toLocaleString('fr-FR')} ventes</span>
          </div>`,
          { sticky: true, opacity: 1 }
        )
        layer.on({
          mouseover(e: LeafletMouseEvent) {
            e.target.setStyle({ fillOpacity: 0.9, weight: 1.5, color: '#09090b' })
            e.target.bringToFront()
          },
          mouseout() { layer.setStyle(style(feature)) },
          click() { onCommuneSelect(commune) },
        })
      }
    }
  }

  return (
    <GeoJSON
      key={geoKey}
      data={communeGeoJSON}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

// ── H3 hexagonal choropleth layer (ultra-zoom ≥ 14 — detail within commune) ──

function H3Layer({
  selectedDept,
  filters,
}: {
  selectedDept: DeptCode | 'all'
  filters: MapFilters
}) {
  const map = useMap()
  const [h3GeoJSON, setH3GeoJSON] = useState<FeatureCollection | null>(null)
  const [zoom, setZoom] = useState(map.getZoom())
  const [, setMoveTick] = useState(0)

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom())
    },
    moveend() {
      setMoveTick(t => t + 1)
    },
  })

  useEffect(() => {
    if (zoom < 14 || selectedDept === 'all') {
      setH3GeoJSON(null)
      return
    }
    const bounds = map.getBounds()
    const resolution = zoom >= 12 ? 9 : 8
    const anneeParam = filters.annee !== 'all' ? `&annee=${filters.annee}` : ''
    const typeParam = filters.typeBien !== 'all' ? `&type=${filters.typeBien.toLowerCase()}` : ''
    const url =
      `/h3/?dept=${selectedDept}` +
      `&min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}` +
      `&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}` +
      `&resolution=${resolution}${anneeParam}${typeParam}`

    const timer = setTimeout(() => {
      fetch(url)
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data) setH3GeoJSON(data as FeatureCollection)
        })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, selectedDept, filters.annee, filters.typeBien, map])

  if (!h3GeoJSON || h3GeoJSON.features.length === 0) return null

  function style(feature?: Feature): PathOptions {
    const price = feature?.properties?.pricePerSqm as number
    return {
      fillColor: price ? priceColor(price) : '#e5e7eb',
      fillOpacity: 0.80,
      color: 'rgba(255,255,255,0.6)',
      weight: 0.5,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: Feature, layer: any) {
    const p = feature.properties
    if (!p) return
    layer.bindTooltip(
      `<div style="font-size:12px">
        <strong>${(p.pricePerSqm as number).toLocaleString('fr-FR')} €/m²</strong><br/>
        <span style="color:#71717a">${p.transactions} ventes</span>
      </div>`,
      { sticky: true, opacity: 1 }
    )
    layer.on({
      mouseover(e: LeafletMouseEvent) {
        e.target.setStyle({ fillOpacity: 0.95, weight: 1, color: '#09090b' })
      },
      mouseout() {
        layer.setStyle(style(feature))
      },
    })
  }

  return (
    <GeoJSON
      key={`h3-${zoom}-${h3GeoJSON.features.length}`}
      data={h3GeoJSON}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

// ── Individual transaction dots layer ─────────────────────────────────────────

function MutationsLayer({ mutations }: { mutations: MutationResponse[] }) {
  if (mutations.length === 0) return null
  return (
    <>
      {mutations.map(m => (
        <CircleMarker
          key={m.id}
          center={[m.latitude, m.longitude]}
          radius={5}
          pathOptions={{
            fillColor: priceColor(m.prix_m2),
            fillOpacity: 0.85,
            color: 'rgba(255,255,255,0.6)',
            weight: 1,
          }}
        >
          <Tooltip sticky>
            <div style={{ fontSize: 12 }}>
              <strong>{m.prix_m2.toLocaleString('fr-FR')} €/m²</strong><br/>
              {m.surface} m² · {m.valeur_fonciere.toLocaleString('fr-FR')} €<br/>
              <span style={{ color: '#71717a' }}>{m.type_local} · {m.date_mutation}</span>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  )
}

// ── Inner layers — rendered inside MapContainer ───────────────────────────────

function MapLayers({
  communes,
  codePostaux,
  communeGeoJSON,
  selectedDept,
  selectedCommune,
  onDeptSelect,
  onCommuneSelect,
  filters,
  mutations,
}: {
  communes: CommuneResponse[]
  codePostaux: CodePostalResponse[]
  communeGeoJSON: FeatureCollection | null
  selectedDept: DeptCode | 'all'
  selectedCommune: CommuneResponse | null
  onDeptSelect: (dept: DeptCode | 'all') => void
  onCommuneSelect: (commune: CommuneResponse) => void
  filters: MapFilters
  mutations: MutationResponse[]
}) {
  return (
    <>
      {/* Level 1 — dept outlines, always shown */}
      <DeptLayer
        communes={communes}
        selectedDept={selectedDept}
        onDeptSelect={onDeptSelect}
      />

      {/* Level 2/3 — commune choropleth (dept selected)
          - sans commune sélectionnée : couleur par prix commune, clic pour drill
          - avec commune sélectionnée : couleur par code postal, commune mise en évidence */}
      {selectedDept !== 'all' && communeGeoJSON && (
        <CommuneGeoLayer
          communeGeoJSON={communeGeoJSON}
          communes={communes}
          codePostaux={codePostaux}
          selectedCommune={selectedCommune}
          onCommuneSelect={onCommuneSelect}
        />
      )}

      {/* Level 4 — H3 détail sub-commune (ultra-zoom ≥ 14 uniquement) */}
      {selectedDept !== 'all' && (
        <H3Layer selectedDept={selectedDept} filters={filters} />
      )}

      {/* Level 5 — individual transaction dots when commune is selected */}
      {selectedCommune && <MutationsLayer mutations={mutations} />}
    </>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

export function Map({
  communes,
  codePostaux,
  communeGeoJSON,
  selectedDept,
  selectedCommune,
  onDeptSelect,
  onCommuneSelect,
  filters,
  loading,
}: MapProps) {
  return (
    <div className="absolute inset-0">
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.55)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid #e4e4e7',
              borderTop: '3px solid #09090b',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      <MapContainer
        center={BRETAGNE_CENTER}
        zoom={BRETAGNE_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <MapController selectedDept={selectedDept} selectedCommune={selectedCommune} />
        <MapLayers
          communes={communes}
          codePostaux={codePostaux}
          communeGeoJSON={communeGeoJSON}
          selectedDept={selectedDept}
          selectedCommune={selectedCommune}
          onDeptSelect={onDeptSelect}
          onCommuneSelect={onCommuneSelect}
          filters={filters}
        />
      </MapContainer>

      {/* Spinner keyframe — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
