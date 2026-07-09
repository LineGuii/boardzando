import type { HuesOptions } from '@boardzando/contracts';
import { HUES_DEFAULT_OPTIONS } from '@boardzando/contracts';

/** Games que expoem um painel de opcoes (para a UI decidir se oferece "trocar"). */
const GAMES_WITH_OPTIONS = new Set(['hues', 'ito', 'pato', 'manada']);

/** Este jogo tem opcoes configuraveis? (usado no reinicio com troca de setup) */
export function gameHasOptions(gameId: string): boolean {
  return GAMES_WITH_OPTIONS.has(gameId);
}

/**
 * Painel de opcoes do jogo, exibido na sala apos a criacao e antes do start.
 * Generico: cada gameId tem o seu sub-painel. O valor escolhido entra no
 * payload de `room:start` como `gameOptions`.
 */
export function GameOptionsPanel({
  gameId,
  value,
  onChange,
}: {
  gameId: string;
  value: unknown;
  onChange: (next: unknown) => void;
}): JSX.Element | null {
  if (gameId === 'hues') {
    return (
      <HuesOptionsPanel
        value={(value ?? HUES_DEFAULT_OPTIONS) as HuesOptions}
        onChange={onChange as (v: HuesOptions) => void}
      />
    );
  }
  if (gameId === 'ito') {
    return (
      <ItoOptionsPanel
        value={(value ?? ITO_DEFAULT_OPTIONS) as ItoOptions}
        onChange={onChange as (v: ItoOptions) => void}
      />
    );
  }
  if (gameId === 'pato') {
    return (
      <PatoOptionsPanel
        value={(value ?? PATO_DEFAULT_OPTIONS) as PatoOptions}
        onChange={onChange as (v: PatoOptions) => void}
      />
    );
  }
  if (gameId === 'manada') {
    return (
      <ManadaOptionsPanel
        value={(value ?? MANADA_DEFAULT_OPTIONS) as ManadaOptions}
        onChange={onChange as (v: ManadaOptions) => void}
      />
    );
  }
  return null;
}

interface ManadaOptions {
  targetCows: 5 | 8 | 11;
}
const MANADA_DEFAULT_OPTIONS: ManadaOptions = { targetCows: 8 };

function ManadaOptionsPanel({
  value,
  onChange,
}: {
  value: ManadaOptions;
  onChange: (next: ManadaOptions) => void;
}): JSX.Element {
  return (
    <div className="shell-options-panel">
      <h3>Opções da partida (Efeito Manada) 🐄</h3>
      <div className="shell-options-field">
        <label className="shell-label">Vacas para vencer</label>
        <div className="shell-options-buttons">
          {([5, 8, 11] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`shell-options-btn ${value.targetCows === n ? 'active' : ''}`}
              onClick={() => onChange({ targetCows: n })}
            >
              🐄 {n} {n === 5 ? '(rápido)' : n === 8 ? '(padrão)' : '(longo)'}
            </button>
          ))}
        </div>
        <p className="shell-hint">
          Escreva a mesma resposta que a maioria para ganhar vacas. Ficar sozinho
          te dá a Vaca Rosa — e com ela você não vence!
        </p>
      </div>
    </div>
  );
}

interface PatoOptions {
  roundsTotal: 5 | 8 | 12;
}
const PATO_DEFAULT_OPTIONS: PatoOptions = { roundsTotal: 8 };

function PatoOptionsPanel({
  value,
  onChange,
}: {
  value: PatoOptions;
  onChange: (next: PatoOptions) => void;
}): JSX.Element {
  return (
    <div className="shell-options-panel">
      <h3>Opções da partida (Nem a Pato) 🦆</h3>
      <div className="shell-options-field">
        <label className="shell-label">Número de rodadas</label>
        <div className="shell-options-buttons">
          {([5, 8, 12] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`shell-options-btn ${value.roundsTotal === n ? 'active' : ''}`}
              onClick={() => onChange({ roundsTotal: n })}
            >
              {n} {n === 5 ? '(rápido)' : n === 8 ? '(padrão)' : '(longo)'}
            </button>
          ))}
        </div>
        <p className="shell-hint">
          Perguntas de fatos curiosos e absurdos — ganha quem chegar mais perto.
        </p>
      </div>
    </div>
  );
}

