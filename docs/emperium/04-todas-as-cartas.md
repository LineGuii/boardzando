# TODAS AS CARTAS — Guerra do Emperium

> **Documento gerado.** Sai de `packages/contracts/src/emperium.ts`, que é a fonte
> única dos números do jogo. Para regenerar depois de mexer no catálogo:
>
> ```bash
> pnpm --filter @boardzando/contracts build && node docs/emperium/gerar-cartas.mjs
> ```

---

## Como ler isto

As cartas estão **agrupadas por classe**, e dentro de cada classe as duas bases vêm
antes dos três caminhos de Transcendência. É de propósito: a maior parte dos problemas
de balanceamento aparece **comparando irmãs**, não lendo carta isolada.

A coluna **z/P** é o custo dividido pelo Poder — quanto *menor*, mais Poder por zeny.
Ela não julga sozinha (uma carta de Poder 1 com palavra-chave forte deve mesmo ter
razão ruim), mas duas cartas de custo parecido com razões muito diferentes merecem uma
segunda olhada.

**Perguntas úteis para anotar na margem:**

- Alguma classe tem duas bases que fazem a mesma coisa?
- Algum caminho de Transcendência nunca seria escolhido sobre os outros dois?
- Alguma carta tem razão z/P muito fora da faixa da classe dela?
- Algum combo exige um companheiro que quase nunca vai estar na mesma sala?
- Alguma carta sem palavra-chave e sem combo é chata demais para existir?

---

## Panorama

| | |
|---|---|
| Variações base | **42** (13 classes × 2) |
| Transcendências | **42** (13 classes × 3) |
| Desfechos possíveis | **126** (cada base × 3 caminhos) |
| Bases com combo | 19 de 42 |
| Transcendências com combo | 12 de 42 |
| Custo das bases | 3–7 zeny |
| Poder das bases | 0–5 |
| Custo das evoluções | 7–14 zeny |
| Equipamentos | 31 |
| Cartas de monstro | 11 tipos |
| Consumíveis | 8 tipos |

**Cartas sem palavra-chave e sem combo** — são as mais simples do baralho, e vale
conferir se são simples de propósito ou só sem graça: Ferreiro Forjador, Monge Combo, Superaprendiz Teimoso.

---

## Personagens

### Cavaleiro

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Cavaleiro Bola de Boliche** | 6z | 4 | 1.5 | Vanguarda | ◇◇ | ELO 1 | *Bowling Bash* |
| **Cavaleiro Lanceiro** | 5z | 3 | 1.7 | Vanguarda | ◇ | PERFURAR 2 | *Pierce montado* |
| **Cavaleiro Provocador** | 5z | 2 | 2.5 | Vanguarda | ◇◇ | PROTEGER | *Provoke* |

- **Cavaleiro Bola de Boliche** — COMBO Templário: o maior clã inimigo fica PRESO.
- **Cavaleiro Provocador** — COMBO Arcano: o maior clã inimigo fica EXPOSTO — ele veio atrás de você.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Espiral** | 11z | +3 | PERFURAR 4 | *Spiral Pierce* |
| **Fúria Berserk** | 12z | +0 | BERSERK 5 | *Berserk* |
| **Montaria** | 13z | +2 | MOVER 4 | *Peco-Peco de guerra* |

> **Anotações:**

### Templário

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Templário Escudeiro** | 5z | 2 | 2.5 | Vanguarda | ◇◇ | PROTEGER | *Tanque de escudo* |
| **Templário Redentor** | 6z | 2 | 3.0 | Vanguarda | ◇◇ | DEVOÇÃO 2 | *Sacrifice* |
| **Templário Defensor** | 6z | 3 | 2.0 | Vanguarda | ◇ | MURALHA 1 | *Defender* |

- **Templário Redentor** — COMBO Sacerdote: seus Vanguardas não sofrem baixa nesta sala.
- **Templário Defensor** — COMBO Arcano: seus Arcanos não sofrem baixa nesta sala.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Devoção** | 11z | +2 | DEVOÇÃO 2 | *Devotion* |
| **Corrente de Escudo** | 11z | +4 | PROTEGER | *Shield Chain* |
| **Sacrifício** | 10z | +3 | RAJADA 3 · ESGOTAR | *Sacrifice* |

- **Devoção** — COMBO Vanguarda: se você perder, o vencedor também sofre 1 baixa.
- **Corrente de Escudo** — COMBO Arcano: seus Arcanos não sofrem baixa nesta sala.

> **Anotações:**

