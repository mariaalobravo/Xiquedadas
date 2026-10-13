// src/components/Avatar.tsx
import { useState } from 'react';
import { COLORES, usePerfiles, type Perfil } from '../lib/perfiles';

export function Avatar({ perfil, tam = 40 }: { perfil: Perfil; tam?: number }) {
  const [fallo, setFallo] = useState(false);
  const base: React.CSSProperties = {
    width: tam, height: tam, borderRadius: '50%', flexShrink: 0,
    border: '2px solid var(--fondo, #fff)', boxSizing: 'border-box',
  };

  if (perfil.foto && !fallo) {
    return <img src={perfil.foto} alt={perfil.nombre} title={perfil.nombre}
                style={{ ...base, objectFit: 'cover' }} onError={() => setFallo(true)} />;
  }
  return (
    <span title={perfil.nombre} style={{
      ...base, display: 'grid', placeItems: 'center', fontWeight: 600,
      fontSize: tam * 0.42, color: '#1f1f1f', background: COLORES[perfil.nombre] ?? '#ddd',
    }}>
      {perfil.nombre[0]}
    </span>
  );
}

// Caras solapadas + texto "Irene, Sara y Helí pueden"
export function FilaAvatares({ ids, tam = 36, texto = 'pueden' }: { ids: string[]; tam?: number; texto?: string }) {
  const { porId } = usePerfiles();
  const lista = ids.map(porId).filter(Boolean) as Perfil[];
  if (!lista.length) return <p style={{ color: 'var(--suave, #6b6b6b)' }}>Nadie se ha apuntado todavía</p>;

  const nombres = lista.map((p) => p.nombre);
  const frase = nombres.length === 1
    ? `${nombres[0]} ${({ pueden: 'puede', van: 'va' } as Record<string, string>)[texto] ?? texto}`
    : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)} ${texto}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex' }}>
        {lista.map((p, i) => (
          <div key={p.id} style={{ marginLeft: i ? -tam * 0.3 : 0, zIndex: lista.length - i }}>
            <Avatar perfil={p} tam={tam} />
          </div>
        ))}
      </div>
      <span style={{ fontSize: 15 }}>{frase}</span>
    </div>
  );
}
