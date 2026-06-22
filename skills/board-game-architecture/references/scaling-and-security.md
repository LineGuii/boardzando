# Escala e endurecimento (hardening)

## Escalar para múltiplas instâncias

Quando uma instância não basta:

1. **Adaptador Redis do Socket.IO**: instale `@socket.io/redis-adapter` + um
   cliente Redis e registre no `AuthIoAdapter.createIOServer` via
   `server.adapter(createAdapter(pub, sub))`. Isso propaga `emit`/rooms entre
   processos — broadcasts passam a alcançar clientes em qualquer instância.

2. **Store de salas distribuído**: hoje `RoomService` usa um `Map` em memória.
   Para N instâncias, persista `Room`/`MatchState` em Redis (chave por
   `roomId`). Mantenha a interface pública do `RoomService` — só a implementação
   muda. `MatchState` (incl. `rngState`) é serializável de propósito.

3. **Sticky sessions** ou full Redis: com o adaptador Redis, sticky não é
   obrigatório para correção, mas reduz reconexões. Atrás do Cloudflare/again
   proxy, prefira WebSocket puro (já configurado no client) para evitar o
   handshake de polling.

4. **Jobs/timeouts** (timeout de turno, limpeza de salas órfãs): use **BullMQ**
   sobre Redis em vez de `setTimeout` em processo (que não sobrevive a
   restart/escala).

## Checklist de hardening do WebSocket

- [ ] JWT validado no handshake (AuthIoAdapter) — conexão sem token é recusada.
- [ ] `JWT_SECRET` forte (>= 32 bytes aleatórios), fora do versionamento.
- [ ] `expiresIn` curto no JWT de sessão (15–60 min).
- [ ] `ValidationPipe` com whitelist/forbidNonWhitelisted/transform em todo
      handler; erros via `WsException` (não vazar stack/HTTP 500).
- [ ] Rate limit por handler (`@Throttle` + `WsThrottlerGuard`): mais apertado
      em chat e join.
- [ ] Argon2id nos params OWASP (memory >= 19 MiB) na senha de sala; nunca
      armazenar a senha em claro.
- [ ] `/rooms/join` com throttle anti-brute-force por IP (e idealmente por
      roomId).
- [ ] CORS restrito a `WEB_ORIGIN`.
- [ ] Limites de tamanho nos DTOs (`@MaxLength`) — evita payloads gigantes.
- [ ] Autorização por ação no servidor: o engine valida "é a vez deste
      jogador"; nunca confie no cliente para legalidade de move.
- [ ] `playerView` aplicado SEMPRE no broadcast — nunca emitir o estado bruto
      (vazaria mãos/segredos).

## Cloudflare Tunnel — pontos de atenção

- WebSocket/WSS funciona sem config extra; TLS termina na borda.
- Implemente **heartbeat/keepalive**: a Cloudflare encerra WS ociosos e pode
  reiniciar servidores ao liberar código novo. O socket.io já faz ping/pong;
  confirme `pingInterval`/`pingTimeout` e a reconexão no client.
- DNS é um CNAME para `<UUID>.cfargotunnel.com` (criado pelo
  `cloudflared tunnel route dns`).
- Regra `ingress` catch-all (`http_status:404`) é obrigatória, senão o
  `cloudflared` não inicia.
- Cloudflare Access (opcional) adiciona login antes do app; protege HTTP — para
  WS o gating efetivo continua no handshake (JWT).

## Observabilidade (quando crescer)

- Log estruturado por sala/jogador (já há `Logger` por serviço).
- Métricas: nº de salas ativas, jogadores conectados, taxa de moves inválidos
  (sinal de bug de regra ou cliente malicioso) — fácil de plugar como
  `@EventsHandler` depois da migração CQRS.