### Bruxo

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Bruxo Tempestade** | 7z | 3 | 2.3 | Arcano | ◇ | MURALHA 2 · ALCANCE | *Storm Gust* |
| **Bruxo Jupitel** | 5z | 4 | 1.3 | Arcano | ◇ | ALCANCE | *Jupitel / Napalm* |
| **Bruxo Conjurador** | 7z | 2 | 3.5 | Arcano | ◇ | MURALHA 1 | *Precast* |

- **Bruxo Conjurador** — COMBO Bardo: +5 de Poder — a canção sustenta a conjuração.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Nevasca** | 11z | +2 | MURALHA 2 | *Storm Gust ampliado* |
| **Chuva de Meteoros** | 13z | +5 | RAJADA 3 | *Meteor Storm* |
| **Ganbantein** | 9z | +1 | ANULAR | *Ganbantein* |

- **Ganbantein** — COMBO Sábio: seus personagens ignoram toda a Muralha inimiga.

> **Anotações:**

### Sábio

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Sábio Proteção de Solo** | 6z | 2 | 3.0 | Arcano | ◇ | ANULAR | *Land Protection* |
| **Sábio Encantador** | 5z | 2 | 2.5 | Arcano | ◇◇ | ELO 1 | *Endow* |
| **Sábio Petrificador** | 6z | 3 | 2.0 | Arcano | ◇ | MURALHA 1 | *Stone Curse* |

- **Sábio Proteção de Solo** — COMBO Bruxo: seus personagens ignoram toda a Muralha inimiga.
- **Sábio Petrificador** — ESPECIAL: o maior clã inimigo fica PRESO.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Dissonância** | 10z | +2 | ANULAR | *Dispell* |
| **Duplo Cast** | 11z | +4 | — | *Double Casting* |
| **Memorizar** | 10z | +2 | IMITAR | *Memorize* |

- **Dissonância** — ESPECIAL: o maior clã inimigo fica PRESO.
- **Memorizar** — COMBO Monge: ninguém seu vai à Enfermaria por Esgotar.

> **Anotações:**

### Mercenário

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Mercenário Golpe Sônico** | 6z | 3 | 2.0 | Ágil | ◇ | RAJADA 3 | *Sonic Blow* |
| **Mercenário Furtivo** | 7z | 2 | 3.5 | Ágil | ◇ | OCULTO | *Cloaking* |
| **Mercenário Katar** | 6z | 4 | 1.5 | Ágil | ◇ | PERFURAR 2 | *Katar crítico* |

- **Mercenário Golpe Sônico** — COMBO Alquimista: +4 de Poder — ele entra pela brecha.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Rompe-Alma** | 12z | +5 | RAJADA 2 | *Soul Breaker* |
| **Presa Sombria** | 10z | +2 | OCULTO | *Grimtooth* |
| **Veneno Mortal** | 11z | +5 | PERFURAR 3 · MALDIÇÃO 2 | *Enchant Deadly Poison* |

> **Anotações:**

### Arruaceiro

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Arruaceiro Gatuno** | 5z | 2 | 2.5 | Ágil | ◇ | PILHAR 2 | *Steal* |
| **Arruaceiro Saqueador** | 6z | 3 | 2.0 | Ágil | ◇ | ANULAR | *Strip* |
| **Arruaceiro Batedor** | 5z | 3 | 1.7 | Ágil | ◇ | RAJADA 2 | *Back Stab* |

- **Arruaceiro Gatuno** — COMBO Agil: RAPTO — arranque 1 inimigo da sala.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Despojar Total** | 10z | +2 | ANULAR · PILHAR 3 | *Full Strip* |
| **Plágio** | 10z | +2 | IMITAR | *Plagiarism* |
| **Marcha Silenciosa** | 12z | +2 | OCULTO · MOVER 2 | *Chase Walk* |

- **Marcha Silenciosa** — ESPECIAL: RAPTO — arranque 1 inimigo da sala.

> **Anotações:**

### Ferreiro

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Ferreiro Forjador** | 5z | 2 | 2.5 | Vanguarda | ◇◇ | — | *Forja* |
| **Ferreiro Mercador** | 4z | 1 | 4.0 | Vanguarda | ◇ | PILHAR 3 | *Overcharge* |
| **Ferreiro Perfeição de Armas** | 6z | 2 | 3.0 | Vanguarda | ◇◇ | PERFURAR 2 | *Weapon Perfection* |

