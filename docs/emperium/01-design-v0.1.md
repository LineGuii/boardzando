# GUERRA DO EMPERIUM — Documento de Design v0.1

> Status: primeira versão jogável, pronta para print-and-play.
> Todos os números aqui são **arbitrados**, não sugeridos. Cada um tem uma alavanca
> de ajuste declarada na seção *Riscos e Alavancas*.

---

## 1. Pitch

Quatro clãs cercam um castelo e ninguém ali é amigo de ninguém. A cada rodada você
compromete seus mercenários em segredo — quantos, em quais salas, com que ordem —
e só descobre onde os rivais apostaram quando o portão se abre.

**A decisão central do jogo é onde *não* colocar sua gente.** Você tem tropa para
duas salas e ambição para quatro; o castelo pertence a quem estiver dentro dele
quando a última rodada acabar, mas quem só espera vê o dono somar pontos rodada
após rodada.

---

## 2. Motor central

### Escolhido: recrutamento em tableau + comprometimento simultâneo oculto + resolução sala a sala

Cada jogador mantém uma **Reserva** de personagens recrutados como cartas na sua
área. A cada rodada, compromete personagens em salas do castelo **de bruços e ao
mesmo tempo que todo mundo**, junto de uma **Ordem** secreta por sala. Depois tudo
vira para cima e as salas resolvem em sequência, do portão para dentro.

Por que este motor:

- **Personagens ficam como objetos físicos na mesa**, então equipamento e cartas de
  monstro grudam neles de verdade. Um personagem bem equipado é uma coisa visível
  que os outros jogadores olham e temem.
- **Comprometimento simultâneo mata o downtime.** Com 5 jogadores, todo mundo
  decide ao mesmo tempo; a fase mais longa da rodada é coletiva.
- **A tensão de dividir forças é o próprio ato de jogar**, não uma regra bolada por
  cima. Isso é exatamente o que o Modo 2 precisa, e o Modo 3 herda de graça.

### Rejeitado: deckbuilding puro (Clank!, Dominion)

Duas razões, ambas fatais. Primeiro, **equipamento não sobrevive a um baralho
embaralhado** — se o personagem é uma carta que vai para o descarte, a espada +7
que você refinou some junto, e toda a camada de itens desaba. Segundo, e mais
importante: o precast da WoE era **deliberado**. O clã escolhia o corredor,
posicionava os bruxos e cronometrava a magia. Um deckbuilder substitui essa
intenção por "o que eu comprei este turno", que é a emoção errada para este jogo.

### Rejeitado: turnos alternados com combate por dados (Blood Rage, Kemet)

Com 5 jogadores e um defensor solitário, o defensor espera quatro turnos entre
cada decisão sua — o problema #2 fica insolúvel por construção. Além disso,
6 rodadas × 5 turnos individuais estoura a meta de 90 minutos.

### Consequência: **o combate não usa dados**

A incerteza do jogo vem de duas fontes, e nenhuma delas é aleatória na resolução:
**o que está disponível no mercado** e **onde os rivais apostaram**. Um confronto
de sala é aritmética determinística sobre informação que acabou de ser revelada.
Dados aparecem em exatamente um lugar — o refino de equipamento — porque ali o
push-your-luck é a graça.

---

## 3. Componentes

| Qtd | Componente |
|---|---|
| 52 | Cartas de Personagem base (26 variações × 2 cópias) |
| 39 | Cartas de Transcendência (13 classes × 3 caminhos) |
| 30 | Cartas de Equipamento (12 armas, 10 armaduras, 8 acessórios) |
| 20 | Cartas de Monstro (10 tipos × 2) |
| 24 | Cartas de Consumível (8 tipos × 3) |
| 12 | Fichas de Sala de Ala (hexagonais ou quadradas, ~10 cm) |
| 3 | Fichas fixas: Portão Principal, Salão do Trono, Sala do Emperium |
| 5 | Painéis de jogador (Reserva / Enfermaria / trilha de zeny) |
| 20 | Fichas de Ordem (4 por jogador × 5) |
| 5 | Conjuntos de 20 cubos de cor (dano no Emperium + marcadores de controle) |
| 12 | Fichas de Guardião (Poder impresso 2/3/4) |
| 1 | Trilha de Glória (0–40) + 5 marcadores |
| 1 | Trilha de Rodada (1–6) com o Escudo do Emperium impresso |
| ~90 | Moedas de zeny (1 / 5 / 10) |
| 1 | Dado d6 (só para refino) |

---

## 4. Anatomia da carta de personagem

```
┌──────────────────────────────┐
│  BRUXO TEMPESTADE            │   Nome da variação
│  Bruxo                       │   Classe
│                              │
│  Custo   7z      Poder  3    │
│  Papel: ARCANO      Slots ◇◇ │   Papel define que equipamento aceita
│  ─────────────────────────── │
│  ▸ MURALHA 2                 │   Palavras-chave, no máximo 2 por carta
│  ▸ ALCANCE                   │
└──────────────────────────────┘
```

**Papel** (4 valores): `VANGUARDA` · `ARCANO` · `ÁGIL` · `SUPORTE`.
Serve para uma coisa só: dizer que equipamento a carta aceita. Não tem efeito
mecânico próprio.

---

## 5. A gramática — 14 palavras-chave

Bases e Transcendências são compostas a partir desta lista. Nada de texto livre.

| Palavra-chave | Efeito |
|---|---|
| **ALCANCE** | Só sofre baixa se você não tiver nenhum personagem com ESCUDAR vivo nesta sala. |
| **ESCUDAR** | Absorve as baixas da sua facção antes de qualquer outro personagem seu nesta sala. |
| **MURALHA X** | Reduz em X o Poder Total de **cada** facção inimiga nesta sala. |
| **PERFURAR X** | X pontos do Poder deste personagem ignoram MURALHA inimiga. |
| **RAJADA X** | +X de Poder, apenas na primeira rodada em que este personagem entra nesta sala. |
| **ELO X** | +X de Poder para cada **outro** personagem seu nesta sala. |
| **SOLO X** | +X de Poder se este for o seu único personagem nesta sala. |
| **OCULTO** | Não é revelado com os outros. Entra depois que as Ordens viram. Ignora limite de sala. |
| **DEVOÇÃO** | Quando outro personagem seu nesta sala sofreria baixa, este sofre no lugar. |
| **ANULAR** | Cancela uma palavra-chave **ou** um equipamento de um personagem inimigo nesta sala. |
| **RESTAURAR X** | No fim da rodada, mova X personagens da sua Enfermaria para a Reserva. |
| **PILHAR X** | Se sua facção vencer esta sala, ganhe X zeny. Com X ≥ 3, ganhe 1 equipamento caído em vez disso. |
| **ESGOTAR** | Após resolver, este personagem vai para a Enfermaria (venceu ou perdeu). |
| **IMITAR** | Copia as palavras-chave de outro personagem revelado nesta sala. |

