# GUERRA DO EMPERIUM — Documento de Design v0.2

> Substitui a [v0.1](01-design-v0.1.md), que fica no repositório como registro histórico.
> Todos os números aqui são **arbitrados**, não sugeridos. Cada um tem uma alavanca de
> ajuste declarada na seção *Riscos e Alavancas*.

---

## O que mudou desde a v0.1

Três mudanças estruturais, cada uma nascida de um defeito concreto.

**1. Marcha Forçada.** Na v0.1 a regra de posicionamento exigia adjacência estrita, e o
resultado era que **na rodada 1 o Portão era a única sala legal para todo atacante**. A
decisão que este jogo diz ser central — onde *não* colocar sua gente — não existia até a
rodada 3, e o defensor, sabendo onde todo mundo ia estar, só precisava empilhar tudo num
lugar. Agora toda sala é alcançável sempre; o que varia é o preço em Poder.

**2. Transcendência virou evolução.** Na v0.1 era um segundo baralho de *personagens*.
Você comprava um Arquimago pronto e o seu Bruxo — o que sobreviveu a quatro rodadas, com
a arma refinada — virava enchimento. O jogo aposentava seus veteranos. Agora a
Transcendência é uma carta **empilhada sobre alguém que já é seu**.

**3. Combos.** As palavras-chave da v0.1 eram todas aritmética *dentro* da própria
clã: ELO soma por aliado, MURALHA subtrai do inimigo. Nenhuma perguntava **quem** está
do seu lado — só quantos. Um Monge ao lado de um Sábio valia o mesmo que ao lado de outro
Monge. Agora personagens se nomeiam.

---

## 1. Pitch

Quatro clãs cercam um castelo e ninguém ali é amigo de ninguém. A cada rodada você
compromete seus mercenários em segredo — quantos, em quais salas, com que Ordem, e qual
combo vai disparar — e só descobre onde os rivais apostaram quando o portão se abre.

**A decisão central é onde *não* colocar sua gente.** Você tem tropa para duas salas e
ambição para quatro; o castelo pertence a quem estiver dentro dele quando a última rodada
acabar, mas quem só espera vê o dono somar pontos rodada após rodada.

---

## 2. Motor central

**Recrutamento em tableau + comprometimento simultâneo oculto + resolução sala a sala.**

Cada jogador mantém uma **Reserva** de personagens recrutados como cartas na sua área. A
cada rodada compromete personagens em salas **de bruços e ao mesmo tempo que todo mundo**,
junto de uma **Ordem** secreta e de um **combo declarado** por sala. Depois tudo vira e as
salas resolvem em sequência, do portão para dentro.

### Consequência: o combate não usa dados

A incerteza vem de duas fontes, e nenhuma delas é aleatória na resolução: **o que está
disponível no mercado** e **onde os rivais apostaram**. Um confronto de sala é aritmética
determinística sobre informação que acabou de ser revelada. Dados aparecem em exatamente
um lugar — o refino de equipamento — porque ali o push-your-luck é a graça.

### Alternativas rejeitadas

**Deckbuilding puro.** Equipamento não sobrevive a um baralho embaralhado: se o personagem
vai para o descarte, a espada +7 some junto e a camada de itens desaba. E o precast da WoE
era *deliberado* — um deckbuilder substitui a intenção por "o que eu comprei este turno".

**Turnos alternados com dados.** Com 5 jogadores o defensor esperaria quatro turnos entre
decisões, o que torna o problema do defensor solitário insolúvel por construção.

---

## 3. Componentes

| Qtd | Componente |
|---|---|
| 84 | Cartas de Personagem base (42 variações × 2 cópias) |
| 42 | Cartas de Transcendência (14 classes × 3 caminhos) |
| 30 | Cartas de Equipamento (12 armas, 10 armaduras, 8 acessórios) |
| 20 | Cartas de Monstro (10 tipos × 2) |
| 24 | Cartas de Consumível (8 tipos × 3) |
| 12 | Fichas de Sala de Ala |
| 3 | Fichas fixas: Portão Principal, Salão do Trono, Sala do Emperium |
| 9 | Fichas de Marca (3 Exposto, 3 Preso, 3 Revelado) |
| 5 | Painéis de jogador (Reserva / Enfermaria / trilha de zeny) |
| 20 | Estandartes de Ordem (4 por jogador × 5) — ver seção 17 |
| 15 | Chevrons de Marcha Forçada (3 por jogador) |
| 10 | Fichas de Sombra (2 por jogador) |
| 5 | Conjuntos de 20 cubos de cor |
| 12 | Fichas de Guardião |
| 1 | Trilha de Glória (0–40) + 5 marcadores |
| 1 | Trilha de Rodada (1–6) com o Escudo do Emperium impresso |
| ~90 | Moedas de zeny |
| 1 | Dado d6 (só para refino) |