- **Ferreiro Mercador** — ESPECIAL: +1 de Poder a cada 5 zeny no seu bolso.
- **Ferreiro Perfeição de Armas** — COMBO Vanguarda: seus personagens ignoram toda a Muralha inimiga.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Carrocerada** | 11z | +4 | — | *Cart Termination* |
| **Fundição Suprema** | 9z | +1 | — · *refino sem quebra e 1 grátis por rodada* | *Forja lendária* |
| **Adrenalina Suprema** | 10z | +2 | ELO 2 | *Adrenaline Rush* |

- **Carrocerada** — ESPECIAL: +1 de Poder a cada 3 zeny no seu bolso.

> **Anotações:**

### Alquimista

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Alquimista Homúnculo** | 6z | 2 | 3.0 | Suporte | ◇ | ELO 1 | *Bio-ethics* |
| **Alquimista Boticário** | 5z | 1 | 5.0 | Suporte | ◇ | RESTAURAR 1 | *Potion Pitcher* |
| **Alquimista Fogo Grego** | 6z | 3 | 2.0 | Suporte | ◇ | PERFURAR 2 | *Fogo grego* |

- **Alquimista Boticário** — ESPECIAL: o maior clã inimigo fica EXPOSTO.
- **Alquimista Fogo Grego** — COMBO Arcano: +4 de Poder — o fogo pega no que o mago acendeu.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Demonstração Ácida** | 12z | +4 | PERFURAR 4 | *Acid Demonstration* |
| **Homúnculo Superior** | 11z | +3 | ELO 2 | *Homunculus S* |
| **Bomba de Esferas** | 10z | +1 | MURALHA 3 | *Sphere Mine* |

- **Demonstração Ácida** — ESPECIAL: o maior clã inimigo fica EXPOSTO e PRESO.
- **Homúnculo Superior** — ESPECIAL: +3 de Poder — o homúnculo luta junto.

> **Anotações:**

### Sacerdote

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Sacerdote Suporte** | 6z | 1 | 6.0 | Suporte | ◇ | ELO 2 | *Full Support* |
| **Sacerdote Pneuma** | 6z | 2 | 3.0 | Suporte | ◇ | MURALHA 2 | *Pneuma / Safety Wall* |
| **Sacerdote de Batalha** | 5z | 3 | 1.7 | Suporte | ◇◇ | SOLO 2 | *Battle Priest* |

- **Sacerdote Suporte** — COMBO Vanguarda: seu clã ganha MOVER 1.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Assumptio** | 11z | +2 | DEVOÇÃO 2 | *Assumptio* |
| **Ressurreição** | 10z | +1 | RESTAURAR 2 | *Resurrection* |
| **Julgamento** | 12z | +5 | — | *Magnus Exorcismus* |

> **Anotações:**

### Monge

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Monge Combo** | 6z | 4 | 1.5 | Vanguarda | ◇ | — | *Chain Combo* |
| **Monge Corpo de Aço** | 5z | 0 | — | Vanguarda | ◇◇ | PROTEGER · ESGOTAR | *Steel Body* |
| **Monge Disparar Esferas** | 6z | 2 | 3.0 | Vanguarda | ◇ | PERFURAR 3 | *Investigate* |

- **Monge Corpo de Aço** — ESPECIAL: o maior clã inimigo fica PRESO.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Punho de Asura** | 14z | +11 | ESGOTAR · MALDIÇÃO 3 | *Asura Strike* |
| **Salto** | 11z | +3 | MOVER 2 | *Body Relocation* |
| **Corpo de Aço e Dilema** | 10z | +1 | PROTEGER · *não pode sofrer baixa* | *Steel Body* |

> **Anotações:**

### Caçador

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Caçador Armadilheiro** | 6z | 2 | 3.0 | Ágil | ◇ | MURALHA 2 | *Trapper* |
| **Caçador Rajada de Flechas** | 6z | 5 | 1.2 | Ágil | ◇ | ALCANCE · FRÁGIL | *Double Strafe* |
| **Caçador Falcoeiro** | 6z | 2 | 3.0 | Ágil | ◇ | ALCANCE | *Falcão / Blitz Beat* |

- **Caçador Armadilheiro** — ESPECIAL: o maior clã inimigo fica REVELADO.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Chuva de Flechas** | 12z | +5 | ALCANCE | *Arrow Storm* |
| **Armadilha Suprema** | 10z | +2 | MURALHA 3 | *Trap Research* |
| **Olho de Falcão** | 10z | +2 | ANULAR · *Revela Oculto inimigo na sala* | *Falcon Assault* |