Toda carta tem **no máximo 2** palavras-chave. Se você precisa ler três linhas para
saber o que uma unidade faz, ela está mal desenhada.

---

## 6. Economia

### Moeda única: **zeny**

Recrutar, equipar, refinar e comprar consumível saem do mesmo bolso. Não existe
segunda moeda, e é de propósito.

### Renda (início da rodada, simultânea)

| Fonte | Valor |
|---|---|
| Base | **6 zeny** por jogador |
| Dono do castelo | **+6 zeny** (tesouro do castelo) |
| Sala Armazém controlada | **+4 zeny** |
| PILHAR de salas vencidas | conforme a carta |

**O dono do castelo é o jogador mais rico da mesa.** Isso é a espinha da agência do
defensor: ele é um contra quatro, mas compra quase o dobro por rodada.

### Mercado — **3 ações por rodada, e só 3**

Na sua vez (ordem de jogo abaixo), escolha três, podendo repetir. **Transcender é uma
delas** — evoluir um veterano custa a mesma ação que recrutar um novato, e é aí que a
decisão dói.

1. **Recrutar** — pague o custo de uma carta da fileira de recrutamento; ela vai para
   sua Reserva. Reponha a fileira.
2. **Equipar** — compre um equipamento da fileira e anexe a um personagem com slot
   livre e Papel compatível. Ou mova um equipamento entre dois personagens seus (grátis
   em ação, mas gasta a ação).
3. **Refinar** — 3 zeny, role o d6 (tabela abaixo).
4. **Comprar consumível** — 4 zeny, compre a carta do topo do baralho de consumíveis.
5. **Transcender** — 7–14 zeny, evolua um personagem seu no Altar (a partir da rodada 3).
6. **Mover um Guardião** — só o dono do castelo, de uma sala para outra.

O limite de 3 ações é o que impede a camada de itens de virar um jogo paralelo. Numa
rodada em que você refina duas vezes, você recruta uma vez só. Essa é a decisão.

### Os dois mercados

O jogo tem **dois mercados que funcionam de maneiras opostas**, e isso é o ponto.

**Recrutamento — sorteado e disputado.** 5 cartas viradas de um baralho de 52 (duas
cópias de cada uma das 26 variações base). Você compra o que apareceu, e o que você
não levar o vizinho leva. É oportunismo.

**Altar da Transcendência — tabela de preços fixa.** Não é uma fileira. Os três
caminhos de cada classe estão **sempre disponíveis**, sempre pelo mesmo preço, a partir
da rodada 3. Ninguém tira nada de ninguém. É plano: você pode dizer na rodada 3 "vou
juntar 11 zeny para transformar meu Bruxo em Arquimago Nevasca" e cumprir isso.

**Equipamento:** 4 cartas viradas.

### Ordem de jogo

**Inversa à Glória**: quem tem menos Glória compra primeiro. O dono do castelo, que
está ganhando pontos toda rodada, compra por último. Empates: quem tem menos zeny.

### Setup inicial

| | Atacantes | Defensor (Modo 3) |
|---|---|---|
| Zeny | 12 | 18 |
| Personagens | receba 4 cartas do Deck I, fique com 2 | receba 5, fique com 3 |
| Guardiões | — | 3 fichas de Guardião (ver Modo 3) |

---

## 7. O castelo

### Topologia — losango, 7 salas

```
                  ┌──────────────────┐
                  │ SALA DO EMPERIUM │
                  └────────┬─────────┘
                           │
                  ┌────────┴─────────┐
                  │  SALÃO DO TRONO  │
                  └───┬──────────┬───┘
                      │          │
              ┌───────┴──┐    ┌──┴───────┐
              │  ALA B2  │    │  ALA C2  │
              └───────┬──┘    └──┬───────┘
                      │          │
              ┌───────┴──┐    ┌──┴───────┐
              │  ALA B1  │    │  ALA C1  │
              └───────┬──┘    └──┬───────┘
                      │          │
                  ┌───┴──────────┴───┐
                  │ PORTÃO PRINCIPAL │
                  └────────┬─────────┘
                           │
                      (Reservas)
```

**Fixo, não modular — mas as alas são sorteadas.** O Portão, o Salão do Trono e a Sala
do Emperium são sempre os mesmos e ancoram o aprendizado: você sabe onde é o gargalo e
onde é o clímax. As **quatro alas** vêm de um pool de 12 fichas sorteadas no setup, o
que muda a textura de cada partida sem mudar a geometria. Você aprende o castelo uma
vez e depois joga contra as fichas.

O losango força a decisão de rota. Empilhar tudo numa perna é rápido e legível para os
rivais; dividir entre B e C é seguro e lento.

### Regra de posicionamento — Marcha Forçada

**Toda sala do castelo é alcançável, sempre. O que varia é o preço.**

Sua **linha de frente** é o Portão Principal, mais toda sala que você controlava no fim
da rodada anterior, mais as salas que fazem fronteira com essas. Entrar na linha de
frente é grátis.

Entrar em qualquer outra sala é uma **Marcha Forçada**: você chega disperso e sem
fôlego, a **−2 de Poder por sala de distância** da sua linha de frente. Tomar uma sala
aproxima a linha e barateia a próxima.

Na rodada 1, isso dá a um atacante: Portão de graça, alas internas a −2, alas fundas a
−4, Salão do Trono a −6, Sala do Emperium a −8.

O dono do castelo ignora tudo isso: ele compromete em **qualquer sala do próprio
castelo**, sempre a custo zero. É a segunda perna da agência do defensor.

> **Por que esta regra existe.** A v0.1 exigia adjacência estrita, e o resultado foi que
> na rodada 1 o Portão era a **única sala legal** para todo atacante. A decisão que este
> jogo diz ser central — onde *não* colocar sua gente — simplesmente não existia até a
> rodada 3, e o defensor, sabendo onde todo mundo ia estar, só tinha que empilhar tudo
> num lugar. A Marcha Forçada resolve os dois de uma vez: o atacante ganha sete destinos
> desde o primeiro turno, e o defensor passa a ter que adivinhar entre eles.
>
> Isso também **remove o portão do Salão do Trono** como regra dura. A Sala do Emperium
> não exige mais controlar o Trono — ela custa −8 de marcha, e a aritmética faz o
> trabalho que a proibição fazia, sem tirar a carta de cima da mesa. O assalto
> desesperado de última rodada passou a ser possível, e o defensor nunca mais pode
> deixar o Emperium vazio.