---

## 4. A gramática — 20 palavras-chave

| Palavra-chave | Efeito |
|---|---|
| **ALCANCE** | Ataca de longe: só sofre baixa se você não tiver nenhum personagem com PROTEGER (ou DEVOÇÃO) vivo nesta sala. |
| **PROTEGER** | Absorve as baixas da seu clã antes de qualquer outro personagem seu. |
| **MURALHA X** | Reduz em X o Poder Total de **cada** clã inimigo nesta sala. |
| **PERFURAR X** | X pontos do Poder deste personagem ignoram Muralha inimiga. |
| **RAJADA X** | +X de Poder, apenas na primeira rodada em que este personagem entra nesta sala. |
| **ELO X** | +X de Poder para cada **outro** personagem seu nesta sala. |
| **SOLO X** | +X de Poder se este for o seu único personagem nesta sala. |
| **OCULTO** | Na revelação, se o seu clã não estiver REVELADO, ele pode escorregar para uma sala vizinha — sem pagar marcha — e luta lá sem Ordem. |
| **DEVOÇÃO X** | Ele se joga na frente: cada baixa que ele leva conta por X, e os outros ficam de pé. Cai antes até do PROTEGER. |
| **ANULAR** | Você aponta UM personagem inimigo e UMA palavra-chave dele, junto do comprometimento. Se ele não vier para a sala, o Anular se perde. Apontar é obrigatório — e cancelar uma palavra-chave ruim devolve Poder ao inimigo. |
| **RESTAURAR X** | No fim da rodada, mova X personagens da Enfermaria para a Reserva. |
| **PILHAR X** | Se vencer, ganhe X zeny. Com X ≥ 3, ganhe 1 equipamento caído. |
| **ESGOTAR** | Após resolver, este personagem vai para a Enfermaria — vencendo ou perdendo. |
| **IMITAR X** | Copia até X palavras-chave do personagem inimigo de maior Poder de carta nesta sala. Resolve **antes** do ANULAR. |
| **MOVER X** | Encurta a Marcha Forçada em até X salas — você paga só o que passar disso. |
| **FRÁGIL** | Cai antes dos outros do seu clã — só PROTEGER e DEVOÇÃO conseguem passar na frente dele. |
| **BERSERK X** | +X de Poder, e ninguém consegue cobri-lo: é sempre a primeira baixa do seu clã. |
| **MALDIÇÃO X** | −X de Poder deste personagem. Pura perda. |
| **ESTILHAÇAR X** | +X de Poder, mas só na Sala do Emperium. Em qualquer outra sala ele não vale nada — é o especialista em cristal, inútil para segurar corredor. |
| **ARÍETE** | O Poder deste personagem atravessa o Escudo do Emperium: vira dano no cristal sem passar pela absorção. Só existe em Transcendência. |

Toda carta tem **no máximo 2** palavras-chave, mais no máximo **um Combo**.

---

## 5. COMBOS — o coração da v0.2

### O problema que resolve

As palavras-chave são aritmética dentro da própria clã. Elas contam *quantos* aliados
você tem, nunca *quais*. Por isso a Reserva parecia um saco de números em vez de um clã.

### A mecânica

Algumas cartas trazem uma linha extra que **nomeia outro personagem**:

> **COMBO Bruxo:** seus personagens ignoram toda a Muralha inimiga.
> *(ativa se você tiver um Bruxo comprometido na mesma sala)*

Um Combo pode exigir uma **classe** (Bruxo, Monge), um **Papel** (Arcano, Vanguarda), ou
nada — alguns são incondicionais. O portador nunca conta como o próprio companheiro.

### O freio: um combo por sala

**Só UM combo dispara por clã por sala, declarado no comprometimento.** Juntar cinco
personagens não acumula cinco combos.

Isso não é burocracia, é o que impede a mudança de desfazer a anterior: combo puxa para
concentrar, Marcha Forçada e as 4 Ordens puxam para espalhar. Sem o teto, a mesa voltaria
a empilhar todo mundo numa sala só — o defeito que a v0.2 acabou de consertar.

