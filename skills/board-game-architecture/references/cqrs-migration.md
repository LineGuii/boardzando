# Migrar o gateway para CQRS (@nestjs/cqrs)

Objetivo: desacoplar "executar uma jogada" de "reagir a uma jogada" (broadcast,
persistência, métricas), para que novos side-effects entrem sem editar o
gateway. Faça isso quando a lógica crescer — não antes.

## 1. Importe o CqrsModule

No `CoreModule`, adicione `CqrsModule` aos imports (`@nestjs/cqrs` já está nas
dependências do servidor).

## 2. Defina o Command

```ts
// core/cqrs/commands/play-move.command.ts
export class PlayMoveCommand {
  constructor(
    public readonly roomId: string,
    public readonly playerId: string,
    public readonly type: string,
    public readonly data: unknown,
  ) {}
}
```

## 3. Handler do Command (faz a mutação + publica o fato)

```ts
@CommandHandler(PlayMoveCommand)
export class PlayMoveHandler implements ICommandHandler<PlayMoveCommand> {
  constructor(
    private readonly rooms: RoomService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(cmd: PlayMoveCommand): Promise<void> {
    const room = this.rooms.getOrThrow(cmd.roomId);
    if (!room.instance) throw new WsException({ code: 'INVALID_MOVE', message: 'Partida não iniciada.' });
    room.instance.applyMove(cmd.playerId, cmd.type, cmd.data);

    this.eventBus.publish(new MovePlayedEvent(cmd.roomId));
    if (room.instance.isOver) {
      room.status = 'finished';
      this.eventBus.publish(new GameOverEvent(cmd.roomId, room.instance.snapshot.gameover!));
    }
  }
}
```

## 4. Events de domínio

```ts
export class MovePlayedEvent { constructor(public readonly roomId: string) {} }
export class GameOverEvent {
  constructor(public readonly roomId: string, public readonly result: GameOverResult) {}
}
```

## 5. EventHandlers desacoplados

O broadcast deixa de morar no gateway. Injete o `Server` do socket via um
provider (ex.: exponha o `server` do gateway num `SocketServerProvider`).

```ts
@EventsHandler(MovePlayedEvent)
export class BroadcastStateOnMove implements IEventHandler<MovePlayedEvent> {
  constructor(private readonly rooms: RoomService, private readonly io: SocketServerProvider) {}
  handle(ev: MovePlayedEvent): void {
    const room = this.rooms.get(ev.roomId);
    if (!room?.instance) return;
    const { turn, phase } = room.instance.snapshot;
    for (const p of room.players.values()) {
      if (p.connected && p.socketId) {
        this.io.server.to(p.socketId).emit('game:state', {
          roomId: ev.roomId, view: room.instance.viewFor(p.id), turn, phase,
        });
      }
    }
  }
}
```

Agora adicionar "persistir histórico" ou "métricas" = só criar mais um
`@EventsHandler(MovePlayedEvent)`. O gateway não muda.

## 6. Gateway vira fino

```ts
@SubscribeMessage('game:move')
async onMove(@ConnectedSocket() client, @MessageBody() dto: GameMoveDto) {
  await this.commandBus.execute(
    new PlayMoveCommand(dto.roomId, client.data.player.id, dto.type, dto.data),
  );
  return { ok: true };
}
```

## 7. Sagas (opcional, para fluxos multi-etapa)

Ex.: a fase de desafio do `wild_draw4` pode ser orquestrada por uma Saga que
escuta `WildDraw4PlayedEvent` e dispara `OpenChallengeWindowCommand`.

## Migração incremental

Faça por evento: comece pelo `game:move` (maior payoff), valide com os testes
e2e, depois mova `room:start` e `chat:send`. Mantenha o filtro/validação como
estão — CQRS é ortogonal a eles.