### As 3 salas fixas

**PORTÃO PRINCIPAL** — Sem limite de personagens. Sem efeito. É a rampa de entrada e é
plana de propósito.

**SALÃO DO TRONO** — Limite 3 personagens por facção. O dono do castelo tem **+2 de
Poder** aqui. Só quem controlou o Salão do Trono no fim da rodada anterior pode
comprometer na Sala do Emperium.

**SALA DO EMPERIUM** — Não se disputa controle aqui. Ver seção 9.

### As 12 fichas de ala

Cada uma tem exatamente uma linha de regra, impressa na ficha.

| # | Sala | Regra |
|---|---|---|
| 1 | **Corredor Estreito** | Limite 2 personagens por facção. |
| 2 | **Pátio Aberto** | Personagens com ALCANCE têm +1 de Poder. |
| 3 | **Ponte sobre o Fosso** | Facções derrotadas não sofrem baixa: voltam à Reserva. |
| 4 | **Labirinto** | Comprometer aqui custa 1 zeny por personagem. ALCANCE não funciona. |
| 5 | **Salão dos Guardiões** | Guarnição de Poder 6 que combate todas as facções. Ninguém controla enquanto viva. |
| 6 | **Armazém** | Quem controla ganha 4 zeny no fim da rodada. |
| 7 | **Forja** | Quem controla faz 1 refino grátis e sem risco no fim da rodada. |
| 8 | **Capela** | Quem controla move 1 personagem da Enfermaria para a Reserva no fim da rodada. |
| 9 | **Torre de Vigia** | Quem controla olha os comprometimentos ocultos de 1 sala adjacente antes da revelação. |
| 10 | **Cripta** | Baixas aqui vão para a Reserva, não para a Enfermaria. |
| 11 | **Portal Rúnico** | Ignore a regra de posicionamento para comprometer aqui. |
| 12 | **Terraço** | ARCANO tem Poder dobrado. VANGUARDA tem −2 de Poder. |

Com apenas 4 em jogo por partida e uma linha cada, ninguém precisa decorar nada — a
regra está debaixo das peças.

---

## 8. Resolução de uma sala

As salas resolvem **do Portão para dentro**: Portão → B1/C1 → B2/C2 → Salão do Trono →
Sala do Emperium. (Salas em paralelo resolvem na ordem que a mesa preferir; não
interagem.)

1. **Revelar** personagens e Ordens de todas as facções presentes.
2. **Entrar os OCULTO.**
3. **Somar Poder Total** de cada facção: Poder das cartas + equipamento + refino +
   palavras-chave + Ordem.
4. **Aplicar MURALHA**: cada MURALHA X reduz o total de *cada* facção inimiga em X.
   PERFURAR devolve pontos que a MURALHA tirou.
5. **Aplicar ANULAR.**
6. **Maior total controla a sala.** Empate no topo: ninguém controla, e todas as
   facções empatadas sofrem 1 baixa.
7. **Baixas.** Cada facção derrotada remove personagens cuja soma de Poder base
   alcance ou ultrapasse a **margem** (total do vencedor menos o seu). O dono escolhe
   quem cai. ESCUDAR cai primeiro, obrigatoriamente.
   **Teto de baixas: metade dos seus personagens na sala, arredondado para cima.**
8. **Espólio.** O vencedor pega **1 equipamento** à sua escolha entre os que estavam
   nos personagens caídos e o guarda na própria área. Aplica PILHAR.
9. **Sobreviventes voltam à Reserva.** Baixas vão para a **Enfermaria** e retornam à
   Reserva no fim da rodada **seguinte** — perdem uma rodada inteira.

### Por que facções inimigas entre si

Se dois atacantes comprometem na mesma sala, **os dois estão em facções diferentes**.
Um deles vai controlar a sala e o outro sofre baixas, mesmo que ambos tenham superado
o defensor. Não existe "atacar juntos". Isso é o que faz a premissa de "ninguém é
aliado de ninguém" ser mecânica, e não só narrativa.

### Exemplo trabalhado

**Rodada 4, Corredor Estreito (limite 2).** Três facções revelam.

**Ana (atacante)** comprometeu:
- *Arquimago — Nevasca* — Poder 4, MURALHA 4, ALCANCE. Equipado com **Cajado da
  Tempestade +2** (arma ARCANO, +3 Poder, com **Carta Hydra** encaixada: +2 ao atacar).
- *Templário Escudeiro* — Poder 2, ESCUDAR.
- Ordem: **INVESTIDA** (+3 Poder, baixa extra se perder).

Poder de Ana: 4 + 3 (cajado) + 2 (refino +2) + 2 (Hydra, ela está atacando) + 2 (Escudeiro) + 3 (Investida) = **16**.

**Bruno (atacante)** comprometeu:
- *Mestre — Punho de Asura* — Poder 10, ESGOTAR, SOLO 2. Sozinho, então SOLO ativa.
- Ordem: **EMBOSCADA** (+2 se for o único a usá-la aqui — e é).

Poder de Bruno: 10 + 2 (SOLO) + 2 (Emboscada) = **14**.

**Carla (defensora)** comprometeu:
- *Caçador Armadilheiro* — Poder 2, MURALHA 2.
- *Sumo Sacerdote — Assumptio* — Poder 3, DEVOÇÃO, ELO 2. ELO conta o Armadilheiro: +2.
- Ordem: **RESGUARDO** (−2, sem baixas, +3 zeny).

Poder de Carla: 2 + 3 + 2 (ELO) − 2 (Resguardo) = **5**.

**MURALHA.** Carla tem MURALHA 2: tira 2 de Ana e 2 de Bruno. Ana tem MURALHA 4: tira 4
de Bruno e 4 de Carla. Bruno não tem MURALHA.

- Ana: 16 − 2 = **14**
- Bruno: 14 − 2 − 4 = **8**
- Carla: 5 − 4 = **1**

**Ana controla o Corredor Estreito.**

Baixas de Bruno: margem 14 − 8 = 6. Ele precisa remover Poder base ≥ 6 e só tem o
Mestre (Poder base 10). Ele cai. (Ia para a Enfermaria de qualquer jeito por ESGOTAR.)
Ana pega o equipamento do Mestre como espólio — mas o Mestre estava sem equipamento,
então nada.

Baixas de Carla: RESGUARDO anula. Ela sai limpa com 1 de Poder, tendo perdido a sala e
ganho 3 zeny. Foi uma retirada consciente.

