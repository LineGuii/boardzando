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
});
