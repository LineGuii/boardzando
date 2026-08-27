import type { EmperiumOptions, HuesOptions } from '@boardzando/contracts';
import {
  DONO_MODO_ROTULO,
  EMPERIUM_DEFAULT_OPTIONS,
  HUES_DEFAULT_OPTIONS,
} from '@boardzando/contracts';
import { useGame } from '../net/store';

/** Games que expoem um painel de opcoes (para a UI decidir se oferece "trocar"). */
const GAMES_WITH_OPTIONS = new Set([
  'hues',
  'ito',
  'pato',
  'manada',
  'flip7',
  'stopconnect',
  'emperium',
]);

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
  if (gameId === 'emperium') {
    return (
      <EmperiumOptionsPanel
        value={(value ?? EMPERIUM_DEFAULT_OPTIONS) as EmperiumOptions}
        onChange={onChange as (v: EmperiumOptions) => void}
      />
    );
  }
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
  if (gameId === 'flip7') {
    return (
      <Flip7OptionsPanel
        value={(value ?? FLIP7_DEFAULT_OPTIONS) as Flip7Options}
        onChange={onChange as (v: Flip7Options) => void}
      />
    );
  }
  if (gameId === 'stopconnect') {
    return (
      <StopConnectOptionsPanel
        value={(value ?? STOPCONNECT_DEFAULT_OPTIONS) as StopConnectOptions}
        onChange={onChange as (v: StopConnectOptions) => void}
      />
    );
  }
  return null;
}

interface StopConnectOptions {
  targetScore: 50 | 75 | 100;
  turnSeconds: 0 | 60 | 120 | 180;
}
const STOPCONNECT_DEFAULT_OPTIONS: StopConnectOptions = { targetScore: 50, turnSeconds: 120 };

function StopConnectOptionsPanel({
  value,
  onChange,
}: {
  value: StopConnectOptions;
  onChange: (next: StopConnectOptions) => void;
}): JSX.Element {
  const turnSeconds = value.turnSeconds ?? 120;
  return (
    <div className="shell-options-panel">
      <h3>Opções da partida (StopConnect) 🔤</h3>
      <div className="shell-options-field">
        <label className="shell-label">Pontos para disparar o último turno</label>
        <div className="shell-options-buttons">
          {([50, 75, 100] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`shell-options-btn ${value.targetScore === n ? 'active' : ''}`}
              onClick={() => onChange({ ...value, targetScore: n })}
            >
              {n} {n === 50 ? '(padrão)' : n === 75 ? '(médio)' : '(longo)'}
            </button>
          ))}
        </div>
      </div>
      <div className="shell-options-field">
        <label className="shell-label">Tempo por turno (passa a vez ao esgotar)</label>
        <div className="shell-options-buttons">
          {([60, 120, 180, 0] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`shell-options-btn ${turnSeconds === n ? 'active' : ''}`}
              onClick={() => onChange({ ...value, turnSeconds: n })}
            >
              {n === 0 ? 'Sem limite' : `${n / 60} min`}
              {n === 120 ? ' (padrão)' : ''}
            </button>
          ))}
        </div>
        <p className="shell-hint">
          Coloque Letras ao lado de Temas (e vice-versa) e diga uma resposta para
          cada peça vizinha. Quem atinge o alvo dispara o último turno.
        </p>
      </div>
    </div>
  );
}

interface Flip7Options {
  targetScore: 100 | 200 | 300;
}
const FLIP7_DEFAULT_OPTIONS: Flip7Options = { targetScore: 200 };

function Flip7OptionsPanel({
  value,
  onChange,
}: {
  value: Flip7Options;
  onChange: (next: Flip7Options) => void;
}): JSX.Element {
  return (
    <div className="shell-options-panel">
      <h3>Opções da partida (Flip 7)</h3>
      <div className="shell-options-field">
        <label className="shell-label">Pontos para vencer</label>
        <div className="shell-options-buttons">
          {([100, 200, 300] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`shell-options-btn ${value.targetScore === n ? 'active' : ''}`}
              onClick={() => onChange({ targetScore: n })}
            >
              {n} {n === 100 ? '(rápido)' : n === 200 ? '(padrão)' : '(longo)'}
            </button>
          ))}
        </div>
        <p className="shell-hint">
          Vire cartas sem repetir número. 7 números únicos = Flip 7 (+15)!
        </p>
      </div>
    </div>
  );
}

