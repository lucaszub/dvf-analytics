import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { Filters, KpiData } from '@/types'

interface SidebarProps {
  filters: Filters
  onChange: (f: Filters) => void
  kpis: KpiData
}

const ANNEES = [2018, 2019, 2020, 2021, 2022, 2023, 2024]

export function Sidebar({ filters, onChange, kpis }: SidebarProps) {
  const set = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    onChange({ ...filters, [key]: val })

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto bg-white border-r border-border"
      style={{ width: 300, minWidth: 300 }}
    >
      {/* Header */}
      <div className="px-6 pt-7 pb-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="size-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
            DVF Analytics
          </span>
        </div>
        <h1 className="text-[22px] font-bold text-foreground leading-tight tracking-tight">
          Marché immobilier
          <br />
          <span className="text-primary">Bretagne</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1.5">
          Données DVF · 2018 – 2024
        </p>
      </div>

      <Separator />

      {/* KPIs */}
      <div className="px-6 py-5">
        {/* KPI principal */}
        <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-3">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-1">
            Prix médian Bretagne
          </p>
          <p className="text-3xl font-bold text-foreground leading-none">
            {kpis.prixMedianBretagne.toLocaleString('fr-FR')}
            <span className="text-base font-semibold text-muted-foreground ml-1">€/m²</span>
          </p>
        </div>

        {/* 2 KPIs secondaires */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              Transactions
            </p>
            <p className="text-lg font-bold text-foreground leading-none">
              {kpis.nbTransactionsTotal.toLocaleString('fr-FR')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filters.annee === 'all' ? '2018–2024' : String(filters.annee)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              Moins cher
            </p>
            <p className="text-lg font-bold text-foreground leading-none">
              {kpis.deptMoinsCher.prix.toLocaleString('fr-FR')}
              <span className="text-xs font-medium text-muted-foreground ml-0.5">€</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {kpis.deptMoinsCher.nom}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Filtres */}
      <div className="px-6 py-5 flex flex-col gap-4">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Filtres
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-foreground">Département</label>
          <Select
            value={filters.departement}
            onValueChange={v => set('departement', v as Filters['departement'])}
          >
            <SelectTrigger className="w-full h-10 rounded-xl border-border bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bretagne (tous)</SelectItem>
              <SelectItem value="22">22 — Côtes-d'Armor</SelectItem>
              <SelectItem value="29">29 — Finistère</SelectItem>
              <SelectItem value="35">35 — Ille-et-Vilaine</SelectItem>
              <SelectItem value="56">56 — Morbihan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-foreground">Type de bien</label>
          <Select
            value={filters.typeBien}
            onValueChange={v => set('typeBien', v as Filters['typeBien'])}
          >
            <SelectTrigger className="w-full h-10 rounded-xl border-border bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="Maison">Maison</SelectItem>
              <SelectItem value="Appartement">Appartement</SelectItem>
              <SelectItem value="Terrain">Terrain</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-foreground">Année</label>
          <Select
            value={String(filters.annee)}
            onValueChange={v =>
              set('annee', v === 'all' ? 'all' : (parseInt(v) as Filters['annee']))
            }
          >
            <SelectTrigger className="w-full h-10 rounded-xl border-border bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les années</SelectItem>
              {ANNEES.map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Légende */}
      <div className="px-6 py-5 mt-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Échelle prix au m²
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Bas</span>
          <div
            className="flex-1 h-2.5 rounded-full"
            style={{ background: 'linear-gradient(to right, #3b82f6, #f59e0b, #ef4444)' }}
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Élevé</span>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-muted-foreground">~1 200 €</span>
          <span className="text-[11px] text-muted-foreground">~3 700 €</span>
        </div>
      </div>
    </aside>
  )
}
