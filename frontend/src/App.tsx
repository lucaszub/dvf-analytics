import { useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { Map } from './components/Map'
import { Sidebar } from './components/Sidebar'
import {
  fetchCommunes,
  fetchKpis,
  fetchHistorique,
  fetchCodePostaux,
  fetchMutations,
  fetchParcelleMutations,
} from './data/api'
import type { CommuneResponse, KpisResponse, HistoriquePoint, CodePostalResponse, MutationResponse, ParcelleMutation } from './data/api'
import { MutationPanel } from './components/MutationPanel'
import type { Filters, DeptCode } from './types'
import type { FeatureCollection } from 'geojson'
import { DEPT_NOMS } from './types'

const DEFAULT_FILTERS: Filters = {
  departement: 'all',
  typeBien: 'all',
  annee: 'all',
}

const BUTTON_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: '#ffffff',
  border: '1px solid #e4e4e7',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  color: '#09090b',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const [communes, setCommunes] = useState<CommuneResponse[]>([])
  const [kpis, setKpis] = useState<KpisResponse | null>(null)
  const [historique, setHistorique] = useState<HistoriquePoint[]>([])
  const [selectedCommune, setSelectedCommune] = useState<CommuneResponse | null>(null)
  const [codePostaux, setCodePostaux] = useState<CodePostalResponse[]>([])

  const [communeGeoJSON, setCommuneGeoJSON] = useState<FeatureCollection | null>(null)

  const [mutations, setMutations] = useState<MutationResponse[]>([])
  const [loadingMutations, setLoadingMutations] = useState(false)

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [selectedParcelleId, setSelectedParcelleId] = useState<string | null>(null)
  const [parcelleMutations, setParcelleMutations] = useState<ParcelleMutation[]>([])
  const [loadingParcelleMutations, setLoadingParcelleMutations] = useState(false)

  const [loadingMap, setLoadingMap] = useState(false)
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [loadingCP, setLoadingCP] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null)

  // Fetch communes + KPIs whenever any filter changes
  useEffect(() => {
    setLoadingMap(true)
    setLoadingKpis(true)
    setError(null)

    Promise.all([
      fetchCommunes({
        dept: filters.departement,
        type: filters.typeBien,
        annee: filters.annee,
      }),
      fetchKpis({
        dept: filters.departement,
        type: filters.typeBien,
        annee: filters.annee,
      }),
    ])
      .then(([communesData, kpisData]) => {
        setCommunes(communesData)
        setKpis(kpisData)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setLoadingMap(false)
        setLoadingKpis(false)
      })
  }, [filters])

  // Fetch historique when dept or type changes (no annee — it covers all years)
  useEffect(() => {
    fetchHistorique({
      dept: filters.departement,
      type: filters.typeBien,
    })
      .then(setHistorique)
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [filters.departement, filters.typeBien])

  // When dept filter changes, clear commune + cadastre selection
  useEffect(() => {
    setSelectedCommune(null)
    setSelectedSectionId(null)
    setSelectedParcelleId(null)
  }, [filters.departement])

  // When commune changes, clear cadastre selection
  useEffect(() => {
    setSelectedSectionId(null)
    setSelectedParcelleId(null)
  }, [selectedCommune])

  // When section changes, clear parcelle selection
  useEffect(() => {
    setSelectedParcelleId(null)
  }, [selectedSectionId])

  // Fetch parcelle mutations when a parcelle is selected
  useEffect(() => {
    if (!selectedParcelleId) {
      setParcelleMutations([])
      return
    }
    setLoadingParcelleMutations(true)
    fetchParcelleMutations(selectedParcelleId)
      .then(setParcelleMutations)
      .catch(() => setParcelleMutations([]))
      .finally(() => setLoadingParcelleMutations(false))
  }, [selectedParcelleId])

  // Load commune GeoJSON from local public files when dept is selected
  useEffect(() => {
    if (filters.departement === 'all') {
      setCommuneGeoJSON(null)
      return
    }
    setGeoLoading(true)
    fetch(`/geo/communes-${filters.departement}.geojson`)
      .then(r => r.json())
      .then(geoJson => setCommuneGeoJSON(geoJson as FeatureCollection))
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setGeoLoading(false))
  }, [filters.departement])

  // Filter codePostaux to only those belonging to the selected commune (via GeoJSON mapping)
  const communeFilteredCP = useMemo(() => {
    if (!selectedCommune || !communeGeoJSON || codePostaux.length === 0) return []
    const feature = communeGeoJSON.features.find(
      f => f.properties?.code === selectedCommune.id
    )
    const cpCodes = (feature?.properties?.codesPostaux as string[]) ?? []
    return codePostaux.filter(cp => cpCodes.includes(cp.code))
  }, [selectedCommune, communeGeoJSON, codePostaux])

  // Fetch code postaux when a commune is selected
  useEffect(() => {
    if (!selectedCommune) {
      setCodePostaux([])
      return
    }
    setLoadingCP(true)
    fetchCodePostaux({
      dept: selectedCommune.departmentCode as DeptCode,
      type: filters.typeBien,
      annee: filters.annee,
    })
      .then(setCodePostaux)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingCP(false))
  }, [selectedCommune, filters.typeBien, filters.annee])

  // Fetch individual mutations when a commune is selected
  useEffect(() => {
    if (!selectedCommune) {
      setMutations([])
      return
    }
    setLoadingMutations(true)
    fetchMutations({
      commune: selectedCommune.id,
      type: filters.typeBien,
      annee: filters.annee,
    })
      .then(setMutations)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingMutations(false))
  }, [selectedCommune, filters.typeBien, filters.annee])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header filters={filters} onChange={setFilters} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          communes={communes}
          kpis={kpis}
          historique={historique}
          loading={loadingKpis}
          loadingCP={loadingCP}
          filters={filters}
          selectedCommune={selectedCommune}
          codePostaux={communeFilteredCP}
        />
        <main className="flex-1 relative overflow-hidden" style={{ display: 'flex' }}>
          {/* Breadcrumb navigation — rendered above the map to avoid Leaflet event capture */}
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2000, display: 'flex', gap: 8, alignItems: 'center' }}>
            {filters.departement !== 'all' && !selectedCommune && (
              <button
                style={BUTTON_STYLE}
                onClick={() => setFilters(f => ({ ...f, departement: 'all' }))}
              >
                ← Bretagne
              </button>
            )}
            {selectedCommune && (
              <>
                <button
                  style={BUTTON_STYLE}
                  onClick={() => {
                    setSelectedCommune(null)
                    setFilters(f => ({ ...f, departement: 'all' }))
                  }}
                >
                  ← Bretagne
                </button>
                <span style={{ color: '#a1a1aa', fontSize: 13 }}>/</span>
                <button
                  style={BUTTON_STYLE}
                  onClick={() => setSelectedCommune(null)}
                >
                  ← {DEPT_NOMS[selectedCommune.departmentCode as DeptCode]}
                </button>
              </>
            )}
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <Map
              communes={communes}
              codePostaux={codePostaux}
              communeGeoJSON={communeGeoJSON}
              selectedDept={filters.departement}
              selectedCommune={selectedCommune}
              onDeptSelect={dept => {
                setSelectedCommune(null)
                setFilters(f => ({ ...f, departement: dept }))
              }}
              onCommuneSelect={setSelectedCommune}
              filters={{ annee: filters.annee, typeBien: filters.typeBien }}
              loading={loadingMap || loadingCP || geoLoading}
              mutations={mutations}
              loadingMutations={loadingMutations}
              selectedSectionId={selectedSectionId}
              onSectionSelect={setSelectedSectionId}
              onParcelleSelect={setSelectedParcelleId}
            />
          </div>
          {selectedParcelleId && (
            <MutationPanel
              parcelleId={selectedParcelleId}
              mutations={parcelleMutations}
              loading={loadingParcelleMutations}
              onClose={() => setSelectedParcelleId(null)}
            />
          )}
        </main>
      </div>
    </div>
  )
}