### As três marcas

Vários combos não melhoram o seu grupo: eles **quebram o inimigo para outro aproveitar**.
Isso precisa de um alvo persistente, e o conjunto é fechado em três:

| Marca | Efeito | Origem |
|---|---|---|
| **EXPOSTO** | O clã marcado perde **toda a Muralha**. | Fogo grego quebrando armadura |
| **PRESO** | Perde o bônus da Ordem e **não pode usar Proteger**. | Corpo Fechado + Dilema travando o alvo |
| **REVELADO** | Cancela Oculto: entra na revelação normal. | Falcão do Sniper achando o Mercenário |

Marcas sempre caem na **maior clã inimigo da sala**. O design deixaria a escolha ao
jogador; a versão digital automatiza no alvo óbvio para não travar a resolução pedindo
alvo a cada efeito.

### RAPTO

Um efeito de combo à parte: **arranca 1 personagem do maior clã inimigo da sala**, e
ele volta à Reserva do dono **sem sofrer baixa**. É o Rapto do Arruaceiro criando o 1
contra 1. O alvo é o de maior Poder de carta — o que um jogador escolheria.

**No máximo um Rapto por sala.** Se dois clãs declararem Rapto, nenhum acontece: os dois
se atrapalham. O caos precisa de teto.

### Os 24 combos

**Nas bases** — simples, disponíveis desde a rodada 1:

| Carta | Combo |
|---|---|
| Sábio Proteção de Solo | **COMBO Bruxo:** seu clã ignora toda a Muralha inimiga |
| Templário Defensor | **COMBO Arcano:** seus Arcanos não sofrem baixa |
| Bardo Canção | **COMBO Arcano:** seus Arcanos ganham +3 de Poder |
| Odalisca Dança Lenta | **COMBO Bardo:** +4 de Poder — o dueto |
| Cavaleiro Bola de Boliche | **COMBO Templário:** o maior clã inimigo fica PRESO |
| Monge Corpo de Aço | **COMBO:** o maior clã inimigo fica PRESO |
| Alquimista Boticário | **COMBO:** o maior clã inimigo fica EXPOSTO |
| Caçador Armadilheiro | **COMBO:** o maior clã inimigo fica REVELADO |
| Ferreiro Mercador | **COMBO:** +1 de Poder a cada 5 zeny no seu bolso |
| Arruaceiro Gatuno | **COMBO Ágil:** RAPTO |
| Sacerdote Suporte | **COMBO Vanguarda:** seu clã ignora a Marcha Forçada |
| Mercenário Golpe Sônico | **COMBO Alquimista:** +4 de Poder — ele entra pela brecha |

**Nas Transcendências** — mirabolantes, e algumas substituem o combo da base por uma
versão maior:

| Evolução | Combo |
|---|---|
| Professor — Memorizar | **COMBO Monge:** ninguém seu vai à Enfermaria por Esgotar |
| Criador — Demonstração Ácida | **COMBO:** o maior clã inimigo fica EXPOSTO **e** PRESA |
| Mestre-Ferreiro — Carrocerada | **COMBO:** +1 de Poder a cada **3** zeny *(era 5 na base)* |
| Paladino — Devoção | **COMBO Vanguarda:** se você perder, o vencedor também sofre 1 baixa |
| Desordeiro — Marcha Silenciosa | **COMBO:** RAPTO |
| Atirador de Elite — Olho de Falcão | **COMBO:** o maior clã inimigo fica REVELADO |
| Menestrel/Cigana — Canção Longa | **COMBO Vanguarda:** seu clã ignora a Marcha Forçada |
| Professor — Dissonância | **COMBO:** o maior clã inimigo fica PRESO |
| Paladino — Corrente de Escudo | **COMBO Arcano:** seus Arcanos não sofrem baixa |
| Mestre — Salto | **COMBO:** seu clã ignora a Marcha Forçada |
| Arquimago — Ganbantein | **COMBO Sábio:** seu clã ignora toda a Muralha inimiga |
| Criador — Homúnculo Superior | **COMBO:** +3 de Poder — o homúnculo luta junto |

### A jogada que melhor explica o sistema

**Professor Memorizar + Mestre Punho de Asura na mesma sala.**

O Asura tem ESGOTAR: dá +7 de Poder e vai para a Enfermaria, vencendo ou perdendo. O
Combo do Professor cancela o Esgotar do clã inteiro. Resultado: o Monge bate como um
caminhão **e continua na Reserva para a rodada seguinte.**

