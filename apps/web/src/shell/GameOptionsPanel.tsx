import type { HuesOptions } from '@boardzando/contracts';
import { HUES_DEFAULT_OPTIONS } from '@boardzando/contracts';

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
  return null;
}

interface ItoOptions {
  lives: number;
  maxLevel: number;
}
const ITO_DEFAULT_OPTIONS: ItoOptions = { lives: 3, maxLevel: 3 };

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
