import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents, CircleMarker, Tooltip } from 'react-leaflet'
import type { PathOptions, LeafletMouseEvent, LatLngBoundsExpression } from 'leaflet'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { bretagne } from '@/data/geoData'
import type { DeptCode } from '@/types'
import { makeColorScale } from '@/utils/colors'
import type { CommuneResponse, CodePostalResponse, MutationResponse } from '@/data/api'
import { fetchCommuneSections, fetchSectionParcelles } from '@/data/api'
import type { GeoFeatureResponse } from '@/data/api'

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
  selectedSectionId: string | null
  onSectionSelect: (sectionId: string) => void
  onParcelleSelect: (parcelleId: string) => void
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

// ── Geometry helpers ──────────────────────────────────────────────────────────

type Coord = [number, number]

/** Iterate all coordinate pairs in a GeoJSON geometry. */
function* iterCoords(geometry: Geometry): Generator<Coord> {
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates)
      for (const c of ring) yield c as Coord
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates)
      for (const ring of poly)
        for (const c of ring) yield c as Coord
  }
}

/** Bounding box of a geometry. */
function bbox(geometry: Geometry): [number, number, number, number] {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const [lon, lat] of iterCoords(geometry)) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return [minLon, minLat, maxLon, maxLat]
}

/** Ray-casting point-in-polygon for a single ring. */
function pointInRing([x, y]: Coord, ring: Coord[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function pointInGeometry(pt: Coord, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') {
    return pointInRing(pt, geometry.coordinates[0] as Coord[])
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Coord[][][]).some(poly =>
      pointInRing(pt, poly[0])
    )
  }
  return false
}

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
      // SectionsLayer will fitBounds once it loads; use a medium zoom as interim fallback
      const [lon, lat] = selectedCommune.coordinates
      map.setView([lat, lon], 13, { animate: true })
    } else if (selectedDept === 'all') {
      map.setView(BRETAGNE_CENTER, BRETAGNE_ZOOM, { animate: true })
    } else {
      const bounds = DEPT_BOUNDS[selectedDept]
      if (bounds) map.fitBounds(bounds, { padding: [60, 60], animate: true })
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

  const { deptMedian, colorFn } = useMemo(() => {
    const deptPrices: Record<string, number[]> = {}
    for (const c of communes) {
      if (!deptPrices[c.departmentCode]) deptPrices[c.departmentCode] = []
      deptPrices[c.departmentCode].push(c.pricePerSqm)
    }
    const med: Record<string, number> = {}
    for (const [code, prices] of Object.entries(deptPrices)) {
      const s = [...prices].sort((a, b) => a - b)
      med[code] = s[Math.floor(s.length / 2)] ?? 0
    }
    return {
      deptMedian: med,
      colorFn: makeColorScale(Object.values(med)),
    }
  }, [communes])

  const totalTx = communes.reduce((s, c) => s + c.transactions, 0)
  const geoKey = `dept-${selectedDept}-${communes.length}-${totalTx}`

  function style(feature?: Feature): PathOptions {
    if (!feature?.properties) return {}
    const code = feature.properties.code as string
    const isSelected = selectedDept !== 'all' && selectedDept === code
    const isOtherDept = selectedDept !== 'all' && selectedDept !== code
    const median = deptMedian[code]
    const color = median ? colorFn(median) : '#e5e7eb'
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
      mouseout() { layer.setStyle(style(feature)) },
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

// ── Commune choropleth layer ──────────────────────────────────────────────────

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

  const { communeByCode, cpByCode, colorFn } = useMemo(() => {
    const byCode: Record<string, CommuneResponse> = {}
    for (const c of communes) byCode[c.id] = c
    const byCp: Record<string, CodePostalResponse> = {}
    for (const cp of codePostaux) byCp[cp.code] = cp

    const prices = isCPMode
      ? codePostaux.map(cp => cp.pricePerSqm)
      : communes.map(c => c.pricePerSqm)

    return { communeByCode: byCode, cpByCode: byCp, colorFn: makeColorScale(prices) }
  }, [communes, codePostaux, isCPMode])

  const totalTx = isCPMode
    ? codePostaux.reduce((s, cp) => s + cp.transactions, 0)
    : communes.reduce((s, c) => s + c.transactions, 0)
  const geoKey = `communes-${isCPMode ? 'cp' : 'commune'}-${totalTx}-${communes.length}`

  function getPrice(feature: Feature): number {
    const code = feature.properties?.code as string
    if (isCPMode) {
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
    const color = prix > 0 ? colorFn(prix) : '#e5e7eb'
    return {
      fillColor: color,
      fillOpacity: isSelected ? 0.20 : 0.72,
      color: isSelected ? '#09090b' : 'rgba(255,255,255,0.7)',
      weight: isSelected ? 2 : 0.8,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: Feature, layer: any) {
    const code = feature.properties?.code as string

    if (isCPMode) {
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

// ── Sections cadastrales layer — fetches pre-computed prices from API ─────────

function SectionsLayer({
  selectedCommune,
  filters,
  selectedSectionId,
  onSectionSelect,
}: {
  selectedCommune: CommuneResponse
  filters: MapFilters
  selectedSectionId: string | null
  onSectionSelect: (sectionId: string) => void
}) {
  const map = useMap()
  const [sectionsGeo, setSectionsGeo] = useState<GeoFeatureResponse | null>(null)

  useEffect(() => {
    setSectionsGeo(null)
    fetchCommuneSections(selectedCommune.id, {
      annee: filters.annee,
      type: filters.typeBien as 'all' | 'Maison' | 'Appartement',
    })
      .then(data => {
        setSectionsGeo(data)
        // Fit map to commune sections bounds
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
        for (const feat of data.features) {
          if (!feat.geometry) continue
          for (const [lon, lat] of iterCoords(feat.geometry as Geometry)) {
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
            if (lon < minLon) minLon = lon
            if (lon > maxLon) maxLon = lon
          }
        }
        if (minLat !== Infinity)
          map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [40, 40], animate: true })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommune.id, filters.annee, filters.typeBien])

  const colorFn = useMemo(() => {
    if (!sectionsGeo) return makeColorScale([])
    return makeColorScale(
      sectionsGeo.features
        .map(f => f.properties.prix_median_m2)
        .filter((p): p is number => p !== null && p > 0)
    )
  }, [sectionsGeo])

  if (!sectionsGeo || sectionsGeo.features.length === 0) return null

  const geoKey = `sections-${selectedCommune.id}-${filters.annee}-${filters.typeBien}-${selectedSectionId}`

  function style(feature?: Feature): PathOptions {
    if (!feature) return {}
    const prix = feature.properties?.prix_median_m2 as number | null
    const isSelected = selectedSectionId === (feature.properties?.id as string)
    return {
      fillColor: prix ? colorFn(prix) : '#f1f5f9',
      fillOpacity: prix ? (isSelected ? 0.9 : 0.72) : 0.2,
      color: isSelected ? '#09090b' : 'rgba(255,255,255,0.8)',
      weight: isSelected ? 2 : 1,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: Feature, layer: any) {
    const id = feature.properties?.id as string
    const prix = feature.properties?.prix_median_m2 as number | null
    const nb = feature.properties?.nb_transactions as number ?? 0
    const tooltip = prix
      ? `<div style="font-size:12px">
           <strong>Section ${id.slice(-2)}</strong><br/>
           ${prix.toLocaleString('fr-FR')} €/m²<br/>
           <span style="color:#71717a">${nb.toLocaleString('fr-FR')} vente${nb > 1 ? 's' : ''}</span>
         </div>`
      : `<div style="font-size:12px"><strong>Section ${id.slice(-2)}</strong><br/><span style="color:#71717a">Pas de données</span></div>`
    layer.bindTooltip(tooltip, { sticky: true, opacity: 1 })
    layer.on({
      mouseover(e: LeafletMouseEvent) {
        e.target.setStyle({ fillOpacity: 0.92, weight: 2, color: '#09090b' })
        e.target.bringToFront()
      },
      mouseout() { layer.setStyle(style(feature)) },
      click() { onSectionSelect(id) },
    })
  }

  return (
    <GeoJSON
      key={geoKey}
      data={sectionsGeo as unknown as FeatureCollection}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

// ── Parcelles layer — shown when a section is selected ────────────────────────

function ParcellesLayer({
  sectionId,
  filters,
  onParcelleSelect,
}: {
  sectionId: string
  filters: MapFilters
  onParcelleSelect: (parcelleId: string) => void
}) {
  const map = useMap()
  const [parcellesGeo, setParcellesGeo] = useState<GeoFeatureResponse | null>(null)

  useEffect(() => {
    setParcellesGeo(null)
    fetchSectionParcelles(sectionId, {
      annee: filters.annee,
      type: filters.typeBien as 'all' | 'Maison' | 'Appartement',
    })
      .then(data => {
        setParcellesGeo(data)
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
        for (const feat of data.features) {
          if (!feat.geometry) continue
          for (const [lon, lat] of iterCoords(feat.geometry as Geometry)) {
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
            if (lon < minLon) minLon = lon
            if (lon > maxLon) maxLon = lon
          }
        }
        if (minLat !== Infinity)
          map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [20, 20], animate: true })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, filters.annee, filters.typeBien])

  const colorFn = useMemo(() => {
    if (!parcellesGeo) return makeColorScale([])
    return makeColorScale(
      parcellesGeo.features
        .map(f => f.properties.prix_median_m2)
        .filter((p): p is number => p !== null && p > 0)
    )
  }, [parcellesGeo])

  if (!parcellesGeo || parcellesGeo.features.length === 0) return null

  function style(feature?: Feature): PathOptions {
    if (!feature) return {}
    const prix = feature.properties?.prix_median_m2 as number | null
    return {
      fillColor: prix ? colorFn(prix) : '#f1f5f9',
      fillOpacity: prix ? 0.75 : 0.2,
      color: 'rgba(255,255,255,0.7)',
      weight: 0.8,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: Feature, layer: any) {
    const id = feature.properties?.id as string
    const prix = feature.properties?.prix_median_m2 as number | null
    const nb = feature.properties?.nb_transactions as number ?? 0
    const tooltip = prix
      ? `<div style="font-size:12px">
           <strong>${prix.toLocaleString('fr-FR')} €/m²</strong><br/>
           <span style="color:#71717a">${nb} vente${nb > 1 ? 's' : ''} · cliquer pour détails</span>
         </div>`
      : `<div style="font-size:12px"><span style="color:#71717a">Pas de transactions · cliquer pour détails</span></div>`
    layer.bindTooltip(tooltip, { sticky: true, opacity: 1 })
    layer.on({
      mouseover(e: LeafletMouseEvent) {
        e.target.setStyle({ fillOpacity: 0.95, weight: 1.5, color: '#09090b' })
        e.target.bringToFront()
      },
      mouseout() { layer.setStyle(style(feature)) },
      click() { onParcelleSelect(id) },
    })
  }

  return (
    <GeoJSON
      key={`parcelles-${sectionId}-${filters.annee}-${filters.typeBien}`}
      data={parcellesGeo as unknown as FeatureCollection}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

// ── H3 hexagonal layer (ultra-zoom, dept level, no commune selected) ──────────

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
    zoomend() { setZoom(map.getZoom()) },
    moveend() { setMoveTick(t => t + 1) },
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
        .then(data => { if (data) setH3GeoJSON(data as FeatureCollection) })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, selectedDept, filters.annee, filters.typeBien, map])

  const colorFn = useMemo(() => {
    if (!h3GeoJSON) return makeColorScale([])
    const prices = h3GeoJSON.features
      .map(f => f.properties?.pricePerSqm as number)
      .filter(Boolean)
    return makeColorScale(prices)
  }, [h3GeoJSON])

  if (!h3GeoJSON || h3GeoJSON.features.length === 0) return null

  function style(feature?: Feature): PathOptions {
    const price = feature?.properties?.pricePerSqm as number
    return {
      fillColor: price ? colorFn(price) : '#e5e7eb',
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
      mouseout() { layer.setStyle(style(feature)) },
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

// ── Individual transaction dots ───────────────────────────────────────────────

function MutationsLayer({ mutations }: { mutations: MutationResponse[] }) {
  const colorFn = useMemo(
    () => makeColorScale(mutations.map(m => m.prix_m2)),
    [mutations]
  )

  if (mutations.length === 0) return null

  return (
    <>
      {mutations.map(m => (
        <CircleMarker
          key={m.id}
          center={[m.latitude, m.longitude]}
          radius={5}
          pathOptions={{
            fillColor: colorFn(m.prix_m2),
            fillOpacity: 0.85,
            color: 'rgba(255,255,255,0.6)',
            weight: 1,
          }}
        >
          <Tooltip sticky>
            <div style={{ fontSize: 12 }}>
              <strong>{m.prix_m2.toLocaleString('fr-FR')} €/m²</strong><br />
              {m.surface} m² · {m.valeur_fonciere.toLocaleString('fr-FR')} €<br />
              <span style={{ color: '#71717a' }}>{m.type_local} · {m.date_mutation}</span>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  )
}

// ── Inner layers ──────────────────────────────────────────────────────────────

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
  selectedSectionId,
  onSectionSelect,
  onParcelleSelect,
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
  selectedSectionId: string | null
  onSectionSelect: (id: string) => void
  onParcelleSelect: (id: string) => void
}) {
  return (
    <>
      {/* Dept outlines — always shown */}
      <DeptLayer
        communes={communes}
        selectedDept={selectedDept}
        onDeptSelect={onDeptSelect}
      />

      {/* Commune choropleth — dept selected */}
      {selectedDept !== 'all' && communeGeoJSON && (
        <CommuneGeoLayer
          communeGeoJSON={communeGeoJSON}
          communes={communes}
          codePostaux={codePostaux}
          selectedCommune={selectedCommune}
          onCommuneSelect={onCommuneSelect}
        />
      )}

      {/* H3 detail — dept selected, NO commune selected, ultra-zoom */}
      {selectedDept !== 'all' && !selectedCommune && (
        <H3Layer selectedDept={selectedDept} filters={filters} />
      )}

      {/* Sections — commune selected */}
      {selectedCommune && (
        <SectionsLayer
          selectedCommune={selectedCommune}
          filters={filters}
          selectedSectionId={selectedSectionId}
          onSectionSelect={onSectionSelect}
        />
      )}

      {/* Parcelles — section selected */}
      {selectedSectionId && (
        <ParcellesLayer
          sectionId={selectedSectionId}
          filters={filters}
          onParcelleSelect={onParcelleSelect}
        />
      )}
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
  mutations,
  loadingMutations,
  selectedSectionId,
  onSectionSelect,
  onParcelleSelect,
}: MapProps) {
  const noTransactions =
    selectedCommune !== null &&
    !loadingMutations &&
    mutations.length === 0

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

      {/* No-transactions notice */}
      {noTransactions && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #e4e4e7',
            borderRadius: 8,
            padding: '10px 18px',
            zIndex: 2000,
            fontSize: 13,
            color: '#71717a',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Aucune transaction pour cette sélection
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
          mutations={mutations}
          selectedSectionId={selectedSectionId}
          onSectionSelect={onSectionSelect}
          onParcelleSelect={onParcelleSelect}
        />
      </MapContainer>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