Isso é literalmente o Professor devolvendo SP para o segundo Asura, e só é possível
porque um personagem agora enxerga o outro. Custa caro: dois personagens transcendidos na
mesma sala é um investimento de mais de 40 zeny.

---

## 6. Economia

### Moeda única: zeny

Recrutar, equipar, refinar, transcender e comprar consumível saem do mesmo bolso.

### Renda (início da rodada, simultânea)

| Fonte | Valor |
|---|---|
| Base | **6 zeny** |
| Dono do castelo | **+6 zeny** |
| Sala Armazém controlada | **+4 zeny** |

**O dono do castelo é o jogador mais rico da mesa.** É a espinha da agência do defensor.

### Mercado — 3 ações por rodada, e só 3

1. **Recrutar** — pague o custo de uma carta da fileira.
2. **Equipar** — compre equipamento e anexe a um personagem compatível.
3. **Refinar** — 3 zeny, role o d6.
4. **Comprar consumível** — 4 zeny.
5. **Transcender** — 7–14 zeny, evolua um personagem seu (a partir da rodada 3).
6. **Mover um Guardião** — só o dono do castelo.

O limite de 3 ações é o que impede as camadas de item e evolução de virarem jogos
paralelos. Numa rodada em que você transcende, você quase não recruta.

### Os dois mercados funcionam ao contrário um do outro

**Recrutamento** é uma fileira sorteada e disputada: você compra o que apareceu, e o que
não levar o vizinho leva. É **oportunismo**.

**Altar da Transcendência** é uma tabela de preços fixa. Os três caminhos de cada classe
estão sempre lá, sempre pelo mesmo preço, e ninguém tira nada de ninguém. É **plano** —
dá para decidir na rodada 3 que você vai juntar 11 zeny para o Arquimago Nevasca, e
cumprir.

### Ordem de jogo

**Inversa à Glória**: quem tem menos compra primeiro; o dono do castelo compra por último.

---

## 7. O castelo

```
              [SALA DO EMPERIUM]
                      |
              [SALÃO DO TRONO]
                /            \
           [ALA B2]        [ALA C2]
              |                |
           [ALA B1]        [ALA C1]
                \            /
              [PORTÃO PRINCIPAL]
                      |
                 (Reservas)
```

Portão, Salão do Trono e Sala do Emperium são sempre os mesmos. As **quatro alas** vêm de
um pool de 12 fichas sorteadas no setup.

### Marcha Forçada

**Toda sala é alcançável, sempre. O que varia é o preço.**

Sua **linha de frente** é o Portão, mais toda sala que você controlava no fim da rodada
anterior, mais as salas que fazem fronteira com essas. Entrar ali é grátis.

Entrar em qualquer outra sala é uma **Marcha Forçada**: **−2 de Poder por sala de
distância** da sua linha de frente. Tomar uma sala aproxima a linha e barateia a próxima.

Na rodada 1: Portão grátis, alas internas −2, alas fundas −4, Trono −6, Emperium −8.

O dono do castelo **não paga marcha nenhuma** dentro do próprio castelo.

> Não existe mais portão duro no Salão do Trono. A Sala do Emperium custa −8 de marcha, e
> a aritmética faz o trabalho que a proibição fazia — sem tirar a carta de cima da mesa. O
> assalto desesperado de última rodada passou a existir, e o defensor nunca mais pode
> deixar o Emperium vazio.

### As 12 fichas de ala

| Sala | Regra |
|---|---|
| Corredor Estreito | Limite 2 personagens por clã. |
| Pátio Aberto | Limite 4 por clã. Personagens com Alcance têm +1 de Poder. |
| Ponte sobre o Fosso | Clãs derrotados não sofrem baixa: voltam à Reserva. |
| Labirinto | Comprometer custa 1 zeny por personagem. Alcance não funciona. |
| Salão dos Guardiões | Guarnição de Poder 6 que combate todos os clãs. |
| Armazém | Quem controla ganha 4 zeny no fim da rodada. |
| Forja | Quem controla faz 1 refino grátis e sem risco. |
| Capela | Quem controla move 1 personagem da Enfermaria para a Reserva. |
| Torre de Vigia | Quem controla olha os comprometimentos ocultos de 1 sala adjacente. |
| Cripta | Baixas aqui vão para a Reserva, não para a Enfermaria. |
| Portal Rúnico | Ignore a regra de posicionamento para comprometer aqui. |
| Terraço | Arcano tem Poder dobrado. Vanguarda tem −2. |