- **Olho de Falcão** — ESPECIAL: o maior clã inimigo fica REVELADO.

> **Anotações:**

### Bardo

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Bardo Canção** | 5z | 1 | 5.0 | Suporte | ◇ | ELO 2 | *Canções de grupo* |
| **Bardo Maçã de Idun** | 5z | 1 | 5.0 | Suporte | ◇ | RESTAURAR 1 | *Apple of Idun* |
| **Bardo Flecha Musical** | 6z | 4 | 1.5 | Ágil | ◇ | ALCANCE | *Musical Strike* |

- **Bardo Canção** — COMBO Arcano: seus Arcanos ganham +3 de Poder.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Ensemble** | 9z | +2 | — · *com um Bardo E uma Odalisca seus na sala, cada músico dá +5* | *Ensemble* |
| **Canção Longa** | 10z | +2 | ELO 2 | *Longing for Freedom* |
| **Vulcão de Flechas** | 12z | +5 | ALCANCE | *Arrow Vulcan* |

- **Canção Longa** — COMBO Vanguarda: seu clã ganha MOVER 1.

> **Anotações:**

### Odalisca

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Odalisca Dança Lenta** | 6z | 2 | 3.0 | Suporte | ◇ | MURALHA 2 | *Slow Grace* |
| **Odalisca Dança das Adagas** | 6z | 4 | 1.5 | Ágil | ◇ | RAJADA 2 | *Throw Arrow* |
| **Odalisca Serviço para Você** | 6z | 1 | 6.0 | Suporte | ◇ | DEVOÇÃO 2 | *Service For You* |

- **Odalisca Dança Lenta** — COMBO Bardo: +4 de Poder — o dueto.
- **Odalisca Serviço para Você** — COMBO Monge: ninguém seu vai à Enfermaria por Esgotar.

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Marionete** | 11z | +0 | — · *dobra o Poder base de outro seu, máx. +6* | *Marionette Control* |
| **Tarô do Destino** | 11z | +2 | ANULAR | *Tarot Card of Fate* |
| **Ritmo Hipnótico** | 10z | +2 | MURALHA 3 | *Slow Grace ampliado* |

- **Tarô do Destino** — ESPECIAL: o maior clã inimigo fica EXPOSTO.

> **Anotações:**

### Superaprendiz

| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |
|---|---|---|---|---|---|---|---|
| **Superaprendiz Teimoso** | 3z | 1 | 3.0 | Ágil | ◇◇◇ | — | *Sobrevivência teimosa* |
| **Superaprendiz Sortudo** | 4z | 1 | 4.0 | Ágil | ◇ | SOLO 3 | *Sorte de principiante* |
| **Superaprendiz Improvisado** | 4z | 2 | 2.0 | Suporte | ◇◇ | IMITAR 1 | *Faz de tudo* |

| Transcendência | Custo | +Poder | Ganha | Origem |
|---|---|---|---|---|
| **Teimosia Absurda** | 8z | +1 | — · *não pode sofrer baixa* · *+1 slot de equipamento* | *Guardian Angel* |
| **Sobrecarga** | 9z | +4 | ESGOTAR | *Sobrecarga* |
| **Imitação Descarada** | 7z | +2 | IMITAR 2 | *Cópia de tudo* |

> **Anotações:**

---

## Equipamento

### Armas

| Carta | Papel | Custo | +Poder | Encaixes | Palavras-chave | Efeito próprio |
|---|---|---|---|---|---|---|
| **Espada Bastarda** | Vanguarda | 5z | +2 | ◈ | — | — |
| **Lança de Cavalaria** | Vanguarda | 6z | +2 | ◈ | PERFURAR 1 | — |
| **Machado de Guerra** | Vanguarda | 7z | +4 | ◈ | — | −1 se o portador tiver PROTEGER |
| **Lâmina Maldita** | qualquer | 6z | +7 | ◈ | MALDIÇÃO 4 | — |
| **Cajado da Tempestade** | Arcano | 6z | +3 | ◈ | — | — |
| **Grimório** | Arcano | 5z | +1 | ◈ | MURALHA 1 | — |
| **Varinha de Anulação** | Arcano | 7z | +1 | — | ANULAR | — |
| **Adaga Gêmea** | Ágil | 5z | +2 | ◈ | RAJADA 1 | — |
| **Arco Composto** | Ágil | 6z | +3 | ◈ | — | exige ALCANCE |
| **Katar Sombria** | Ágil | 7z | +3 | ◈ | — | — |
| **Alaúde** | Suporte | 5z | +1 | ◈ | ELO 1 | — |
| **Chicote de Seda** | Suporte | 5z | +2 | ◈ | — | — |
| **Maça Sagrada** | Suporte | 6z | +2 | — | RESTAURAR 1 | — |

