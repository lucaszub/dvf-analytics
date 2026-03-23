import { useMemo, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Map } from './components/Map'
import { rawData } from './data/mockData'
import type { Filters, DeptStats, KpiData, DeptCode } from './types'
import { DEPT_NOMS } from './types'

const DEPT_CODES: DeptCode[] = ['22', '29', '35', '56']

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

  const deptStats = useMemo(() => computeDeptStats(filters), [filters])
  const kpis = useMemo(() => computeKpis(deptStats), [deptStats])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar filters={filters} onChange={setFilters} kpis={kpis} />
      <main className="flex-1 relative">
        <Map deptStats={deptStats} filters={filters} />
      </main>
    </div>
  )
}
