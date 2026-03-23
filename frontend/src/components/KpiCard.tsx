import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  variant?: 'default' | 'highlight'
}

export function KpiCard({ label, value, sub, variant = 'default' }: KpiCardProps) {
  return (
    <Card className={cn(
      'border',
      variant === 'highlight' && 'border-primary/20 bg-primary/5'
    )}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          {label}
        </p>
        <p className={cn(
          'text-xl font-semibold leading-tight',
          variant === 'highlight' ? 'text-primary' : 'text-foreground'
        )}>
          {value}
        </p>
        {sub && (
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        )}
      </CardContent>
    </Card>
  )
}
