import type { ParcelleMutation } from '@/data/api'

interface MutationPanelProps {
  parcelleId: string
  mutations: ParcelleMutation[]
  loading: boolean
  onClose: () => void
}

export function MutationPanel({ parcelleId, mutations, loading, onClose }: MutationPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 320,
        height: '100%',
        background: '#ffffff',
        borderLeft: '1px solid #e4e4e7',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #f4f4f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Parcelle
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#09090b', marginTop: 2, fontFamily: 'monospace' }}>
            {parcelleId}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#71717a',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: '#71717a', fontSize: 13 }}>
            Chargement…
          </div>
        )}

        {!loading && mutations.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#71717a', fontSize: 13 }}>
            Aucune transaction sur cette parcelle
          </div>
        )}

        {!loading && mutations.map((m) => (
          <div
            key={m.id_mutation}
            style={{
              padding: '10px 0',
              borderBottom: '1px solid #f4f4f5',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#09090b' }}>
                {Math.round(m.prix_m2).toLocaleString('fr-FR')} €/m²
              </span>
              <span style={{ fontSize: 11, color: '#71717a' }}>
                {new Date(m.date_mutation).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' })}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#52525b' }}>
              {m.type_local} · {m.surface_reelle_bati} m²
            </div>
            <div style={{ fontSize: 12, color: '#52525b' }}>
              {m.valeur_fonciere.toLocaleString('fr-FR')} €
            </div>
            {m.adresse_nom_voie && (
              <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
                {m.adresse_nom_voie}
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && mutations.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f4f4f5', fontSize: 12, color: '#71717a', flexShrink: 0 }}>
          {mutations.length} transaction{mutations.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