**Leitura do exemplo:** Bruno trouxe o maior número bruto da mesa e perdeu, porque a
MURALHA de Ana o cortou e ele não tinha PERFURAR. Essa é a lição de design que o
Corredor Estreito existe para ensinar.

---

## 9. O Emperium

### Comprometer

Qualquer um pode comprometer na Sala do Emperium — mas quem não controla o Salão do
Trono chega por Marcha Forçada e paga o preço em Poder (−8 direto do Portão). O dono do
castelo sempre entra de graça.

### Escudo e absorção crescente

O **Escudo do Emperium** é o Poder Total do defensor nesta sala **mais** o valor
impresso na trilha de rodada:

| Rodada | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Escudo base | 8 | 8 | 8 | 6 | 4 | 2 |

O escudo absorve os atacantes **em ordem crescente de Poder**: o menor primeiro, até
acabar. Cada atacante coloca no Emperium um cubo da sua cor por ponto que passar.

Essa ordem não é enfeite. **Ela pune quem chega com pouco.** O clã que manda três
sobras é engolido inteiro pelo escudo; o clã que aposta pesado passa por cima do que
sobrou. Combinada com a decadência do escudo a partir da rodada 4, é a resposta
estrutural do jogo ao "depois de você".

Atacantes totalmente absorvidos sofrem **1 baixa**. O defensor sofre **1 baixa** se
qualquer dano passar.

### Quebra

Quando os cubos alcançam a **Durabilidade do Emperium** (tabela na seção 12):

1. Cada jogador ganha **1 Glória por cubo seu** no Emperium.
2. Quem colocou **mais cubos nesta rodada** toma o castelo. Empate: maior Poder Total.
3. Esse jogador ganha **+3 Glória**.
4. **Todos os cubos são removidos** e o Emperium volta à durabilidade cheia.
5. **Todos os personagens comprometidos na Sala do Emperium vão para a Enfermaria** —
   dos dois lados. O assalto consome quem o faz.

O item 5 é o que faz a inversão de papel funcionar. Você toma o castelo e começa a
rodada seguinte rico, com a renda do tesouro, e sem metade do seu exército. A mesa tem
uma janela real para tomá-lo de volta, e você tem uma janela real para se reerguer.

---

## 10. As Ordens

Cada jogador tem **4 fichas de Ordem**, as mesmas todas as rodadas. Você compromete
personagens em no máximo 4 salas por rodada, uma Ordem em cada, e **cada Ordem só pode
ser usada uma vez por rodada**.

| Ordem | Efeito |
|---|---|
| **INVESTIDA** | +3 de Poder. Se você perder a sala, sofra 1 baixa extra. |
| **CERCO** | Ignore o limite de personagens da sala. −1 de Poder. |
| **EMBOSCADA** | Esta sala resolve antes de todas as outras. +2 se você for o único com EMBOSCADA aqui; −2 se houver outra. |
| **RESGUARDO** | −2 de Poder. Você não sofre baixas nesta sala. Ganhe 3 zeny. |

As quatro Ordens são o recurso mais apertado do jogo. Espalhar por quatro salas
significa gastar RESGUARDO num lugar onde você queria INVESTIDA. É aqui que mora o
blefe.

---

## 11. Equipamento e itens

### Slots e Papel

Cada personagem tem 0, 1 ou 2 slots (`◇`). Cada equipamento exige um Papel.

### Armas (12 cartas)

| Arma | Papel | Custo | Efeito | Encaixe |
|---|---|---|---|---|
| Espada Bastarda | VANGUARDA | 5z | +2 Poder | ◈ |
| Lança de Cavalaria | VANGUARDA | 6z | +2 Poder, PERFURAR 1 | ◈ |
| Machado de Guerra | VANGUARDA | 7z | +4 Poder, −1 se você tiver ESCUDAR | ◈ |
| Cajado da Tempestade | ARCANO | 6z | +3 Poder | ◈ |
| Grimório | ARCANO | 5z | +1 Poder, MURALHA 1 | ◈ |
| Varinha de Anulação | ARCANO | 7z | +1 Poder, ANULAR | — |
| Adaga Gêmea | ÁGIL | 5z | +2 Poder, RAJADA 1 | ◈ |
| Arco Composto | ÁGIL | 6z | +3 Poder, exige ALCANCE | ◈ |
| Katar Sombria | ÁGIL | 7z | +3 Poder, +2 extra se OCULTO | ◈ |
| Alaúde | SUPORTE | 5z | +1 Poder, ELO 1 | ◈ |
| Chicote de Seda | SUPORTE | 5z | +2 Poder | ◈ |
| Maça Sagrada | SUPORTE | 6z | +2 Poder, RESTAURAR 1 | — |

### Armaduras (10 cartas)

| Armadura | Papel | Custo | Efeito | Encaixe |
|---|---|---|---|---|
| Cota de Malha | qualquer | 4z | +1 Poder | ◈ |
| Armadura Completa | VANGUARDA | 7z | +2 Poder, ESCUDAR | ◈ |
| Manto de Ninfa | ARCANO/SUPORTE | 6z | Ignora a primeira baixa desta sala | ◈ |
| Traje de Sombras | ÁGIL | 6z | +1 Poder, OCULTO | — |
| Escudo Sagrado | VANGUARDA | 5z | MURALHA 1 | ◈ |
| Botas de Fuga | qualquer | 4z | Baixas vão para a Reserva, não a Enfermaria | — |
| Manto Élfico | qualquer | 5z | +1 Poder, imune a ANULAR | — |
| Vestes do Sábio | ARCANO | 6z | +1 Poder, PERFURAR 2 | ◈ |
| Peitoral Rúnico | VANGUARDA | 8z | +3 Poder | ◈ |
| Túnica Simples | qualquer | 3z | +1 Poder | ◈◈ |

### Acessórios (8 cartas)

| Acessório | Custo | Efeito |
|---|---|---|
| Anel do Mercador | 5z | +2 zeny de renda por rodada |
| Broche do Guildmaster | 6z | +1 ação de mercado por rodada |
| Amuleto de Ferro | 4z | Este personagem nunca é a primeira baixa |
| Talismã do Vento | 4z | Ignore a regra de posicionamento para este personagem |
| Óculos do Caçador | 5z | Revela OCULTO inimigo na sala deste personagem |
| Colar de Zeny | 3z | PILHAR 2 |
| Selo do Emperium | 8z | +2 de Poder na Sala do Emperium |
| Pergaminho Antigo | 5z | IMITAR |

### Cartas de monstro (20 cartas — 10 tipos × 2)

