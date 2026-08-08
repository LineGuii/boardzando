import type { JSX } from 'react';

/**
 * Padrao SVG de fundo com iconografia musical: colcheia, clave, disco de
 * vinil e forma de onda. Tinta = `currentColor` (definida em .q-doodles).
 */
export function MusicDoodles(): JSX.Element {
  return (
    <svg className="q-doodles" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="q-notes" x="0" y="0" width="220" height="220" patternUnits="userSpaceOnUse">
          {/* Colcheia */}
          <g transform="translate(20,40)" stroke="currentColor" fill="currentColor" strokeWidth="2">
            <ellipse cx="0" cy="20" rx="9" ry="6" transform="rotate(-15 0 20)" />
            <line x1="8" y1="19" x2="8" y2="-14" strokeLinecap="round" />
            <path d="M8 -14 Q 22 -6 20 8" fill="none" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          {/* Onda sonora */}
          <g transform="translate(100,60)" stroke="currentColor" fill="none" strokeWidth="2.5" strokeLinecap="round">
            <path d="M0 0 Q 8 -14 16 0 T 32 0 T 48 0 T 64 0" />
          </g>
          {/* Disco de vinil */}
          <g transform="translate(60,140)" stroke="currentColor" fill="none" strokeWidth="1.5">
            <circle cx="0" cy="0" r="22" />
            <circle cx="0" cy="0" r="16" />
            <circle cx="0" cy="0" r="10" />
            <circle cx="0" cy="0" r="4" fill="currentColor" />
          </g>
          {/* Semicolcheia dupla */}
          <g transform="translate(160,140)" stroke="currentColor" fill="currentColor" strokeWidth="2">
            <ellipse cx="0" cy="20" rx="7" ry="5" transform="rotate(-12 0 20)" />
            <ellipse cx="24" cy="24" rx="7" ry="5" transform="rotate(-12 24 24)" />
            <line x1="6" y1="19" x2="6" y2="-12" strokeLinecap="round" />
            <line x1="30" y1="23" x2="30" y2="-8" strokeLinecap="round" />
            <line x1="6" y1="-12" x2="30" y2="-8" strokeLinecap="round" strokeWidth="3" />
          </g>
          {/* Clave de sol simplificada */}
          <g transform="translate(180,20)" stroke="currentColor" fill="none" strokeWidth="2.2" strokeLinecap="round">
            <path d="M0 0 C -8 6 -8 16 0 20 S 10 8 4 -6 -4 -12 -4 -2 S 4 12 8 20" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#q-notes)" />
    </svg>
  );
}