interface ItoOptions {
  lives: number;
  maxLevel: number;
  uniqueThemes: boolean;
  anonymousCards: boolean;
}
const ITO_DEFAULT_OPTIONS: ItoOptions = {
  lives: 3,
  maxLevel: 3,
  uniqueThemes: true,
  anonymousCards: false,
};

function ItoOptionsPanel({
  value,
  onChange,
}: {
  value: ItoOptions;
  onChange: (next: ItoOptions) => void;
}): JSX.Element {
  return (
    <div className="shell-options-panel">
      <h3>Opções da partida (cooperativo)</h3>
      <div className="shell-options-field">
        <label className="shell-label">Vidas da equipe</label>
        <div className="shell-options-buttons">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`shell-options-btn ${value.lives === n ? 'active' : ''}`}
              onClick={() => onChange({ ...value, lives: n })}
            >
              ❤️ {n}
            </button>
          ))}
        </div>
      </div>
      <div className="shell-options-field">
        <label className="shell-label">Níveis (cartas por jogador no final)</label>
        <div className="shell-options-buttons">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`shell-options-btn ${value.maxLevel === n ? 'active' : ''}`}
              onClick={() => onChange({ ...value, maxLevel: n })}
            >
              {n} {n === 1 ? '(curto)' : n === 3 ? '(completo)' : ''}
            </button>
          ))}
        </div>
        <p className="shell-hint">
          Cada nível dá uma carta a mais por jogador (1 → {value.maxLevel}).
        </p>
      </div>
      <div className="shell-options-field">
        <label className="shell-options-toggle">
          <input
            type="checkbox"
            checked={value.uniqueThemes}
            onChange={(e) => onChange({ ...value, uniqueThemes: e.target.checked })}
          />
          Nunca repetir tema entre níveis
        </label>
        <p className="shell-hint">
          Cada nível ganha um tema diferente durante a partida.
        </p>
      </div>
      <div className="shell-options-field">
        <label className="shell-options-toggle">
          <input
            type="checkbox"
            checked={value.anonymousCards ?? false}
            onChange={(e) => onChange({ ...value, anonymousCards: e.target.checked })}
          />
          Modo anônimo (cartas embaralhadas) 🎭
        </label>
        <p className="shell-hint">
          Ninguém sabe de quem é cada carta nem quem votou nela: depois das
          dicas, as cartas são embaralhadas na mesa.
        </p>
      </div>
    </div>
  );
}

function HuesOptionsPanel({
  value,
  onChange,
}: {
  value: HuesOptions;
  onChange: (next: HuesOptions) => void;
}): JSX.Element {
  return (
    <div className="shell-options-panel">
      <h3>Opcoes da partida</h3>
      <div className="shell-options-field">
        <label className="shell-label">Rodadas por jogador como cue-giver</label>
        <div className="shell-options-buttons">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`shell-options-btn ${value.roundsPerPlayer === n ? 'active' : ''}`}
              onClick={() => onChange({ ...value, roundsPerPlayer: n })}
            >
              {n}× {n === 1 ? '(rapido)' : n === 2 ? '(padrao)' : '(longo)'}
            </button>
          ))}
        </div>
      </div>
      <div className="shell-options-field">
        <label className="shell-options-toggle">
          <input
            type="checkbox"
            checked={value.liveGuesses}
            onChange={(e) => onChange({ ...value, liveGuesses: e.target.checked })}
          />
          Mostrar palpites dos outros em tempo real
        </label>
        <p className="shell-hint">
          Quando desligado, cada palpitador so ve seu proprio cone ate todos
          colocarem o deles.
        </p>
      </div>
    </div>
  );
}