---

## 8. Resolução de uma sala

As salas resolvem do Portão para dentro. Emboscada resolve antes de todas.

1. **Revelar** personagens, Ordens e combos declarados.
2. **Entrar os Oculto** (a menos que estejam Revelados).
3. **RAPTO** — antes de somar qualquer Poder, porque arrancar alguém muda o cálculo de
   quem ficou (ELO, SOLO).
4. **Somar Poder** de cada clã: cartas + evolução + equipamento + refino +
   palavras-chave + Ordem − Marcha Forçada.
5. **Disparar combos** e aplicar marcas.
6. **Aplicar Anular**, depois **Muralha** (Perfurar devolve; Exposto zerou a do alvo).
7. **Maior total controla a sala.** Empate no topo: ninguém controla, todos os empatados
   sofrem 1 baixa.
8. **Baixas.** Cada clã derrotado remove personagens cuja soma de Poder de carta
   alcance a **margem** de derrota. Proteger cai primeiro — a menos que o clã esteja
   Presa. Teto: metade dos personagens, arredondado para cima.
9. **Espólio.** O vencedor pega 1 equipamento de um caído inimigo. Aplica Pilhar.
10. **Sobreviventes voltam à Reserva.** Baixas vão à Enfermaria e perdem uma rodada.

### clãs inimigos entre si

Se dois atacantes comprometem na mesma sala, **são clãs diferentes**. Um controla e o
outro sofre baixas, mesmo que ambos tenham superado o defensor. Não existe "atacar junto"
— é o que faz a premissa de "ninguém é aliado" ser mecânica e não narrativa.

---

## 9. O Emperium

Qualquer um pode entrar. Quem não controla o Salão do Trono chega por Marcha Forçada e
paga em Poder.

O **Escudo** é o Poder do defensor na sala mais o valor da rodada:

| Rodada | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Escudo base | 8 | 8 | 8 | 6 | 4 | 2 |

O escudo absorve os atacantes **em ordem crescente de Poder**: o menor primeiro, até
acabar. Cada ponto que passa vira um **cubo da sua cor** no Emperium.

Essa ordem **pune quem chega com pouco**. Mandar sobras não é uma aposta pequena — é uma
aposta nula. Com a decadência do escudo entre as rodadas 4 e 6, é a resposta estrutural ao
problema do "depois de você".

### Quando quebra

1. Cada jogador ganha **1 Glória por cubo seu**.
2. Quem colocou **mais cubos nesta rodada** toma o castelo e ganha **+3 Glória**.
3. Todos os cubos saem; o Emperium volta ao valor cheio.
4. **Todos os personagens da Sala do Emperium vão para a Enfermaria** — dos dois lados.

O item 4 é o que faz a inversão de papel funcionar: você acorda dono, rico, e sem metade
do exército.

---

## 10. As Ordens

Quatro fichas, as mesmas todas as rodadas, cada uma usável **uma vez por rodada** — então
no máximo quatro salas.

| Ordem | Efeito |
|---|---|
| **INVESTIDA** | +3 de Poder. Se perder, 1 baixa extra. |
| **CERCO** | Ignore o limite da sala. −1 de Poder. |
| **EMBOSCADA** | Resolve antes de todas. +2 se for a única; −2 se houver outra. **Os outros clãs desta sala perdem o bônus positivo da Ordem deles.** |
| **RESGUARDO** | −2 de Poder. Sem baixas. Ganhe 3 zeny. |

> **Por que as duas do meio mudaram.** Duas das quatro Ordens eram difíceis de explicar
> porque o benefício delas não existia de verdade.
>
> A **Emboscada** resolvia antes, e resolver antes **não tinha consequência mecânica
> nenhuma** — a sala resolvia mais cedo e nada mudava. Agora "bater antes de eles formarem"
> custa ao inimigo o bônus da Ordem: uma Investida vira +0 em vez de +3. Contra quem ia
> atacar, é um **swing de 5 pontos** (você ganha +2, ele perde +3). O −2 do Resguardo *não*
> é devolvido — emboscar impede o ataque, não desfaz o recuo.
>
> O **Cerco** ignorava o limite da sala, mas só o Corredor Estreito tinha limite: era uma
> Ordem morta em seis das sete salas. Agora **toda sala tem teto**, e o Cerco vale em toda
> parte. A escala tem três degraus deliberados: **2** no Corredor Estreito, a sala que pune
> número bruto; **3** na maioria; **4** no **Pátio Aberto** (onde exército grande ganha) e
> no **Salão do Trono** (último degrau antes do Emperium, que precisa comportar um cerco
> de verdade dos dois lados).
>
> A **Sala do Emperium** é a única sem teto, e isso é o clímax do jogo: o assalto final é
> para mandar tudo o que restou. Um limite ali achataria o desfecho e favoreceria o
> defensor, que já tem o escudo absorvendo em ordem crescente.