Encaixam nos slots `◈` de equipamento. **Uma carta encaixada é permanente e fica
virada para cima na mesa** — todo mundo vê que você montou aquele personagem. É
informação pública e é de propósito: cria alvo.

| Carta | Efeito |
|---|---|
| **Thara Frog** | Ignora a primeira baixa causada por personagem inimigo. |
| **Raydric** | +2 Poder quando você é o dono do castelo. |
| **Hydra** | +2 Poder quando você é atacante. |
| **Marc** | Imune a MURALHA. |
| **Angeling** | Imune a ANULAR. |
| **Ghostring** | Não pode sofrer baixa. Poder reduzido à metade (arredonda para baixo). |
| **Poring** | +3 zeny sempre que este personagem vence uma sala. |
| **Baphomet** | ELO 1. |
| **Doppelganger** | RAJADA 2. |
| **Orc Herói** | PERFURAR 2. |

### Refino

Cada equipamento começa em **+0**. Cada nível vale **+1 de Poder**, máximo **+3**.

Ação de mercado *Refinar*: pague **3 zeny**, role o d6.

| d6 | Resultado |
|---|---|
| 1 | O equipamento **quebra**. Descarte, com as cartas encaixadas. |
| 2–3 | Nada acontece. |
| 4–6 | **+1 nível.** |

**Com qualquer Ferreiro ou Mestre-Ferreiro na sua Reserva, o resultado 1 vira "nada
acontece".** Nenhuma quebra. É a razão para recrutar um Ferreiro que nunca vai ao
combate — e é o papel fora do tabuleiro que a classe merece.

### Consumíveis (8 tipos × 3 = 24 cartas)

Jogados de bruços junto do comprometimento; revelados na resolução da sala.

| Consumível | Efeito |
|---|---|
| **Poção Branca** | Cancele 1 baixa sua nesta sala. |
| **Asa de Mosca** | Mova 1 personagem seu para uma sala adjacente antes de revelar. |
| **Asa de Borboleta** | Retire todos os seus personagens desta sala. Sem baixas, sem controle. |
| **Folha de Yggdrasil** | Traga 1 personagem da Enfermaria direto para esta sala. |
| **Frasco de Ácido** | +3 de Poder nesta sala, ignorando MURALHA. |
| **Pergaminho de Convocação** | Um Guardião Poder 3 luta por você nesta sala, nesta rodada. |
| **Pedra do Ferreiro** | Refino automático, sem rolar. |
| **Fumaça** | Seus personagens nesta sala ficam OCULTO. |

---

## 12. As variações — 26 bases × 3 caminhos

**26 variações base** (13 classes × 2), o baralho de recrutamento, com duas cópias de
cada. **39 Transcendências** (13 classes × 3), compradas no Altar a partir da rodada 3.

Uma base pode tomar qualquer um dos três caminhos da sua classe: **6 desfechos por
classe, 78 no total.** E como a evolução *soma* à base em vez de substituí-la, um Bruxo
Tempestade que virou Arquimago Nevasca (Poder 5, MURALHA 4) é um personagem diferente
de um Bruxo Jupitel que tomou o mesmo caminho (Poder 6, MURALHA 2). **Qual base você
evoluiu importa até a última rodada.**

> **Por que mudou.** Na primeira versão a Transcendência era um segundo baralho de
> personagens, embaralhado na mesma fileira a partir da rodada 3. O efeito era o oposto
> do pretendido: você comprava um Arquimago pronto e o seu Bruxo — aquele que sobreviveu
> a quatro rodadas, com a espada refinada e a Carta Hydra encaixada — virava enchimento.
> Ninguém se apegava a ninguém. Agora o veterano é *o próprio* que evolui, mantém o
> equipamento, e perdê-lo custa o recrutamento mais a evolução.

### As 26 variações base

| Variação | Classe | Custo | Poder | Papel | Slots | Palavras-chave | Build de origem |
|---|---|---|---|---|---|---|---|
| Cavaleiro Bola de Boliche | Cavaleiro | 6z | 4 | VANGUARDA | ◇◇ | ELO 1 | Bowling Bash |
| Cavaleiro Lanceiro | Cavaleiro | 5z | 3 | VANGUARDA | ◇ | PERFURAR 2 | Pierce montado |
| Templário Escudeiro | Templário | 5z | 2 | VANGUARDA | ◇◇ | ESCUDAR | Tanque de escudo |
| Templário Defensor | Templário | 6z | 3 | VANGUARDA | ◇ | MURALHA 1 | Defender |
| Bruxo Tempestade | Bruxo | 7z | 3 | ARCANO | ◇ | MURALHA 2, ALCANCE | Storm Gust |
| Bruxo Jupitel | Bruxo | 5z | 4 | ARCANO | ◇ | ALCANCE | Jupitel/Napalm |
| Sábio Proteção de Solo | Sábio | 6z | 2 | ARCANO | ◇ | ANULAR | Land Protection |
| Sábio Encantador | Sábio | 5z | 2 | ARCANO | ◇◇ | ELO 1 | Endow |
| Mercenário Golpe Sônico | Mercenário | 6z | 3 | ÁGIL | ◇ | RAJADA 3 | Sonic Blow |
| Mercenário Furtivo | Mercenário | 7z | 2 | ÁGIL | ◇ | OCULTO | Cloaking |
| Arruaceiro Gatuno | Arruaceiro | 5z | 2 | ÁGIL | ◇ | PILHAR 2 | Steal |
| Arruaceiro Saqueador | Arruaceiro | 6z | 3 | ÁGIL | ◇ | ANULAR | Strip |
| Ferreiro Forjador | Ferreiro | 5z | 2 | VANGUARDA | ◇◇ | — (refino sem quebra) | Forja |
| Ferreiro Mercador | Ferreiro | 4z | 1 | VANGUARDA | ◇ | PILHAR 3 | Overcharge |
| Alquimista Homúnculo | Alquimista | 6z | 2 | SUPORTE | ◇ | ELO 1 | Bio-ethics |
| Alquimista Boticário | Alquimista | 5z | 1 | SUPORTE | ◇ | RESTAURAR 1 | Potion Pitcher |
| Sacerdote Suporte | Sacerdote | 6z | 1 | SUPORTE | ◇ | ELO 2 | Full Support |
| Sacerdote Pneuma | Sacerdote | 6z | 2 | SUPORTE | ◇ | MURALHA 2 | Pneuma/Safety Wall |
| Monge Combo | Monge | 6z | 4 | VANGUARDA | ◇ | — | Chain Combo |
| Monge Corpo de Aço | Monge | 5z | 0 | VANGUARDA | ◇◇ | ESCUDAR, ESGOTAR | Steel Body |
| Caçador Armadilheiro | Caçador | 6z | 2 | ÁGIL | ◇ | MURALHA 2 | Trapper |
| Caçador Tiro Duplo | Caçador | 6z | 4 | ÁGIL | ◇ | ALCANCE | Double Strafe |
| Bardo Canção | Bardo/Odalisca | 5z | 1 | SUPORTE | ◇ | ELO 2 | Canções de grupo |
| Odalisca Dança Lenta | Bardo/Odalisca | 6z | 2 | SUPORTE | ◇ | MURALHA 2 | Slow Grace |
| Superaprendiz Teimoso | Superaprendiz | 3z | 2 | ÁGIL | ◇ | — (não sofre baixa na rodada 1) | Sobrevivência |
| Superaprendiz Improvisado | Superaprendiz | 4z | 2 | SUPORTE | ◇◇ | IMITAR | Faz de tudo |

