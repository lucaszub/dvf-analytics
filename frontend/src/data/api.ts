import type { Filters, DeptCode } from '../types'

const BASE_URL = ''

// ---------------------------------------------------------------------------
// API response interfaces
// ---------------------------------------------------------------------------

export interface CommuneResponse {
  id: string
  name: string
  department: string
  departmentCode: string
  pricePerSqm: number
  transactions: number
  evolution: number | null
  coordinates: [number, number]
}

export interface DepartementResponse {
  code: string
  annee: number
  type_local: string
  prix_median_m2: number
  nb_transactions: number
  commune_plus_chere: string | null
  commune_moins_chere: string | null
  evolution_pct_n1: number | null
}

export interface KpisResponse {
  prix_median_bretagne: number
  prix_median_selection: number
  nb_transactions_total: number
  commune_plus_chere: string | null
  commune_moins_chere: string | null
}

export interface HistoriquePoint {
  annee: number
  prix_median_m2: number
}

export interface CodePostalResponse {
  code: string
  departmentCode: string
  pricePerSqm: number
  transactions: number
  evolution: number | null
  coordinates: [number, number]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map a Filters value to the lowercase API string expected by the backend. */
function typeParam(typeBien: Filters['typeBien']): string | undefined {
  if (!typeBien || typeBien === 'all') return undefined
  return typeBien.toLowerCase() // 'Maison' → 'maison', etc.
}

/**
 * Build URLSearchParams from a plain object, skipping entries whose value is
 * undefined, null, or the sentinel string 'all'.
 */
function buildParams(raw: Record<string, string | number | undefined | null>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === 'all') continue
    params.set(key, String(value))
  }
  return params
}

async function get<T>(path: string, params: URLSearchParams): Promise<T> {
  const query = params.toString()
  const url = `${BASE_URL}${path}${query ? `?${query}` : ''}`
  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`API error ${response.status} on ${path}: ${text}`)
  }
  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Public fetch functions
// ---------------------------------------------------------------------------

export interface CommunesFilters {
  dept?: Filters['departement']
  type?: Filters['typeBien']
  annee?: Filters['annee']
  mois?: number
}

export async function fetchCommunes(filters: CommunesFilters = {}): Promise<CommuneResponse[]> {
  const params = buildParams({
    dept: filters.dept === 'all' ? undefined : filters.dept,
    type: typeParam(filters.type ?? 'all'),
    annee: filters.annee === 'all' ? undefined : filters.annee,
    mois: filters.mois,
  })
  return get<CommuneResponse[]>('/communes/', params)
}

export interface DepartementsFilters {
  annee?: Filters['annee']
  mois?: number
}

export async function fetchDepartements(filters: DepartementsFilters = {}): Promise<DepartementResponse[]> {
  const params = buildParams({
    annee: filters.annee === 'all' ? undefined : filters.annee,
    mois: filters.mois,
  })
  return get<DepartementResponse[]>('/departements', params)
}

export interface KpisFilters {
  dept?: Filters['departement']
  type?: Filters['typeBien']
  annee?: Filters['annee']
  mois?: number
}

export async function fetchKpis(filters: KpisFilters = {}): Promise<KpisResponse> {
  const params = buildParams({
    dept: filters.dept === 'all' ? undefined : filters.dept,
    type: typeParam(filters.type ?? 'all'),
    annee: filters.annee === 'all' ? undefined : filters.annee,
    mois: filters.mois,
  })
  return get<KpisResponse>('/bretagne/kpis', params)
}

export interface HistoriqueFilters {
  type?: Filters['typeBien']
  dept?: Filters['departement']
}

export async function fetchHistorique(filters: HistoriqueFilters = {}): Promise<HistoriquePoint[]> {
  const params = buildParams({
    type: typeParam(filters.type ?? 'all'),
    dept: filters.dept === 'all' ? undefined : filters.dept,
  })
  return get<HistoriquePoint[]>('/bretagne/historique', params)
}

export interface CodePostauxFilters {
  dept?: Filters['departement']
  type?: Filters['typeBien']
  annee?: Filters['annee']
}

export async function fetchCodePostaux(filters: CodePostauxFilters = {}): Promise<CodePostalResponse[]> {
  const params = buildParams({
    dept: filters.dept === 'all' ? undefined : filters.dept,
    type: typeParam(filters.type ?? 'all'),
    annee: filters.annee === 'all' ? undefined : filters.annee,
  })
  return get<CodePostalResponse[]>('/code-postaux/', params)
}

export interface MutationResponse {
  id: string
  longitude: number
  latitude: number
  prix_m2: number
  surface: number
  valeur_fonciere: number
  type_local: string
  date_mutation: string
}

export interface MutationsFilters {
  commune: string
  type?: Filters['typeBien']
  annee?: Filters['annee']
}

export async function fetchMutations(filters: MutationsFilters): Promise<MutationResponse[]> {
  const params = buildParams({
    commune: filters.commune,
    type: typeParam(filters.type ?? 'all'),
    annee: filters.annee === 'all' ? undefined : filters.annee,
  })
  return get<MutationResponse[]>('/mutations/', params)
}

export interface CommuneMappingItem {
  code_commune: string
  code_postal: string
  nom_commune: string
}

export async function fetchCommuneMapping(dept: DeptCode): Promise<CommuneMappingItem[]> {
  const params = buildParams({ dept })
  return get<CommuneMappingItem[]>('/communes/mapping', params)
}

// ---------------------------------------------------------------------------
// Cadastre — sections, parcelles, mutations parcelle
// ---------------------------------------------------------------------------

export interface GeoFeatureProperties {
  id: string
  code_commune: string
  prix_median_m2: number | null
  nb_transactions: number
  annee?: number
  type_local?: string
}

export interface GeoFeatureResponse {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: object
    properties: GeoFeatureProperties
  }>
}

export interface ParcelleMutation {
  id_mutation: string
  date_mutation: string
  type_local: string
  valeur_fonciere: number
  surface_reelle_bati: number
  prix_m2: number
  adresse_nom_voie: string
}

export interface CadastreFilters {
  type?: Filters['typeBien']
  annee?: Filters['annee']
}

export async function fetchCommuneSections(
  codeCommune: string,
  filters: CadastreFilters = {},
): Promise<GeoFeatureResponse> {
  // When annee is 'all', default to most recent year to avoid duplicate rows per section
  const annee = !filters.annee || filters.annee === 'all' ? 2024 : filters.annee
  const params = buildParams({ annee, type: typeParam(filters.type ?? 'all') })
  return get<GeoFeatureResponse>(`/communes/${codeCommune}/sections`, params)
}

export async function fetchSectionParcelles(
  sectionId: string,
  filters: CadastreFilters = {},
): Promise<GeoFeatureResponse> {
  const annee = !filters.annee || filters.annee === 'all' ? 2024 : filters.annee
  const params = buildParams({ annee, type: typeParam(filters.type ?? 'all') })
  return get<GeoFeatureResponse>(`/sections/${sectionId}/parcelles`, params)
}

export async function fetchParcelleMutations(parcelleId: string): Promise<ParcelleMutation[]> {
  return get<ParcelleMutation[]>(`/parcelles/${parcelleId}/mutations`, new URLSearchParams())
}