---

## 11. Personagens

**26 variações base** (13 classes × 2), com duas cópias cada no baralho de recrutamento.
**39 Transcendências** (13 classes × 3), compradas no Altar a partir da rodada 3.

Uma base pode tomar qualquer caminho da sua classe: **6 desfechos por classe, 78 no
total.** Como a evolução **soma** à base em vez de substituí-la, um Bruxo Tempestade que
virou Arquimago Nevasca (Poder 5, Muralha 4) é um personagem diferente de um Bruxo Jupitel
pelo mesmo caminho (Poder 6, Muralha 2). **Qual base você evoluiu importa até o fim.**

A Transcendência mantém a carta base na mesa com o nome dela, o equipamento, o refino e as
cartas de monstro. **Transcender alguém na Enfermaria o traz de volta à Reserva na hora** —
é o Rebirth do Ragnarok.

*(As tabelas completas das 26 bases e das 39 evoluções estão em
[01-design-v0.1.md § 12](01-design-v0.1.md), com os combos acrescentados na § 5 acima.)*

**O Superaprendiz não transcende.** Os três caminhos dele mantêm o nome, custam 7–8 zeny
contra 9–14 de todo mundo, e não dão poder proporcional. Ele só insiste.

---

## 12. Equipamento

Slots por personagem (0–2), Papel compatível. Armas, armaduras e acessórios, com
**cartas de monstro encaixáveis** (Thara Frog, Raydric, Hydra, Marc, Angeling, Ghostring,
Poring, Baphomet, Doppelganger, Orc Herói) — permanentes e visíveis na mesa.

**Refino** +0 a +3, cada nível +1 de Poder. Pague 3 zeny e role: **1** quebra, **2–3** nada,
**4–6** sobe um nível. Qualquer Ferreiro na Reserva anula a quebra.

Combos não passam por equipamento — de propósito. As duas camadas são independentes.

---

## 13. Os três modos

**Modo 3 — CERCO** *(o padrão, e o único implementado)*: um defensor, os demais atacam.
Defensor: 18 zeny, 3 personagens, 3 Guardiões.

**Modo 1 — ASSALTO SELVAGEM**: ninguém começa dono; o castelo é do Clã Fantasma, com
Guardiões de Poder 3 + rodada. Enquanto o Clã Fantasma for dono, ninguém marca a Glória de
fim de rodada.

**Modo 2 — GUERRA DOS REINOS**: cada jogador tem um castelo de 4 salas. **Você continua
com apenas 4 Ordens para todos os castelos, incluindo o seu.** Essa é a regra inteira do
modo.

---

## 14. Glória

| Fonte | Glória |
|---|---|
| Dono do castelo no fim das rodadas 1–5 | **2** cada |
| Dono do castelo no fim da rodada 6 | **8** |
| Cada cubo seu no Emperium quando ele quebra | **1** |
| Tomar o castelo | **+3** |
| Derrotar personagens inimigos | **0** — deliberadamente |

Matar é meio, não fim. Se derrotar inimigos pontuasse, o jogo viraria briga de rua no
pátio e ninguém entraria no castelo.

---

## 15. Escala de jogadores

| Atacantes | Durabilidade do Emperium | Guardiões | Alas |
|---|---|---|---|
| 2 (3 jogadores) | 10 | 2 | 2 (castelo linear) |
| 3 (4 jogadores) | 14 | 3 | 4 (losango) |
| 4 (5 jogadores) | 18 | 4 | 4 (losango) |

---

## 16. Estrutura da rodada

1. **Renda** — simultânea.
2. **Mercado** — ordem inversa de Glória, 3 ações cada.
3. **Comprometimento** — simultâneo: personagens, Ordem, combo, consumível e
   infiltração por sala, tudo de bruços. A contagem de cada monte e a sala são
   públicas; o resto fica no verso. Ver **seção 17**.