> **Anotações:**

### Armaduras

| Carta | Papel | Custo | +Poder | Encaixes | Palavras-chave | Efeito próprio |
|---|---|---|---|---|---|---|
| **Cota de Malha** | qualquer | 4z | +1 | ◈ | — | — |
| **Armadura Completa** | Vanguarda | 7z | +2 | ◈ | PROTEGER | — |
| **Manto de Ninfa** | Arcano / Suporte | 6z | +0 | ◈ | — | Ignora a primeira baixa desta sala |
| **Traje de Sombras** | Ágil | 6z | +1 | — | OCULTO | — |
| **Escudo Sagrado** | Vanguarda | 5z | +0 | ◈ | MURALHA 1 | — |
| **Botas de Fuga** | qualquer | 4z | +0 | — | — | Baixas vão para a Reserva, não para a Enfermaria |
| **Manto Élfico** | qualquer | 5z | +1 | — | — | Imune a Anular |
| **Vestes do Sábio** | Arcano | 6z | +1 | ◈ | PERFURAR 2 | — |
| **Peitoral Rúnico** | Vanguarda | 8z | +3 | ◈ | — | — |
| **Túnica Simples** | qualquer | 3z | +1 | ◈◈ | — | — |

> **Anotações:**

### Acessórios

| Carta | Papel | Custo | +Poder | Encaixes | Palavras-chave | Efeito próprio |
|---|---|---|---|---|---|---|
| **Anel do Mercador** | qualquer | 5z | +0 | — | — | +2 de renda por rodada |
| **Broche do Guildmaster** | qualquer | 6z | +0 | — | — | +1 ação de mercado por rodada |
| **Amuleto de Ferro** | qualquer | 4z | +0 | — | — | Nunca é a primeira baixa |
| **Talismã do Vento** | qualquer | 4z | +0 | — | MOVER 1 | — |
| **Oculos do Caçador** | qualquer | 5z | +0 | — | — | Revela Oculto inimigo na sala |
| **Colar de Zeny** | qualquer | 3z | +0 | — | PILHAR 2 | — |
| **Selo do Emperium** | qualquer | 8z | +0 | — | — | +2 de Poder na Sala do Emperium |
| **Pergaminho Antigo** | qualquer | 5z | +0 | — | IMITAR | — |

> **Anotações:**

---

## Cartas de monstro

Encaixam nos slots ◈ dos equipamentos. Permanentes e viradas para cima na mesa.

| Carta | Efeito |
|---|---|
| **Thara Frog** | Ignora a primeira baixa causada por personagem inimigo. |
| **Raydric** | +2 de Poder quando você é o dono do castelo. |
| **Hydra** | +2 de Poder quando você é atacante. |
| **Marc** | Imune a Muralha. |
| **Angeling** | Imune a Anular. |
| **Ghostring** | Não pode sofrer baixa. Poder reduzido à metade. |
| **Poring** | +3 zeny sempre que este personagem vence uma sala. |
| **Baphomet** | Elo 1. |
| **Doppelganger** | Rajada 2. |
| **Horong** | Revela todos os inimigos ocultos desta sala. |
| **Orc Herói** | Perfurar 2. |

> **Anotações:**

---

## Consumíveis

| Carta | Efeito | Jogado |
|---|---|---|
| **Poção Branca** | Cancele 1 baixa sua nesta sala. | na sala, de bruços |
| **Asa de Mosca** | Mova 1 personagem seu para uma sala adjacente antes de revelar. | na sala, de bruços |
| **Asa de Borboleta** | Retire o grupo do seu clã desta sala. Sem baixas, sem controle. | na sala, de bruços |
| **Folha de Yggdrasil** | Traga 1 personagem da Enfermaria direto para esta sala. | na sala, de bruços |
| **Frasco de Ácido** | +3 de Poder nesta sala, ignorando Muralha. | na sala, de bruços |
| **Pergaminho de Convocação** | Um Guardião Poder 3 luta por você nesta sala, nesta rodada. | na sala, de bruços |
| **Elunium** | Refino automático, sem rolar. | no mercado |
| **Fumaça** | Seus personagens nesta sala ficam Oculto. | na sala, de bruços |

> **Anotações:**