**Nota sobre Monge Corpo de Aço:** Poder 0 com ESCUDAR e ESGOTAR. Ele não vence nada —
ele absorve um round inteiro de baixas por 5 zeny e sai de cena. É a unidade mais barata
e mais especializada do baralho.

### As 39 Transcendências

Comprada no Altar (ação de mercado) para **um personagem que já é seu**, uma vez por
personagem. A carta é empilhada sobre a base: **Poder e palavras-chave somam**, o
equipamento e as cartas de monstro continuam com ele.

| Caminho | Classe | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|---|
| Lorde dos Cavaleiros — Espiral | Cavaleiro | 11z | +3 | PERFURAR 4 | Spiral Pierce |
| Lorde dos Cavaleiros — Fúria Berserk | Cavaleiro | 12z | +5 | ESGOTAR | Berserk |
| Lorde dos Cavaleiros — Aura Lâmina | Cavaleiro | 10z | +2 | ELO 2 | Aura Blade |
| Paladino — Devoção | Templário | 11z | +2 | DEVOÇÃO | Devotion |
| Paladino — Corrente de Escudo | Templário | 11z | +4 | ESCUDAR | Shield Chain |
| Paladino — Sacrifício | Templário | 10z | +3 | RAJADA 3, ESGOTAR | Sacrifice |
| Arquimago — Nevasca | Bruxo | 11z | +2 | MURALHA 2 | Storm Gust ampliado |
| Arquimago — Chuva de Meteoros | Bruxo | 13z | +5 | RAJADA 3 | Meteor Storm |
| Arquimago — Ganbantein | Bruxo | 9z | +1 | ANULAR | Ganbantein |
| Professor — Dissonância | Sábio | 10z | +2 | ANULAR | Dispell |
| Professor — Duplo Cast | Sábio | 11z | +4 | — | Double Casting |
| Professor — Memorizar | Sábio | 10z | +2 | IMITAR | Memorize |
| Algoz — Rompe-Alma | Mercenário | 12z | +5 | RAJADA 2 | Soul Breaker |
| Algoz — Presa Sombria | Mercenário | 10z | +2 | OCULTO | Grimtooth |
| Algoz — Veneno Mortal | Mercenário | 11z | +3 | PERFURAR 3 | Enchant Deadly Poison |
| Desordeiro — Despojar Total | Arruaceiro | 10z | +2 | ANULAR, PILHAR 3 | Full Strip |
| Desordeiro — Plágio | Arruaceiro | 10z | +2 | IMITAR | Plagiarism |
| Desordeiro — Marcha Silenciosa | Arruaceiro | 12z | +2 | OCULTO · *anula a Marcha Forçada da facção* | Chase Walk |
| Mestre-Ferreiro — Carrocerada | Ferreiro | 11z | +4 | — | Cart Termination |
| Mestre-Ferreiro — Fundição Suprema | Ferreiro | 9z | +1 | *refino sem quebra + 1 grátis por rodada* | Forja lendária |
| Mestre-Ferreiro — Adrenalina Suprema | Ferreiro | 10z | +2 | ELO 2 | Adrenaline Rush |
| Criador — Demonstração Ácida | Alquimista | 12z | +4 | PERFURAR 4 | Acid Demonstration |
| Criador — Homúnculo Superior | Alquimista | 11z | +3 | ELO 2 | Homunculus S |
| Criador — Bomba de Esferas | Alquimista | 10z | +1 | MURALHA 3 | Sphere Mine |
| Sumo Sacerdote — Assumptio | Sacerdote | 11z | +2 | DEVOÇÃO | Assumptio |
| Sumo Sacerdote — Ressurreição | Sacerdote | 10z | +1 | RESTAURAR 2 | Resurrection |
| Sumo Sacerdote — Julgamento | Sacerdote | 12z | +5 | — | Magnus Exorcismus |
| Mestre — Punho de Asura | Monge | 14z | +7 | ESGOTAR | Asura Strike |
| Mestre — Salto | Monge | 11z | +3 | *anula a Marcha Forçada da facção* | Body Relocation |
| Mestre — Corpo de Aço Supremo | Monge | 10z | +1 | ESCUDAR · *não pode sofrer baixa* | Steel Body |
| Atirador de Elite — Chuva de Flechas | Caçador | 12z | +5 | ALCANCE | Arrow Storm |
| Atirador de Elite — Armadilha Suprema | Caçador | 10z | +2 | MURALHA 3 | Trap Research |
| Atirador de Elite — Olho de Falcão | Caçador | 10z | +2 | ANULAR · *revela OCULTO* | Falcon Assault |
| Menestrel/Cigana — Ensemble | Bardo/Odalisca | 9z | +2 | *com outro Bardo seu na sala, ambos +5* | Ensemble |
| Menestrel/Cigana — Marionete | Bardo/Odalisca | 11z | +0 | *dobra o Poder base de outro seu, máx. +6* | Marionette Control |
| Menestrel/Cigana — Canção Longa | Bardo/Odalisca | 10z | +2 | ELO 2 | Longing for Freedom |
| Superaprendiz — Teimosia Absurda | Superaprendiz | 7z | +2 | *não pode sofrer baixa* | Guardian Angel |
| Superaprendiz — Sorte de Principiante | Superaprendiz | 8z | +3 | SOLO 3 | Sorte pura |
| Superaprendiz — Imitação Descarada | Superaprendiz | 7z | +2 | IMITAR | Cópia de tudo |

**Nota sobre o Superaprendiz:** ele é a única classe que não tem forma transcendente no
Ragnarok, e o jogo não finge que tem. Os três caminhos dele mantêm o nome
"Superaprendiz", custam 7–8 zeny contra os 9–14 de todo mundo, e não dão poder
proporcional. Ele não transcende — ele só insiste.