4. **Revelação e resolução** — sala por sala, do Portão para dentro.
5. **Fim de rodada** — renda de salas, Glória, Enfermaria, avança a trilha.

Seis rodadas. Orçamento: ~13 min por rodada com 4 jogadores, ~78 minutos.

---

## 17. O comprometimento na mesa

Esta é a fase que mais pode quebrar no jogo físico, porque ela carrega muita
informação de uma vez e precisa ficar escondida até a revelação. Vale listar o
que uma rodada tem que guardar em segredo:

1. **Quais personagens** vão para **qual sala** — até 4 salas
2. **Qual Ordem** em cada sala, e cada Ordem só uma vez por rodada
3. **Qual combo** você declara, com o portador nomeado — no máximo um por sala
4. **Qual consumível** você joga de bruços
5. As **salas de Marcha Forçada**, congeladas no momento da declaração
6. **O destino da infiltração** do seu Oculto

### Os Estandartes

Cada jogador tem **4 estandartes** na cor do clã, um por Ordem. Frente: o
símbolo da Ordem. Verso: o brasão do clã, igual nos quatro.

No comprometimento você põe um estandarte **de bruços** na sala que quer atacar
e coloca as **cartas dos personagens de bruços embaixo dele**. As cartas viajam
com o equipamento enfiado por baixo, então o veterano equipado se move como uma
peça só — mandar o seu Cavaleiro para o corredor é um gesto, não uma anotação.

O que faz esse sistema valer a pena é que **o componente aplica a regra
sozinho**: você tem exatamente um estandarte de cada Ordem, então "cada Ordem
uma vez por rodada" e "no máximo 4 salas por rodada" deixam de ser regras para
decorar e viram uma limitação da sua mão. Ninguém precisa fiscalizar.

As outras cinco decisões pegam carona sem quase nenhum componente novo:

| Decisão | Como se declara |
|---|---|
| **Combo** | A carta do portador entra no monte **girada 90°** |
| **Consumível** | Entra de bruços **atravessado** no monte, para não se confundir com personagem |
| **Marcha Forçada** | Chevrons (−2 cada) empilhados **sobre o estandarte** ao colocar |
| **Infiltração do Oculto** | Uma **ficha de Sombra** de bruços sob o estandarte, com a letra da sala de destino |

### A ficha de Sombra

Cada sala do castelo tem uma **letra impressa** na ficha. Ao comprometer um
Oculto, você pode enfiar sob o estandarte uma ficha de Sombra de bruços com a
letra da sala vizinha para onde ele vai escorregar.

**O Oculto fica no monte junto com o grupo, sem nenhuma diferença de
posicionamento.** Nada na mesa denuncia que ele pretende sair dali — se
denunciasse, a infiltração deixaria de ser infiltração. É a ficha virada que
carrega o destino, e ela só é lida na revelação.

Na revelação, se o seu clã **não** foi REVELADO naquela sala, a ficha vira e o
Oculto muda de sala **sem pagar Marcha Forçada**, e luta lá sem Ordem nenhuma —
ele entrou pela sombra, não numa formação. Se foi REVELADO — pelo Caçador
Falcoeiro, pelo Olho de Falcão, pelos Óculos do Caçador, pelo Horong ou por um
combo de REVELADO —, a ficha vira do mesmo jeito e não acontece nada: ele fica
e briga onde estava.

### A revelação

Todos viram os estandartes ao mesmo tempo e abrem os montes em leque. Resolvem
as salas na ordem impressa nas fichas, com a ressalva de que **qualquer sala com
um estandarte de Emboscada resolve antes**. As infiltrações acontecem todas
juntas, logo depois de virar e antes de a primeira sala resolver.

### O que fica à vista de propósito

Com os montes na mesa, todo mundo vê **quantas cartas** você mandou e **para
onde** — só não vê **quem**, **sob qual Ordem**, **com que combo**, **com que
consumível** nem **para onde a Sombra aponta**.

Esconder também a contagem exigiria um biombo por jogador, e o biombo custa uma
transferência de cinco a oito cartas por jogador por rodada, seis rodadas — é aí
que os 90 minutos viram 120. O vazamento é o preço de manter a fase rápida, e
ele é defensável: o cerco de verdade não é invisível. Você vê a guilda inimiga
entrar na sala; o que você não sabe é quão forte ela é e o que ela vai fazer.

