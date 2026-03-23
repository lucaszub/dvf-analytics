import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Separator } from '@/components/ui/separator'
import type { DeptStats, KpiData, Filters, TypeStat, DistBucket } from '@/types'
import { DEPT_NOMS } from '@/types'

interface SidebarProps {
  kpis: KpiData
  deptStats: DeptStats[]
  evolution: { annee: number; prix: number }[]
  typeStats: TypeStat[]
  distribution: DistBucket[]
  filters: Filters
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border border-border rounded-md px-2.5 py-1.5 shadow-md text-xs">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">{Number(payload[0].value).toLocaleString('fr-FR')} {payload[0].name === 'prix' ? '€/m²' : 'ventes'}</p>
    </div>
  )
}

export function Sidebar({ kpis, deptStats, evolution, typeStats, distribution, filters }: SidebarProps) {
  const isFiltered  = filters.departement !== 'all'
  const scopeNom    = isFiltered ? DEPT_NOMS[filters.departement as keyof typeof DEPT_NOMS] : 'Bretagne'
  const scopeCode   = isFiltered ? ` (${filters.departement})` : ''
  const evolValid   = evolution.filter(e => e.prix > 0)

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto border-r border-border bg-background"
      style={{ width: 400, minWidth: 400 }}
    >

      {/* Breadcrumb + titre */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-xs text-muted-foreground mb-2">
          France{isFiltered && <> &rsaquo; <span className="text-foreground">{scopeNom}{scopeCode}</span></>}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {isFiltered ? 'Département' : 'Région'}
        </p>
        <h2 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
          {scopeNom}{scopeCode}
        </h2>
      </div>

      <Separator />

      {/* KPIs principaux — 2 colonnes comme data.gouv.fr */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nombre total de ventes</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {kpis.nbTransactionsTotal.toLocaleString('fr-FR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Prix de vente médian au m²</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {kpis.prixMedianBretagne.toLocaleString('fr-FR')}€
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tableau par type de bien */}
      <div className="px-5 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <td />
              {typeStats.map(t => (
                <td key={t.type} className="text-right pb-2 text-xs font-medium text-muted-foreground">
                  {t.type === 'Appartement' ? 'Appt.' : t.type}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="py-2 text-xs text-muted-foreground">Ventes&nbsp;:</td>
              {typeStats.map(t => (
                <td key={t.type} className="py-2 text-right text-xs font-semibold text-foreground">
                  {t.ventes > 0 ? t.ventes.toLocaleString('fr-FR') : <span className="text-muted-foreground">—</span>}
                </td>
              ))}
            </tr>
            <tr className="border-t border-border">
              <td className="py-2 text-xs text-muted-foreground">Prix médian m²&nbsp;:</td>
              {typeStats.map(t => (
                <td key={t.type} className="py-2 text-right text-xs font-semibold text-foreground">
                  {t.prixMedian > 0 ? `${t.prixMedian.toLocaleString('fr-FR')}€` : <span className="text-muted-foreground">—</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <Separator />

      {/* Évolution temporelle */}
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-foreground mb-1">
          Évolution du prix de vente médian au m²
          {isFiltered && <span className="text-muted-foreground font-normal"> ({scopeNom})</span>}
        </p>
        {evolValid.length < 2 ? (
          <p className="text-xs text-muted-foreground italic mt-3">
            Il n'y a pas suffisamment de données pour afficher ce graphique.
          </p>
        ) : (
          <>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>{Math.min(...evolValid.map(e => e.prix)).toLocaleString('fr-FR')}€</span>
              <span>{Math.max(...evolValid.map(e => e.prix)).toLocaleString('fr-FR')}€</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={evolValid} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="hsl(var(--foreground))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="annee" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(1)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="prix" stroke="hsl(var(--foreground))" strokeWidth={1.5} fill="url(#grad)" dot={false} activeDot={{ r: 3, fill: 'hsl(var(--foreground))' }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
              <span>2018</span>
              <span>2024</span>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Distribution des prix */}
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-foreground mb-3">
          Distribution du prix de vente au m²
          {isFiltered && <span className="text-muted-foreground font-normal"> ({scopeNom})</span>}
        </p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={distribution} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => v > 999 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" name="ventes" fill="#bfdbfe" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
          <span>0€</span>
          <span>&gt; 3 500€</span>
        </div>
      </div>

      <Separator />

      {/* Légende choroplèthe */}
      <div className="px-5 py-4 mt-auto">
        <p className="text-xs font-medium text-muted-foreground mb-2">Prix au m²</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full" style={{ background: 'linear-gradient(to right, #3b82f6, #f59e0b, #ef4444)' }} />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
          <span>Bas</span>
          <span>Élevé</span>
        </div>
      </div>

    </aside>
  )
}
