import type { Flock } from './perch.state';

/**
 * Pontuação de UM Local, com a regra-assinatura do Perch: **empates que se
 * anulam**. Cada Local paga `points = [1º, 2º, 3º]`. Ordena os bandos por
 * contagem (desc) e preenche os "slots" de rank 1→2→3: um bando isolado pega o
 * próximo slot e pontua; um empate de k bandos consome k slots e NINGUÉM deles
 * pontua. Slots além do 3º não pagam nada.
 *
 * Valida os exemplos do rulebook (Happy Birdbath, Early Bird, Mighty Oak):
 * ver perch.game.spec.ts.
 */
export function scoreLocation(
  counts: Record<Flock, number>,
  points: readonly [number, number, number],
): Record<Flock, number> {
  const awards: Record<Flock, number> = {};
  // agrupa bandos (com ao menos 1 ave) por contagem, ordena por contagem desc
  const entries = Object.entries(counts).filter(([, c]) => c > 0);
  const byCount = new Map<number, Flock[]>();
  for (const [flock, c] of entries) {
    (byCount.get(c) ?? byCount.set(c, []).get(c)!).push(flock);
  }
  const groups = [...byCount.entries()].sort((a, b) => b[0] - a[0]).map(([, flocks]) => flocks);

  let slot = 1; // 1 = 1º, 2 = 2º, 3 = 3º
  for (const group of groups) {
    if (slot > 3) break;
    if (group.length === 1) {
      awards[group[0]!] = points[(slot - 1) as 0 | 1 | 2] ?? 0;
      slot += 1;
    } else {
      // empate: consome `group.length` slots, ninguém pontua
      slot += group.length;
    }
  }
  return awards;
}

/**
 * Contagem EFETIVA de um Local para pontuação/controle: aves reais + 1 por
 * bando com Casinha + `nests` para o bando que tem a MAIORIA CRUA ali (o
 * ninho conta +1 por ninho para quem o ocupa — modelado como o dono da
 * maioria; simplificação documentada do mecanismo de ninhos).
 */
export function effectiveCounts(
  counts: Record<Flock, number>,
  housed: Record<Flock, boolean> | undefined,
  nests = 0,
): Record<Flock, number> {
  const out: Record<Flock, number> = { ...counts };
  if (nests > 0) {
    const rawLeader = controllerOf(counts);
    if (rawLeader) out[rawLeader] = (out[rawLeader] ?? 0) + nests;
  }
  if (housed) {
    for (const [flock, on] of Object.entries(housed)) {
      if (on) out[flock] = (out[flock] ?? 0) + 1;
    }
  }
  return out;
}

/**
 * "Controlador" de um Local = bando com a MAIORIA ISOLADA (sem empate no topo).
 * Empate para o mais numeroso → sem controlador. Usado por criaturas/objetivos
 * (fases futuras) e pela UI para destacar quem controla.
 */
export function controllerOf(counts: Record<Flock, number>): Flock | undefined {
  let max = 0;
  let leaders: Flock[] = [];
  for (const [flock, c] of Object.entries(counts)) {
    if (c <= 0) continue;
    if (c > max) {
      max = c;
      leaders = [flock];
    } else if (c === max) {
      leaders.push(flock);
    }
  }
  return leaders.length === 1 ? leaders[0] : undefined;
}