Dois efeitos colaterais bem-vindos. Primeiro, **os limites de sala se fiscalizam
sozinhos**: se alguém colocar a quarta carta num Corredor de três, a mesa vê na
hora, em vez de a ilegalidade virar surpresa na revelação. Segundo, a **Torre de
Vigia continua valendo**, porque o que ela espia é o *conteúdo* dos montes, não
a existência deles.

**A versão digital segue exatamente esta regra**, e por este motivo: as duas
precisam se jogar igual, senão quem aprende numa desaprende na outra. Durante a
fase simultânea o tabuleiro mostra o monte de cada rival — cartas de verso
empilhadas, com a contagem e o nome do clã — e nada mais.

### Componentes que esta fase acrescenta

| Qtd | Componente |
|---|---|
| 20 | Estandartes (4 Ordens × 5 jogadores), verso com o brasão do clã |
| 15 | Chevrons de Marcha (3 por jogador) |
| 10 | Fichas de Sombra (2 por jogador), com as letras das salas |

As fichas de sala passam a ter uma **letra impressa** (A a G) para a ficha de
Sombra poder apontar.

---

## 18. Riscos e alavancas

| Risco | Sinal no playtest | Alavanca |
|---|---|---|
| **Combo empurra tudo para uma sala só** | Ninguém compromete em mais de 2 salas | Já existe o teto de 1 combo/sala; se persistir, exija 3+ personagens para o combo acender |
| **Marcas decidem a sala sozinhas** | Quem marca sempre vence | Faça a marca custar 1 baixa a quem a aplica |
| **−2 por sala de marcha está errado** | Ninguém marcha, ou todo mundo pula pro Trono | `MARCHA_PENALIDADE`, uma constante |
| **Rapto é frustrante de sofrer** | Reclamação na mesa | Já limitado a 1/sala; se doer, restrinja o alvo ao de menor Poder |
| **Defensor rico demais** | Castelo nunca troca de dono | Baixe o bônus do castelo de +6 para +4 zeny |
| **Rodada 6 decide tudo** | Jogadores ignoram as rodadas 1–3 | Glória por rodada 2 → 3, final 8 → 6 |
| **Fase de mercado arrastada** | Mais de 5 min com 4 jogadores | 3 ações → 2, renda base 6 → 8 |
| **Professor + Asura é dominante** | Toda partida termina nele | Faça o cancela-Esgotar valer para um personagem, não o clã |

---

## 19. Roteiro de playtest

Quatro jogadores, Modo 3, alas: Corredor Estreito, Salão dos Guardiões, Armazém, Torre de
Vigia. Anote:

1. **Em quantas das 6 rodadas o defensor levou mais de 30 segundos decidindo?** Menos de 4
   significa que o defensor não tem jogo.
2. **O castelo trocou de dono antes da rodada 5?** Se não, o escudo ou a renda do defensor
   estão altos demais.
3. **Quantos combos diferentes dispararam na partida inteira?** Menos de 5 significa que a
   camada não está viva — ou os combos certos não apareceram no mercado.
4. **Alguém terminou com menos de 4 de Glória?** Indica jogador morto.
5. **Alguma rodada passou de 15 minutos?** O mercado é a suspeita padrão.
6. **Alguém comprometeu em 4 salas numa rodada?** Se ninguém fez, as 4 Ordens estão
   folgadas.

Nenhuma dessas pergunta se foi divertido. Divertido não é falseável, e você não é público
imparcial do próprio jogo.

---

## 20. Estado da implementação

O jogo roda como plugin do Boardzando em `apps/server/src/games/emperium/`, com tabuleiro
em `apps/web/src/games/emperium/`. **197 testes**, incluindo o exemplo trabalhado da § 8
reproduzido número a número.

**Implementado:** Modo 3 completo, Marcha Forçada, Transcendência, Combos e Marcas, Rapto,
equipamento com refino e cartas de monstro, reposicionamento de Guardiões.

**Não implementado:** Modos 1 e 2; consumíveis são compráveis mas ainda não têm seletor na
interface; comprar carta de monstro existe no servidor sem botão na tela.

**Decisão de arquitetura:** todos os moves são off-turn. O turno circular do engine não
expressa este jogo — a ordem do mercado é inversa à Glória e recalculada a cada rodada, e
o comprometimento é simultâneo. A ordem vive no estado e cada move valida
`jogadorDoMercado(state)` devolvendo `INVALID_MOVE`, então o gate continua server-side.
