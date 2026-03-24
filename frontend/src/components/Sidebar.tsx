import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Separator } from '@/components/ui/separator'
import type { Filters } from '@/types'
import { DEPT_NOMS } from '@/types'
import type { CommuneResponse, KpisResponse, HistoriquePoint, CodePostalResponse } from '@/data/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TypeStat {
  type: string
  ventes: number
  prixMedian: number
}

interface DistBucket {
  label: string
  count: number
}

interface SidebarProps {
  communes: CommuneResponse[]
  kpis: KpisResponse | null
  historique: HistoriquePoint[]
  loading: boolean
  loadingCP?: boolean
  filters: Filters
  selectedCommune?: CommuneResponse | null
  codePostaux?: CodePostalResponse[]
}

// ── Local aggregation helpers ──────────────────────────────────────────────────

const TYPES_BIEN = ['Maison', 'Appartement', 'Terrain'] as const

/**
 * Aggregate communes by type_local (derived from the `department` field which
 * holds the type label in the commune response), or if not present, group by
 * matching commune names against type patterns.
 *
 * In practice, the backend `/communes` endpoint returns one row per
 * (commune × type_local): `department` carries the dept name, not the type.
 * The type information is not directly on CommuneResponse, so we build type
 * stats as approximations: all communes aggregated as a single "all types"
 * bucket. When the API is extended with a `typeBien` field this can be refined.
 *
 * For now we show the aggregate stats across communes without type breakdown
 * using a single-row table.
 */
function computeTypeStats(communes: CommuneResponse[]): TypeStat[] {
  // CommuneResponse doesn't carry a typeBien field — we cannot disaggregate.
  // Return a single synthetic row with totals.
  if (communes.length === 0) {
    return TYPES_BIEN.map(type => ({ type, ventes: 0, prixMedian: 0 }))
  }

  // Until the API exposes per-type commune data, return a single "Tous" row.
  const totalVentes = communes.reduce((s, c) => s + c.transactions, 0)
  const prices = communes.map(c => c.pricePerSqm).filter(p => p > 0).sort((a, b) => a - b)
  const prixMedian = prices.length ? prices[Math.floor(prices.length / 2)] : 0

  return [{ type: 'Tous types', ventes: totalVentes, prixMedian }]
}

const DIST_BREAKPOINTS = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000]

function computeDistribution(communes: CommuneResponse[]): DistBucket[] {
  const counts = new Array(DIST_BREAKPOINTS.length + 1).fill(0)

  communes.forEach(c => {
    if (c.pricePerSqm <= 0) return
    const idx = DIST_BREAKPOINTS.findIndex(b => c.pricePerSqm < b)
    counts[idx === -1 ? DIST_BREAKPOINTS.length : idx] += c.transactions
  })

  const buckets: DistBucket[] = DIST_BREAKPOINTS.map((b, i) => ({
    label: i === 0 ? `< ${b}` : `${DIST_BREAKPOINTS[i - 1]}–${b}`,
    count: counts[i],
  }))
  buckets.push({
    label: `> ${DIST_BREAKPOINTS[DIST_BREAKPOINTS.length - 1]}`,
    count: counts[DIST_BREAKPOINTS.length],
  })

  return buckets.filter(b => b.count > 0)
}

// ── Tooltip ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border border-border rounded-md px-2.5 py-1.5 shadow-md text-xs">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        {Number(payload[0].value).toLocaleString('fr-FR')}{' '}
        {payload[0].name === 'prix' ? '€/m²' : 'ventes'}
      </p>
    </div>
  )
}

