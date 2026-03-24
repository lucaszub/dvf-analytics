export type DeptCode = '22' | '29' | '35' | '56'
export type TypeBien = 'Maison' | 'Appartement' | 'Terrain'
export type ApiStatus = 'idle' | 'loading' | 'error' | 'success'

export interface Filters {
  departement: DeptCode | 'all'
  typeBien: TypeBien | 'all'
  annee: number | 'all'
}

export interface DataEntry {
  dept: DeptCode
  annee: number
  type: TypeBien
  prixMedian: number   // €/m²
  nbTransactions: number
}

export interface DeptStats {
  code: DeptCode
  nom: string
  prixMedian: number
  nbTransactions: number
}

export interface KpiData {
  prixMedianBretagne: number
  nbTransactionsTotal: number
  deptMoinsCher: {
    code: DeptCode
    nom: string
    prix: number
  }
}

export interface TypeStat {
  type: TypeBien
  ventes: number
  prixMedian: number
}

export interface DistBucket {
  label: string
  count: number
}

export const DEPT_NOMS: Record<DeptCode, string> = {
  '22': 'Côtes-d\'Armor',
  '29': 'Finistère',
  '35': 'Ille-et-Vilaine',
  '56': 'Morbihan',
}
