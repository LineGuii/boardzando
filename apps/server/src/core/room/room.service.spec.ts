import type { GameDefinition } from '@boardzando/contracts';
import { RoomService } from './room.service';
import type { GameRegistryService } from '../registry/game-registry.service';

/** GameDefinition mínima só para instanciar uma partida nos testes. */
const fakeDef: GameDefinition = {
  id: 'fake',
  name: 'Fake',
  minPlayers: 1,
  maxPlayers: 4,
  setup: () => ({}),
  moves: {},
};

function makeService(): RoomService {
  const registry = {
    getOrThrow: () => fakeDef,
    get: () => fakeDef,
  } as unknown as GameRegistryService;
  return new RoomService(registry);
}

describe('RoomService — reinicio de partida', () => {
  it('permite reiniciar uma partida finalizada (lobby/finished -> playing)', () => {
    const svc = makeService();
    const room = svc.createRoom({
      gameId: 'fake',
      passwordHash: '',
      host: { id: 'h', name: 'Host', connected: true },
    });
    svc.startGame(room.id, 'h'); // lobby -> playing
    expect(room.status).toBe('playing');

    room.status = 'finished'; // simula fim de jogo
    expect(() => svc.startGame(room.id, 'h')).not.toThrow();
    expect(room.status).toBe('playing');
    expect(room.instance).toBeDefined();
  });

  it('bloqueia iniciar enquanto ha partida em andamento', () => {
    const svc = makeService();
    const room = svc.createRoom({
      gameId: 'fake',
      passwordHash: '',
      host: { id: 'h', name: 'Host', connected: true },
    });
    svc.startGame(room.id, 'h');
    expect(() => svc.startGame(room.id, 'h')).toThrow(/ALREADY_STARTED/);
  });

  it('apenas o host pode (re)iniciar', () => {
    const svc = makeService();
    const room = svc.createRoom({
      gameId: 'fake',
      passwordHash: '',
      host: { id: 'h', name: 'Host', connected: true },
    });
    expect(() => svc.startGame(room.id, 'outro')).toThrow(/ONLY_HOST_CAN_START/);
  });

  it('reiniciar reusa as opcoes do primeiro start (sem reenvio do cliente)', () => {
    // def que registra o setupData recebido em cada partida
    const seen: unknown[] = [];
    const recordingDef: GameDefinition = {
      ...fakeDef,
      setup: (_ctx, setupData) => {
        seen.push(setupData);
        return {};
      },
    };
    const registry = {
      getOrThrow: () => recordingDef,
      get: () => recordingDef,
    } as unknown as GameRegistryService;
    const svc = new RoomService(registry);
    const room = svc.createRoom({
      gameId: 'fake',
      passwordHash: '',
      host: { id: 'h', name: 'Host', connected: true },
    });

    svc.startGame(room.id, 'h', { lives: 5, uniqueThemes: true }); // opcoes do painel
    room.status = 'finished'; // simula fim
    svc.startGame(room.id, 'h'); // "Reiniciar jogo" — sem opcoes

    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual({ lives: 5, uniqueThemes: true });
    expect(seen[1]).toEqual({ lives: 5, uniqueThemes: true }); // reusou as mesmas
  });
});
