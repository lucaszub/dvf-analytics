import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { Filters } from '@/types'

interface HeaderProps {
  filters: Filters
  onChange: (f: Filters) => void
}

const ANNEES = [2018, 2019, 2020, 2021, 2022, 2023, 2024]

export function Header({ filters, onChange }: HeaderProps) {
  const set = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    onChange({ ...filters, [key]: val })

  return (
    <header className="h-14 flex items-center px-4 border-b border-border bg-background shrink-0 z-[2000]">
      {/* Logo + titre */}
      <div className="flex items-center gap-3 mr-6">
        <div className="size-7 rounded-lg bg-foreground flex items-center justify-center">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
          </svg>
        </div>
        <div>
          <span className="text-sm font-semibold text-foreground">DVF Analytics</span>
          <span className="text-sm text-muted-foreground ml-2">Bretagne</span>
        </div>
      </div>

      <Separator orientation="vertical" className="h-6 mr-6" />

      {/* Filtres inline à droite */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-muted-foreground mr-1 hidden sm:block">Filtres :</span>

        <Select
          value={filters.departement}
          onValueChange={v => set('departement', v as Filters['departement'])}
        >
          <SelectTrigger className="h-8 text-xs w-44 bg-background">
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

        <Select
          value={filters.typeBien}
          onValueChange={v => set('typeBien', v as Filters['typeBien'])}
        >
          <SelectTrigger className="h-8 text-xs w-36 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="Maison">Maison</SelectItem>
            <SelectItem value="Appartement">Appartement</SelectItem>
            <SelectItem value="Terrain">Terrain</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={String(filters.annee)}
          onValueChange={v =>
            set('annee', v === 'all' ? 'all' : (parseInt(v) as Filters['annee']))
          }
        >
          <SelectTrigger className="h-8 text-xs w-28 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">2018 – 2024</SelectItem>
            {ANNEES.map(a => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  )
}