// ── Skeleton placeholder ───────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted ${className ?? ''}`}
    />
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar({
  communes, kpis, historique, loading, loadingCP, filters, selectedCommune, codePostaux = [],
}: SidebarProps) {
  const isFiltered   = filters.departement !== 'all'
  const deptNom      = isFiltered ? DEPT_NOMS[filters.departement as keyof typeof DEPT_NOMS] : 'Bretagne'
  const deptCode     = isFiltered ? ` (${filters.departement})` : ''
  const isCommune    = Boolean(selectedCommune)

  // Title / level label depending on drill depth
  const levelLabel = isCommune ? 'Commune' : isFiltered ? 'Département' : 'Région'
  const titleNom   = isCommune ? selectedCommune!.name : deptNom
  const titleCode  = isCommune ? ` (${selectedCommune!.departmentCode})` : deptCode

  // Map HistoriquePoint → chart-friendly shape
  const evolData = historique.map(h => ({ annee: h.annee, prix: h.prix_median_m2 }))
  const evolValid = evolData.filter(e => e.prix > 0)

  const typeStats    = computeTypeStats(communes)
  const distribution = computeDistribution(communes)

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto border-r border-border bg-background"
      style={{ width: 400, minWidth: 400 }}
    >

      {/* Breadcrumb + titre */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-xs text-muted-foreground mb-2">
          France
          {isFiltered && (
            <> &rsaquo; <span className={isCommune ? 'text-foreground' : 'text-foreground'}>{deptNom}{deptCode}</span></>
          )}
          {isCommune && (
            <> &rsaquo; <span className="text-foreground">{selectedCommune!.name}</span></>
          )}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {levelLabel}
        </p>
        <h2 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
          {titleNom}{titleCode}
        </h2>
      </div>

      <Separator />

      {/* KPIs principaux — 2 colonnes */}
      <div className="px-5 py-4">
        {isCommune ? (
          /* Commune level — stats from selectedCommune directly */
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nombre total de ventes</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {selectedCommune!.transactions.toLocaleString('fr-FR')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Prix médian au m²</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {selectedCommune!.pricePerSqm.toLocaleString('fr-FR')}€
              </p>
            </div>
            {selectedCommune!.evolution !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Évolution N-1</p>
                <p className={`text-lg font-semibold ${selectedCommune!.evolution >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {selectedCommune!.evolution >= 0 ? '+' : ''}{selectedCommune!.evolution.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Bretagne / Département level */
          <>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nombre total de ventes</p>
                {loading || !kpis ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground tracking-tight">
                    {kpis.nb_transactions_total.toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Prix de vente médian au m²</p>
                {loading || !kpis ? (
                  <Skeleton className="h-8 w-20 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground tracking-tight">
                    {kpis.prix_median_selection.toLocaleString('fr-FR')}€
                  </p>
                )}
              </div>
            </div>

            {/* Commune la plus / moins chère */}
            {!loading && kpis && (kpis.commune_plus_chere || kpis.commune_moins_chere) && (
              <div className="grid grid-cols-2 gap-6 mt-4">
                {kpis.commune_plus_chere && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Commune la + chère</p>
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      {kpis.commune_plus_chere}
                    </p>
                  </div>
                )}
                {kpis.commune_moins_chere && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Commune la - chère</p>
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      {kpis.commune_moins_chere}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Separator />

      {/* Code postal breakdown — visible uniquement au niveau commune */}
      {isCommune && (
        <>
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-foreground mb-3">Codes postaux</p>
            {loadingCP ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : codePostaux.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun code postal disponible.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <td className="pb-2 text-xs font-medium text-muted-foreground">Code postal</td>
                    <td className="pb-2 text-right text-xs font-medium text-muted-foreground">
                      Prix médian m²
                    </td>
                    <td className="pb-2 text-right text-xs font-medium text-muted-foreground">
                      Ventes
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {codePostaux
                    .slice()
                    .sort((a, b) => b.transactions - a.transactions)
                    .map(cp => (
                      <tr key={cp.code} className="border-t border-border">
                        <td className="py-2 text-xs font-semibold text-foreground">{cp.code}</td>
                        <td className="py-2 text-right text-xs text-foreground">
                          {cp.pricePerSqm > 0
                            ? `${cp.pricePerSqm.toLocaleString('fr-FR')}€`
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 text-right text-xs text-foreground">
                          {cp.transactions.toLocaleString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
          <Separator />
        </>
      )}

      {/* Tableau par type de bien */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : typeStats.length === 0 || typeStats.every(t => t.ventes === 0) ? (
          <p className="text-xs text-muted-foreground italic">Aucune donnée disponible.</p>
        ) : (
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
                    {t.ventes > 0
                      ? t.ventes.toLocaleString('fr-FR')
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 text-xs text-muted-foreground">Prix médian m²&nbsp;:</td>
                {typeStats.map(t => (
                  <td key={t.type} className="py-2 text-right text-xs font-semibold text-foreground">
                    {t.prixMedian > 0
                      ? `${t.prixMedian.toLocaleString('fr-FR')}€`
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <Separator />

      {/* Évolution temporelle */}
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-foreground mb-1">
          Évolution du prix de vente médian au m²
          {isFiltered && <span className="text-muted-foreground font-normal"> ({deptNom})</span>}
        </p>
        {loading ? (
          <Skeleton className="h-24 w-full mt-2" />
        ) : evolValid.length < 2 ? (
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
                <XAxis
                  dataKey="annee"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="prix"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.5}
                  fill="url(#grad)"
                  dot={false}
                  activeDot={{ r: 3, fill: 'hsl(var(--foreground))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
              <span>{evolValid[0]?.annee ?? 2018}</span>
              <span>{evolValid[evolValid.length - 1]?.annee ?? 2024}</span>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Distribution des prix */}
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-foreground mb-3">
          Distribution du prix de vente au m²
          {isFiltered && <span className="text-muted-foreground font-normal"> ({deptNom})</span>}
        </p>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : distribution.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Il n'y a pas suffisamment de données pour afficher ce graphique.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={distribution} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => v > 999 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="ventes" fill="#bfdbfe" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
              <span>0€</span>
              <span>&gt; {DIST_BREAKPOINTS[DIST_BREAKPOINTS.length - 1].toLocaleString('fr-FR')}€</span>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Légende choroplèthe */}
      <div className="px-5 py-4 mt-auto">
        <p className="text-xs font-medium text-muted-foreground mb-2">Prix au m²</p>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-2 rounded-full"
            style={{ background: 'linear-gradient(to right, #1a9641, #ffffbf, #fdae61, #d73027, #a50026)' }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
          <span>≤ 1 500 €</span>
          <span>≥ 4 500 €</span>
        </div>
      </div>

    </aside>
  )
}