interface ManadaOptions {
  targetCows: 5 | 8 | 11;
}
const MANADA_DEFAULT_OPTIONS: ManadaOptions = { targetCows: 8 };

/**
 * Quem defende o castelo.
 *
 * Defender e o papel mais assimetrico do jogo — um contra todos, com renda
 * maior e o Salao do Trono a favor — entao quem senta na cadeira importa.
 * Sortear e o padrao por ser o mais justo com uma mesa que esta aprendendo;
 * quem ja conhece costuma querer decidir.
 *
 * "Quem abriu a sala" e resolvido AQUI para um playerId concreto, porque o
 * cliente sabe quem e o host e o servidor nao — la o `setup` so recebe a
 * lista de jogadores. O servidor confere se o id esta mesmo na mesa e cai no
 * sorteio se nao estiver.
 */
function EmperiumOptionsPanel({
  value,
  onChange,
}: {
  value: EmperiumOptions;
  onChange: (next: EmperiumOptions) => void;
}): JSX.Element {
  const room = useGame((s) => s.room);
  const jogadores = room?.players ?? [];
  const hostId = room?.hostId;
  const nomeDoHost = jogadores.find((j) => j.id === hostId)?.name;

  const escolher = (modo: EmperiumOptions['donoDoCastelo']) => {
    if (modo === 'sorteio') return onChange({ donoDoCastelo: 'sorteio' });
    if (modo === 'anfitriao') {
      return onChange({ donoDoCastelo: 'anfitriao', donoDoCasteloId: hostId });
    }
    // "Eu escolho" ja entra com alguem selecionado, para nao ficar num estado
    // pela metade que cairia no sorteio sem o host perceber.
    onChange({
      donoDoCastelo: 'escolhido',
      donoDoCasteloId: value.donoDoCasteloId ?? jogadores[0]?.id,
    });
  };

  return (
    <div className="shell-options-panel">
      <h3>Opções da partida (Guerra do Emperium) 🏰</h3>
      <div className="shell-options-field">
        <label className="shell-label">Quem é o dono do castelo</label>
        <div className="shell-options-buttons">
          {(['sorteio', 'anfitriao', 'escolhido'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`shell-options-btn ${value.donoDoCastelo === m ? 'active' : ''}`}
              onClick={() => escolher(m)}
            >
              {m === 'sorteio' && '🎲 '}
              {m === 'anfitriao' && '👑 '}
              {m === 'escolhido' && '🫵 '}
              {DONO_MODO_ROTULO[m]}
            </button>
          ))}
        </div>

        {value.donoDoCastelo === 'escolhido' && (
          <div className="shell-options-buttons" style={{ marginTop: 8 }}>
            {jogadores.map((j) => (
              <button
                key={j.id}
                type="button"
                className={`shell-options-btn ${value.donoDoCasteloId === j.id ? 'active' : ''}`}
                onClick={() => onChange({ donoDoCastelo: 'escolhido', donoDoCasteloId: j.id })}
              >
                {j.name}
              </button>
            ))}
          </div>
        )}

        <p className="shell-hint">
          {value.donoDoCastelo === 'sorteio' &&
            'A fortaleza cai para quem o destino escolher — ninguém sabe até a partida começar.'}
          {value.donoDoCastelo === 'anfitriao' &&
            `${nomeDoHost ?? 'Quem abriu a sala'} defende. É o papel que exige mais atenção: um contra todos.`}
          {value.donoDoCastelo === 'escolhido' &&
            'Aponte quem senta na cadeira. Bom para pôr o veterano da mesa para defender contra os novatos.'}
        </p>
        <p className="shell-hint">
          O defensor começa com mais zeny, um personagem a mais, guardiões nas salas
          internas e +2 no Salão do Trono — mas joga sozinho contra todo mundo.
        </p>
      </div>
    </div>
  );
}

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