**Nota sobre Salto e Marcha Silenciosa:** as duas anulam a penalidade de Marcha Forçada
da **facção inteira**, não só do portador. Um só deles guia o grupo, e é isso que
transforma essas evoluções numa jogada estratégica em vez de mais um bônus de Poder:
com um Mestre-Salto, mandar o clã direto para o Salão do Trono deixa de custar −6.

## 13. Os três modos

O núcleo é idêntico nos três. Só muda o setup, a condição de vitória e no máximo duas
regras.

### Modo 3 — CERCO *(o modo padrão; aprenda por ele)*

Um jogador é o **defensor** (escolha ou sorteio) e começa dono do castelo.

- Defensor: 18 zeny, 3 personagens, **3 fichas de Guardião** distribuídas entre as
  salas que quiser. Guardiões têm Poder impresso, lutam pelo defensor e voltam à
  reserva de Guardiões quando caem (podem ser recolocados por 4 zeny na fase de
  mercado, contando como ação).
- Vitória: **mais Glória** ao fim da rodada 6. Empate resolvido a favor de quem
  estiver com o castelo.

### Modo 1 — ASSALTO SELVAGEM

Ninguém começa dono. O castelo é do **Clã Fantasma**, que não é jogador.

- Cada sala tem um Guardião de Poder **3 + número da rodada**. O Clã Fantasma nunca
  recruta nem equipa; só engrossa.
- O Escudo do Emperium é o valor da trilha, sem defensor a somar.
- **Enquanto o Clã Fantasma for dono, ninguém marca os 2 de Glória de fim de rodada.**
  Esse é o único delta extra, e é o que impede a mesa inteira de esperar.
- Vitória: mais Glória ao fim da rodada 6.

### Modo 2 — GUERRA DOS REINOS

Cada jogador tem o próprio castelo: **2 alas + Salão do Trono + Sala do Emperium**.
Sorteie 2 fichas de ala por jogador do pool de 12.

- **Você continua com apenas 4 Ordens — para todos os castelos, incluindo o seu.**
  Essa é a regra inteira do modo. Defender sua Sala do Trono custa uma Ordem que você
  queria usar no Emperium alheio.
- Renda: 6 base + 6 por castelo que você controla.
- Glória: **2 por castelo controlado** no fim de cada rodada; **8 por castelo** no fim
  da rodada 6.
- Durabilidade do Emperium: **8** em todos os castelos (são menores).
- Vitória: mais Glória.

---

## 14. Escala de jogadores

Uma linha de setup, lida uma vez:

| Atacantes | Durabilidade do Emperium | Guardiões do defensor | Alas em jogo |
|---|---|---|---|
| 2 (3 jogadores) | 10 | 2 | 2 (castelo linear: Portão → B1 → B2 → Trono) |
| 3 (4 jogadores) | 14 | 3 | 4 (losango completo) |
| 4 (5 jogadores) | 18 | 4 | 4 (losango completo) |

Com 3 jogadores o castelo vira uma linha e o gargalo é brutal — que é exatamente o
que dois atacantes precisam para não se ignorarem.

---

## 15. Glória — a pontuação

| Fonte | Glória |
|---|---|
| Ser dono do castelo no fim das rodadas 1–5 | **2** cada |
| Ser dono do castelo no fim da rodada 6 | **8** |
| Cada cubo seu no Emperium quando ele quebra | **1** |
| Tomar o castelo (quebrar o Emperium) | **+3** |
| Derrotar personagens inimigos | **0** — deliberadamente |

Matar não pontua. Matar é meio, não fim. Se derrotar inimigos desse Glória, o jogo
viraria uma briga de rua no pátio e ninguém entraria no castelo.

**Teto teórico:** segurar da rodada 1 à 6 dá 10 + 8 = 18. Tomar o castelo na rodada 6
com 10 cubos dá 10 + 3 + 8 = 21. Ou seja: **quem chega no fim vence, mas quem segurou
o meio-jogo obriga o invasor a fazer um assalto grande, não um arranhão de última
hora.** É assim que a regra "vence quem fica com o castelo no final" continua
verdadeira sem virar um único lance de sorte.

---

## 16. Estrutura da rodada

1. **Renda** — simultânea, ~20 segundos.
2. **Mercado** — em ordem inversa de Glória, 3 ações cada.
3. **Comprometimento** — simultâneo e secreto: cartas de bruços nas salas, 1 Ordem de
   bruços por sala, consumíveis de bruços.
4. **Revelação e resolução** — sala por sala, do Portão para dentro. EMBOSCADA primeiro.
5. **Fim de rodada** — renda de salas controladas (Armazém, Forja, Capela), Glória do
   dono do castelo, Enfermaria → Reserva, avança a trilha de rodada.

Orçamento de tempo, 4 jogadores: 1 min + 4 min + 2 min + 5 min + 1 min ≈ **13 min por
rodada**, 6 rodadas ≈ **78 minutos**. Dentro da meta.

---

## 17. Respostas aos 11 problemas estruturais

**1. O "depois de você".** Três mecanismos empilhados. O dono do castelo marca 2 de
Glória toda rodada, então esperar é literalmente deixar o líder pontuar. O escudo do
Emperium absorve **em ordem crescente**, então mandar pouco é mandar nada. E o escudo
decai de 8 para 2 entre as rodadas 4 e 6, garantindo que o fim de jogo seja explosivo
em vez de travado.

**2. O defensor solitário.** Ele age *ao mesmo tempo* que todo mundo — não existe o
turno em que ele só assiste. Ele é o jogador mais rico da mesa (+6 zeny/rodada) e
ignora a regra de posicionamento dentro do próprio castelo, então tem liberdade tática
que nenhum atacante tem. E a mesa **não consegue** se coordenar contra ele: dois
atacantes na mesma sala são facções inimigas entre si, e o perdedor dos dois sofre
baixas mesmo tendo superado o defensor. Cercar junto é matematicamente pior do que
cercar sozinho em salas diferentes.

**3. A troca de papel.** Nada de regra nova: o novo dono simplesmente passa a ter a
renda do castelo e a liberdade de posicionamento. O equilíbrio vem do item 5 da quebra
— **todo mundo que estava na Sala do Emperium vai para a Enfermaria**, incluindo o
conquistador. Ele acorda rico e sem exército, com o Emperium restaurado à durabilidade
cheia. A mesa tem uma janela verdadeira, e ele tem uma rodada para se reconstruir.

**4. O último golpe.** Cada cubo no Emperium vale 1 de Glória para quem o colocou,
pago no momento da quebra. Quem amoleceu a defesa por duas rodadas leva o dinheiro
daquele trabalho mesmo perdendo a corrida. Quem quebra leva +3 e o castelo. A
contribuição é paga; a conquista é paga melhor.

