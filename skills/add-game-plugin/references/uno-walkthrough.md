# UNO destrinchado: um plugin completo, arquivo a arquivo

O UNO é o jogo de referência. Ele exercita os pontos difíceis do contrato:
informação secreta (mãos), aleatoriedade (baralho), efeitos de turno (skip /
reverse / draw2 / wild_draw4) e fim de jogo. Use-o como gabarito.

Arquivos em `apps/server/src/games/uno/`.

## 1. Estado — `uno.state.ts`

Define `UnoCard`, `UnoColor`, `CardKind` e `UnoState`. Pontos-chave do desenho:

- O estado é **totalmente serializável** (só dados). Isso permite snapshot e,
  no futuro, persistência/replay.
- `direction: 1 | -1` modela o sentido de jogo (reverse inverte).
- `skipNext: boolean` é a ponte entre um move e o motor de turnos: um move
  sinaliza "pule o próximo" sem poder mexer na ordem de turno diretamente.
- `activeColor` guarda a cor corrente (relevante após um curinga).

## 2. Baralho e helpers — `uno.deck.ts`

Funções **puras/auxiliares** (não são moves, mas são usadas por eles):

- `buildDeck()` monta as 108 cartas com ids estáveis.
- `drawCards(state, random, count)` compra do topo, **reembaralhando o
  descarte** se o deck zerar (`reshuffleDiscardIntoDeck`).
- `isPlayable(card, topColor, top)` centraliza a regra de legalidade (mesma cor,
  mesmo valor, mesmo símbolo, ou curinga).

Separar isso de `uno.moves.ts` mantém os reducers legíveis e os helpers
testáveis isoladamente.

## 3. Moves — `uno.moves.ts`

Dois reducers puros e a função de ordem de turno:

- `playCard`: valida posse e legalidade; remove a carta da mão; descarta;
  resolve efeitos. Para `draw2`/`wild_draw4`, calcula a vítima (próximo jogador
  no sentido atual), **adiciona cartas à mão dela** e marca `skipNext = true`.
  Para `reverse`, inverte `direction` (e, com 2 jogadores, vira um skip — regra
  oficial). Curinga sem `chosenColor` retorna `INVALID_MOVE`.
- `drawCard`: compra 1 carta; pela regra simplificada, comprar **encerra o
  turno** (mantém o avanço de turno do engine limpo).
- `unoNextPlayer(state, ctx)`: lê `direction` e `skipNext` para decidir o
  próximo jogador (passo 1 ou 2). **Não limpa `skipNext`** — quem limpa é o
  `turn.onBegin` no `uno.game.ts`, porque `nextPlayer` é só leitura.

> Padrão reutilizável: **efeitos que alteram a ordem de turno viram flags no
> estado, consumidas por `turn.nextPlayer` + `turn.onBegin`.** Use isso em
> qualquer jogo com skip/reverse/jogar de novo.

## 4. GameDefinition — `uno.game.ts`

Costura tudo:

- `setup`: embaralha o baralho, distribui 7 cartas por jogador e vira a primeira
  carta (garantindo que não seja curinga, por simplicidade). Tudo via
  `ctx.random`.
- `moves = { playCard, drawCard }`.
- `turn = { nextPlayer: unoNextPlayer, onBegin: limpa skipNext }`.
- `endIf`: retorna `{ winner }` quando alguém zera a mão (o move já marca
  `state.winner`).
- `playerView`: **a parte mais importante para info secreta** — devolve a mão do
  próprio jogador, mas só a **contagem** de cartas dos oponentes, além do topo
  do descarte, cor ativa e tamanho do deck. É isso que cada cliente recebe.

A classe é `@Injectable() @GamePlugin()`; `uno.module.ts` apenas a provê.

## 5. Testes — `uno.game.spec.ts`

Mostra o pagamento da arquitetura: as regras são testadas **sem rede**. Técnica
usada nos testes: criar a partida com `GameInstance.create`, e quando é preciso
um cenário específico (uma carta concreta na mão), montar o estado e usar
`GameInstance.restore(def, { ...snapshot, state })`. Casos cobertos: distribuição
inicial, passar a vez, jogar fora da vez, carta inexistente, skip, curinga
(sem/com cor), draw2, vitória, `playerView` escondendo mãos e **determinismo por
seed**.

## O que foi deixado de propósito (bons primeiros exercícios)

- **"Dizer UNO"** e penalidade por esquecer (comprar 2). Sugestão: um move
  `sayUno` + flag por jogador + verificação ao jogar a penúltima carta.
- **Desafio do `wild_draw4`** (fase de contestação). Sugestão: uma `phase`
  `challengeWildDraw4` com `next` de volta para `play`.
- **Empilhar `draw2`/`draw4`** (variante house-rule). Sugestão: acumular em
  `pendingDraw` no estado.

Cada um desses encaixa no contrato sem tocar no núcleo — exatamente o ponto da
plataforma plugável.
