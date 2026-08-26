# Guerra do Emperium

Board game original de cerco a castelo, inspirado na **War of Emperium** do Ragnarok
Online. Clãs rivais invadem uma fortaleza para quebrar o cristal no seu coração —
e **ninguém ali é aliado de ninguém**.

Roda como plugin do Boardzando (multiplayer web, 3 a 5 jogadores) e foi desenhado para
funcionar também em print-and-play.

---

## Em uma frase

Você recruta mercenários, evolui os que sobrevivem, e a cada rodada compromete essa gente
em salas do castelo **em segredo e ao mesmo tempo que todo mundo** — descobrindo só na
revelação onde os rivais apostaram.

**A decisão central é onde *não* colocar sua gente.** Você tem tropa para duas salas e
ambição para quatro.

---

## Como funciona

### O ciclo

Seis rodadas, cinco fases cada:

| Fase | O que acontece |
|---|---|
| **Renda** | 6 zeny para todos; +6 para quem está com o castelo. Simultâneo. |
| **Mercado** | 3 ações por jogador, em ordem **inversa à Glória** — quem perde compra primeiro. |
| **Comprometimento** | De bruços e ao mesmo tempo: personagens, uma Ordem e um combo por sala. |
| **Resolução** | Vira tudo. As salas resolvem do Portão para dentro. |
| **Fim de rodada** | Renda das salas, Glória do dono do castelo, Enfermaria volta à Reserva. |

### Combate sem dados

Um confronto de sala é **aritmética determinística** sobre informação que acabou de ser
revelada. Toda a incerteza do jogo já aconteceu antes: no que o mercado ofereceu e em não
saber onde os outros foram. O único dado da caixa é do refino de equipamento, onde o
push-your-luck é a graça.

### As quatro camadas

**1. Recrutamento.** 26 variações base (13 classes × 2), numa fileira sorteada e
disputada. Oportunismo: você compra o que apareceu.

**2. Transcendência.** 39 evoluções (13 classes × 3), compradas no Altar a partir da
rodada 3 **para um personagem que já é seu**. A carta é empilhada sobre a base: Poder e
palavras-chave **somam**, o equipamento fica. O veterano que sobreviveu a quatro rodadas é
*o próprio* que vira Arquimago. Como a evolução soma, qual base você evoluiu importa até o
fim — são 6 desfechos por classe, 78 no total.

**3. Equipamento.** Armas, armaduras e acessórios, com **cartas de monstro encaixáveis**
(Thara Frog, Hydra, Ghostring…) e refino +0 a +3 com risco de quebrar.

**4. Combos.** A linha que faz os personagens agirem como clã: algumas cartas **nomeiam
outro personagem**. "COMBO Bruxo: seu clã ignora toda a Muralha inimiga." Só um combo
dispara por sala, declarado no comprometimento.

### O castelo

Sete salas em losango, do Portão até o Emperium. Quatro delas são **fichas de ala**
sorteadas de um pool de doze, então cada partida tem textura diferente sem mudar a
geometria.

**Toda sala é alcançável desde a rodada 1** — o que varia é o preço. Ir além da sua linha
de frente é uma **Marcha Forçada**: −2 de Poder por sala de distância. Tomar uma sala
aproxima a linha e barateia a próxima.

### Como se vence

Por **Glória**, não por matar. Segurar o castelo dá 2 por rodada e 8 na última; quebrar o
Emperium paga 1 por cubo de dano seu mais 3 para quem toma. Derrotar personagens inimigos
dá **zero** — de propósito, senão o jogo vira briga de rua no pátio e ninguém entra no
castelo.

---

## Documentos

