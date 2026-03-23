import { useMemo, useState } from 'react'
import { Header } from './components/Header'
import { Map } from './components/Map'
import { Sidebar } from './components/Sidebar'
import { rawData } from './data/mockData'
import type { Filters, DeptStats, KpiData, TypeStat, DistBucket, DeptCode } from './types'
import { DEPT_NOMS } from './types'

const DEPT_CODES: DeptCode[] = ['22', '29', '35', '56']
const TYPES_BIEN = ['Maison', 'Appartement', 'Terrain'] as const

const DEFAULT_FILTERS: Filters = {
  departement: 'all',
  typeBien: 'all',
  annee: 'all',
}

function computeDeptStats(filters: Filters): DeptStats[] {
  return DEPT_CODES.map(code => {
    const rows = rawData.filter(r => {
      if (r.dept !== code) return false
      if (filters.typeBien !== 'all' && r.type !== filters.typeBien) return false
      if (filters.annee !== 'all' && r.annee !== filters.annee) return false
      return true
    })
    if (rows.length === 0)
      return { code, nom: DEPT_NOMS[code], prixMedian: 0, nbTransactions: 0 }
    const prixMedian = Math.round(rows.reduce((s, r) => s + r.prixMedian, 0) / rows.length)
    const nbTransactions = rows.reduce((s, r) => s + r.nbTransactions, 0)
    return { code, nom: DEPT_NOMS[code], prixMedian, nbTransactions }
  })
}

function computeEvolution(filters: Filters): { annee: number; prix: number }[] {
  return [2018, 2019, 2020, 2021, 2022, 2023, 2024].map(annee => {
    const rows = rawData.filter(r => {
      if (r.annee !== annee) return false
      if (filters.departement !== 'all' && r.dept !== filters.departement) return false
      if (filters.typeBien !== 'all' && r.type !== filters.typeBien) return false
      return true
    })
    const prix = rows.length
      ? Math.round(rows.reduce((s, r) => s + r.prixMedian, 0) / rows.length)
      : 0
    return { annee, prix }
  })
}

function computeTypeStats(filters: Filters): TypeStat[] {
  return TYPES_BIEN.map(type => {
    const rows = rawData.filter(r => {
      if (r.type !== type) return false
      if (filters.departement !== 'all' && r.dept !== filters.departement) return false
      if (filters.annee !== 'all' && r.annee !== filters.annee) return false
      return true
    })
    if (rows.length === 0) return { type, ventes: 0, prixMedian: 0 }
    return {
      type,
      ventes: rows.reduce((s, r) => s + r.nbTransactions, 0),
      prixMedian: Math.round(rows.reduce((s, r) => s + r.prixMedian, 0) / rows.length),
    }
  })
}

// Répartition des transactions par tranche de prix
function computeDistribution(filters: Filters): DistBucket[] {
  const buckets = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]
  const counts = new Array(buckets.length + 1).fill(0)

  rawData
    .filter(r => {
      if (filters.departement !== 'all' && r.dept !== filters.departement) return false
      if (filters.typeBien !== 'all' && r.type !== filters.typeBien) return false
      if (filters.annee !== 'all' && r.annee !== filters.annee) return false
      return true
    })
    .forEach(r => {
      const idx = buckets.findIndex(b => r.prixMedian < b)
      counts[idx === -1 ? buckets.length : idx] += r.nbTransactions
    })

  return buckets.map((b, i) => ({
    label: i === 0 ? `< ${b}` : `${buckets[i - 1]}–${b}`,
    count: counts[i],
  })).concat([{ label: `> ${buckets[buckets.length - 1]}`, count: counts[buckets.length] }])
    .filter(b => b.count > 0)
}

function computeKpis(deptStats: DeptStats[]): KpiData {
  const valid = deptStats.filter(d => d.prixMedian > 0)
  const prixMoyen = valid.length
    ? Math.round(valid.reduce((s, d) => s + d.prixMedian, 0) / valid.length)
    : 0
  const moinsCher = valid.reduce((a, b) => (a.prixMedian <= b.prixMedian ? a : b), valid[0])
  return {
    prixMedianBretagne: prixMoyen,
    nbTransactionsTotal: deptStats.reduce((s, d) => s + d.nbTransactions, 0),
    deptMoinsCher: moinsCher
      ? { code: moinsCher.code, nom: moinsCher.nom, prix: moinsCher.prixMedian }
      : { code: '22', nom: DEPT_NOMS['22'], prix: 0 },
  }
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const deptStats    = useMemo(() => computeDeptStats(filters), [filters])
  const kpis         = useMemo(() => computeKpis(deptStats), [deptStats])
  const evolution    = useMemo(() => computeEvolution(filters), [filters])
  const typeStats    = useMemo(() => computeTypeStats(filters), [filters])
  const distribution = useMemo(() => computeDistribution(filters), [filters])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header filters={filters} onChange={setFilters} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          kpis={kpis}
          deptStats={deptStats}
          evolution={evolution}
          typeStats={typeStats}
          distribution={distribution}
          filters={filters}
        />
        <main className="flex-1 relative overflow-hidden">
          <Map deptStats={deptStats} filters={filters} />
        </main>
      </div>
    </div>
  )
}
