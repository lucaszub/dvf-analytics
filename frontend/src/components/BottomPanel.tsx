import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Separator } from '@/components/ui/separator'
import type { DeptStats, KpiData, Filters } from '@/types'

interface BottomPanelProps {
  kpis: KpiData
  deptStats: DeptStats[]
  evolution: { annee: number; prix: number }[]
  filters: Filters
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
        {label}
      </span>
      <span className="text-lg font-semibold text-foreground leading-tight mt-0.5">
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground mt-0.5">{sub}</span>}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        {Number(payload[0].value).toLocaleString('fr-FR')} €/m²
      </p>
    </div>
  )
}

export function BottomPanel({ kpis, deptStats, evolution, filters }: BottomPanelProps) {
  const deptBarData = deptStats
    .filter(d => d.prixMedian > 0)
    .map(d => ({ name: d.code, prix: d.prixMedian, nom: d.nom }))

  const evolNonZero = evolution.filter(e => e.prix > 0)

  return (
    <div
      className="absolute bottom-5 left-5 z-[1000] pointer-events-auto"
      style={{ width: 420 }}
    >
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden">

        {/* KPIs row */}
        <div className="px-4 pt-4 pb-3 grid grid-cols-3 gap-4">
          <Stat
            label="Prix médian"
            value={`${kpis.prixMedianBretagne.toLocaleString('fr-FR')} €/m²`}
            sub={filters.departement === 'all' ? 'Bretagne' : `Dept. ${filters.departement}`}
          />
          <Stat
            label="Transactions"
            value={kpis.nbTransactionsTotal.toLocaleString('fr-FR')}
            sub={filters.annee === 'all' ? '2018 – 2024' : String(filters.annee)}
          />
          <Stat
            label="Moins cher"
            value={`${kpis.deptMoinsCher.prix.toLocaleString('fr-FR')} €`}
            sub={kpis.deptMoinsCher.nom}
          />
        </div>

        <Separator />

        {/* Charts row */}
        <div className="grid grid-cols-2 divide-x divide-border">

          {/* Évolution temporelle */}
          <div className="px-3 pt-3 pb-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
              Évolution prix/m²
            </p>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={evolNonZero} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="annee"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="prix"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.5}
                  fill="url(#areaGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: 'hsl(var(--foreground))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Comparaison départements */}
          <div className="px-3 pt-3 pb-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
              Comparaison depts
            </p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={deptBarData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="prix"
                  fill="hsl(var(--foreground))"
                  radius={[3, 3, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Légende couleurs */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Prix/m² :</span>
          <div
            className="flex-1 h-1.5 rounded-full"
            style={{ background: 'linear-gradient(to right, #3b82f6, #f59e0b, #ef4444)' }}
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            ~1 200 → 3 700 €
          </span>
        </div>

      </div>
    </div>
  )
}