| Documento | Para quem |
|---|---|
| **[Manual do Jogador](manual-do-jogador.md)** · [versão web](manual.html) | Quem vai jogar e precisa da regra exata. Referência completa. |
| **[Todas as cartas](04-todas-as-cartas.md)** · [versão web](cartas.html) | O catálogo completo — 65 personagens, 30 equipamentos, monstros e consumíveis, agrupados por classe. **Gerado do código**, então não pode divergir do jogo. |
| **[A Queda de Glast Heim](03-partida-narrada.md)** | Uma partida inteira narrada, quatro jogadores, seis rodadas — com baixas, combos, marcas, evolução, forja e o Emperium caindo duas vezes. O melhor jeito de ver as regras funcionando juntas. |
| **[Tutorial](tutorial.html)** | Quem nunca jogou. Ensina pela primeira partida, com exemplo comentado. |
| **[Design v0.2](02-design-v0.2.md)** · [versão web](design-v0.2.html) | Quem quer entender *por que* cada regra existe. O documento de design atual. |
| [Design v0.1](01-design-v0.1.md) | Registro histórico. Mantém as tabelas completas das 26 bases e 39 evoluções. |
| [Prompt mestre](00-prompt-mestre.md) | O briefing que gerou a v0.1. Útil como checklist do que uma versão precisa cobrir. |

---

## Estado

**Jogável.** O Modo 3 (Cerco) roda completo no Boardzando, com 197 testes cobrindo o
motor de resolução — incluindo o exemplo trabalhado do design reproduzido número a número.

### O que está pronto

- Modo 3 (Cerco): um defensor, os demais atacam
- Marcha Forçada e avanço da linha de frente
- Transcendência com os 39 caminhos
- Combos, as três marcas e o Rapto
- Equipamento, refino e cartas de monstro
- Reposicionamento de Guardiões (ação exclusiva do defensor)

### O que falta

- **Modo 1** (Assalto Selvagem) e **Modo 2** (Guerra dos Reinos) — desenhados, não
  implementados
- Consumíveis são compráveis mas ainda não têm seletor na interface
- Comprar carta de monstro existe no servidor, sem botão na tela
- **Playtest físico de verdade: nada disso foi jogado numa mesa ainda**

---

## Código

```
apps/server/src/games/emperium/
├── emperium.cards.ts    # re-export do catálogo (que vive em contracts)
├── emperium.rooms.ts    # as 12 fichas de ala, topologia, constantes
├── emperium.state.ts    # o estado serializável + slotDistances (Marcha Forçada)
├── emperium.resolve.ts  # o motor: keywords, combos, marcas, escudo do Emperium
├── emperium.moves.ts    # ciclo da rodada em reducers puros
├── emperium.game.ts     # a GameDefinition
└── emperium.game.spec.ts

apps/web/src/games/emperium/EmperiumBoard.tsx   # tabuleiro
packages/contracts/src/emperium.ts              # catálogo compartilhado
```

O catálogo vive em `contracts` porque o frontend precisa dos mesmos números para desenhar
as cartas — nome, custo, poder e palavras-chave são dados compartilhados, não regra de
servidor.

### Uma decisão de arquitetura que contraria a convenção do repo

**Todos os moves são off-turn, e isso é deliberado.** O turno circular do engine não
expressa este jogo: a ordem do mercado é **inversa à Glória e recalculada a cada rodada**,
e o comprometimento é **simultâneo**. Em vez de torcer o `nextPlayer`, a ordem vive no
estado e cada move valida `jogadorDoMercado(state)` devolvendo `INVALID_MOVE` — o gate
continua server-side e autoritativo.

Consequência: o tabuleiro **não usa `<TurnGate>`**. Ele habilita os controles comparando
com `view.jogadorDoMercado` e `view.confirmados`.

```bash
pnpm --filter @boardzando/server test
```

---

## Sobre o Ragnarok Online

O jogo é **original e inspirado**, não uma adaptação licenciada. Nenhum sprite, arte ou
material da Gravity Corp. é usado ou reproduzido — as cartas são desenhadas em CSS/SVG
próprios. Os nomes de classe em português (Cavaleiro, Bruxo, **Mercenário = Assassin**,
Arruaceiro = Rogue…) e as referências de build são vocabulário de fãs, usado para que quem
jogou reconheça o que cada carta representa.
