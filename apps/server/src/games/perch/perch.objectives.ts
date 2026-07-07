import type { PlayerId } from '@boardzando/contracts';
import {
  birdsInFountain,
  birdsInPlaza,
  controlledLocationIds,
  cornerLocIds,
  largestSingleFlockOwner,
  locationsWithFlock,
} from './perch.board';
import type { PerchState } from './perch.state';

/**
 * Objetivos ocultos (Fase D) — FIEL-NO-ESPÍRITO. Os textos exatos das 22 cartas
 * não estão públicos; este conjunto usa condições claras e verificáveis
 * inspiradas nas dicas do rulebook (controle, cantos, maior bando, Fonte/Praça).
 * Cada jogador recebe 1 objetivo secreto no setup; pontua o `reward` no fim se
 * cumprido. Data-driven: fácil de corrigir/expandir com os textos reais.
 */
export interface ObjectiveDef {
  id: string;
  title: string;
  desc: string;
  reward: number;
  /** Verdadeiro se o jogador cumpriu o objetivo (avaliado no fim do jogo). */
  check: (state: PerchState, player: PlayerId, flock: string) => boolean;
}

export const PERCH_OBJECTIVES: readonly ObjectiveDef[] = [
  {
    id: 'landlord',
    title: 'Dono do Pedaço',
    desc: 'Controle 3 ou mais Locais no fim do jogo.',
    reward: 6,
    check: (s, _p, f) => controlledLocationIds(s, f).length >= 3,
  },
  {
    id: 'king',
    title: 'Rei do Poleiro',
    desc: 'Tenha o maior bando único do jogo (sem empate).',
    reward: 5,
    check: (s, _p, f) => largestSingleFlockOwner(s) === f,
  },
  {
    id: 'corners',
    title: 'Cantos da Fazenda',
    desc: 'Controle ao menos 1 Local de canto.',
    reward: 4,
    check: (s, _p, f) => {
      const corners = new Set(cornerLocIds(s));
      return controlledLocationIds(s, f).some((id) => corners.has(id));
    },
  },
  {
    id: 'tamer',
    title: 'Domador',
    desc: 'Controle ao menos 1 criatura no fim.',
    reward: 4,
    check: (s, p) => Object.values(s.creatures).some((c) => c.controller === p),
  },
  {
    id: 'splash',
    title: 'Mergulho na Fonte',
    desc: 'Tenha 3 ou mais aves suas na Fonte.',
    reward: 5,
    check: (s, _p, f) => birdsInFountain(s, f) >= 3,
  },
  {
    id: 'plaza',
    title: 'Vida na Praça',
    desc: 'Tenha 2 ou mais aves suas na Praça.',
    reward: 5,
    check: (s, _p, f) => birdsInPlaza(s, f) >= 2,
  },
  {
    id: 'spread',
    title: 'Espalhado',
    desc: 'Tenha aves em 5 ou mais Locais diferentes.',
    reward: 5,
    check: (s, _p, f) => locationsWithFlock(s, f) >= 5,
  },
  {
    id: 'housed',
    title: 'Casa Protegida',
    desc: 'Termine com uma Casinha sobre o seu bando.',
    reward: 4,
    check: (s, _p, f) =>
      Object.values(s.birdhousesAt).some((byFlock) => byFlock[f] === true),
  },
  {
    id: 'nester',
    title: 'Ninhada',
    desc: 'Controle um Local que tenha ninho(s).',
    reward: 4,
    check: (s, _p, f) => {
      const ctrl = new Set(controlledLocationIds(s, f));
      return s.homestead.some((l) => (l.nests ?? 0) > 0 && ctrl.has(l.id));
    },
  },
  {
    id: 'duo',
    title: 'Duas Frentes',
    desc: 'Controle 2 Locais em colunas diferentes.',
    reward: 5,
    check: (s, _p, f) => {
      const cols = new Set(
        controlledLocationIds(s, f).map((id) => s.homestead.find((l) => l.id === id)?.col),
      );
      cols.delete(undefined);
      return cols.size >= 2;
    },
  },
];

export const OBJECTIVE_BY_ID: Record<string, ObjectiveDef> = Object.fromEntries(
  PERCH_OBJECTIVES.map((o) => [o.id, o]),
);