**5. A divisão de forças no Modo 2.** As **4 Ordens** são compartilhadas entre todos os
castelos. Você não tem como atacar dois vizinhos e defender sua Sala do Trono na mesma
rodada sem gastar RESGUARDO em algum lugar onde queria INVESTIDA. Não existe resposta
ótima porque o recurso escasso não é tropa, é atenção.

**6. A gramática de 52 cartas.** 14 palavras-chave, no máximo 2 por carta. As 52
variações são composições, não exceções. A única regra "de texto livre" que sobrou está
em cinco cartas (Ferreiro Forjador, Mestre-Ferreiro Carrocerada, Mestre Salto,
Ensemble, Marionete) e as cinco são efeitos econômicos ou de posicionamento, fora do
cálculo de combate — não aumentam a carga durante a resolução.

**7. A segunda economia.** Uma moeda só, e **3 ações de mercado por rodada** que
recrutar, equipar, refinar e comprar consumível disputam entre si. Refinar duas vezes
é não recrutar. A camada de itens não roda ao lado do recrutamento; ela come do mesmo
prato.

**8. Personalidade de sala sem sobrecarga.** Cada ficha tem exatamente uma linha
impressa e só **quatro** estão em jogo por partida, sorteadas de doze. Você lê durante
o setup e a regra fica debaixo das peças o jogo inteiro.

**9. O relógio.** Seis rodadas fixas. O Altar abre na rodada 3 e o escudo do
Emperium cai de 8 para 6, 4 e 2 nas rodadas 4, 5 e 6. A partida não termina — ela
acelera até estourar. A rodada 6 vale 8 de Glória, quatro vezes uma rodada normal.

**10. Escala 3/4/5.** Uma linha de tabela: durabilidade do Emperium, número de
Guardiões, número de alas. Nenhuma regra muda.

**11. O personagem rico demais.** Quando um personagem cai, **o vencedor da sala
escolhe um equipamento dele e fica com ele**. Concentrar cinco itens num herói o
transforma num alvo cuja queda financia o inimigo. A pressão para espalhar é
econômica, não uma regra de limite, e é por isso que os slots são poucos (0 a 2).

---

## 18. Riscos conhecidos e alavancas

| Risco | Sinal no playtest | Alavanca (nesta ordem) |
|---|---|---|
| **Marionete + Punho de Asura** (0+10 → 16 numa sala) | Uma sala decidida por dois personagens | O teto de +6 na Marionete já existe; se ainda quebrar, suba o custo do Mestre para 14z |
| Defensor rico demais e intocável | Castelo nunca troca de dono | Baixe o bônus do castelo de +6 para +4 zeny |
| Defensor frágil demais | Castelo troca toda rodada | Suba o bônus do Salão do Trono de +2 para +3 |
| Rodada 6 decide tudo sozinha | Jogadores ignoram as rodadas 1–3 | Suba a Glória por rodada de 2 para 3, e desça a final de 8 para 6 |
| Fase de mercado arrastada | Mais de 5 min com 4 jogadores | Corte de 3 ações para 2 e suba a renda base de 6 para 8 |
| MURALHA domina o meta | Toda partida vira Nevasca + Esfera Marinha | Faça MURALHA reduzir no máximo metade do Poder Total inimigo |
| Ninguém compra consumível | Baralho intocado ao fim | Desça o custo de 4z para 3z e dê 1 consumível grátis no setup |
| Espólio nunca acontece | Ninguém equipa personagem que vai à frente | Deixe o vencedor pegar equipamento de **qualquer** personagem derrotado, não só dos caídos com item |

---

## 19. Roteiro do primeiro playtest

Quatro jogadores, Modo 3, castelo com as alas 1 (Corredor Estreito), 5 (Salão dos
Guardiões), 6 (Armazém) e 9 (Torre de Vigia). Anote durante a partida:

1. **Em quantas das 6 rodadas o defensor levou mais de 30 segundos decidindo o
   comprometimento?** Menos de 4 significa que o defensor não tem jogo.
2. **O castelo trocou de dono pelo menos uma vez antes da rodada 5?** Se não, o escudo
   ou a renda do defensor estão altos demais.
3. **Alguém terminou com menos de 4 de Glória?** Se sim, existe um estado de jogador
   morto que a regra de não-eliminação não está cobrindo.
4. **Alguma rodada passou de 15 minutos?** A fase de mercado é a suspeita padrão.
5. **Alguém comprometeu em 4 salas numa mesma rodada?** Se ninguém fez isso a partida
   inteira, as 4 Ordens estão folgadas e o aperto que deveria doer não está doendo.

Nenhuma dessas pergunta se foi divertido. Divertido não é falseável.

---

## 20. Nota de porte para o Boardzando

O design é físico primeiro e roda em cartolina. Mas quatro coisas ficam
estritamente melhores como plugin server-authoritative em
`apps/server/src/games/emperium/`:

- **Comprometimento simultâneo é nativo.** Na mesa, quatro pessoas colocando cartas de
  bruços ao mesmo tempo é a fase mais desajeitada da rodada. No servidor, cada jogador
  submete o seu e o `playerView` esconde o resto até a revelação — informação oculta
  real, sem ninguém espiando.
- **OCULTO e a Torre de Vigia viram névoa de guerra de verdade.** Fisicamente, uma
  carta de bruços já denuncia que *algo* está ali. Digitalmente, o Mercenário Furtivo
  pode ser genuinamente invisível, e a Torre de Vigia entrega informação parcial e
  precisa a um jogador só.
- **A Guarnição do Clã Fantasma (Modo 1) vira IA.** No físico ela precisa ser burra e
  determinística para não exigir um mestre de jogo. No digital ela pode ter
  comportamento por sala e usar `ctx.random` de forma reprodutível.
- **O Modo 2 deixa de ser um problema de espaço.** Cinco castelos na mesa é
  inviável fisicamente e trivial na tela. É provavelmente o modo que mais ganha com o
  porte, e o argumento mais forte para fazê-lo.

A aritmética de resolução (MURALHA, PERFURAR, ELO, absorção crescente do escudo) é
trivial de automatizar e é a maior fonte de erro humano na mesa — o servidor a resolve
sem discussão. Seguir as convenções de
[skills/add-game-plugin/SKILL.md](../../skills/add-game-plugin/SKILL.md): estado em
`emperium.state.ts`, reducers puros em `emperium.moves.ts`, `ctx.random` no refino, e
`playerView` escondendo comprometimentos até a fase de revelação.
