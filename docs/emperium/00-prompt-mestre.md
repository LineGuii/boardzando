# BRIEFING DE DESIGN — "Guerra do Emperium" (board game original)

## SEU PAPEL

Você é um designer de board games sênior com portfólio em jogos mid-heavy de
conflito direto e economia de recrutamento. Sua especialidade é a articulação
entre três camadas: **motor econômico** (como o jogador fica mais forte),
**posicionamento espacial** (por que o mapa importa) e **tensão social**
(por que a mesa não estabiliza num equilíbrio chato). Você tem experiência de
desenvolvimento, não só de concepção: sabe que a primeira ideia boa quase sempre
esconde um problema de downtime, kingmaking ou dominância de estratégia, e você
caça esses problemas *antes* de escrever a regra.

Você também conhece Ragnarok Online da era clássica/transcendente a fundo — não
como nostalgia genérica, mas mecanicamente: sabe o que era um precast, por que
Storm Gust em corredor definia a guerra, o que Devotion fazia por um Lord Knight,
por que uma Thara Frog Card mudava uma build inteira, e por que o Emperium ficava
numa sala labiríntica.

Escreva em português do Brasil. Seja concreto: números reais, não placeholders.

---

## O JOGO A SER PROJETADO

### Premissa

Clãs rivais disputam o controle de um castelo. Um Emperium cristalino no coração
da fortaleza é a condição de vitória: quem o quebra, toma o castelo. **Ninguém é
aliado de ninguém** — alianças podem ser faladas, nunca vinculadas por regra.
Cada jogador recruta membros para seu clã a partir das classes do jogo, equipa
esses membros, e os envia para dentro do castelo.

### Restrições inegociáveis (o cliente pediu explicitamente)

1. **13 classes, cada uma com exatamente 4 variações** (52 personagens no total).
   Cada variação deve refletir um *build* real e reconhecível do RO, não uma
   diferença cosmética de números.
2. **Tabuleiro com as salas do castelo**, cada sala com personalidade mecânica
   própria — a sala precisa mudar *como se joga* nela, não só dar +1 de algo.
3. **Recrutamento de membros do clã é o motor econômico central.** O jogador
   constrói força ao longo da partida comprando/contratando personagens.
4. **Existe uma camada de equipamentos e itens** (detalhada abaixo): armas,
   armaduras, acessórios, cartas de monstro encaixáveis e consumíveis.
5. **Cartas fazem parte do jogo, mas não precisam ser o sistema central.**
   Se um sistema não-carta (dados customizados, tokens, ação em mapa, alocação
   de trabalhadores) resolver melhor, use — e justifique.
6. **Três modos de jogo** compartilhando o mesmo núcleo (detalhados abaixo).
7. **Nenhuma eliminação de jogador.** Perder personagens é o custo normal de
   jogar; ficar sem nada para fazer não é aceitável.

### Alvos de design

- 3–5 jogadores (otimizar para 4; 3 e 5 devem funcionar sem regra paralela).
- 60–90 minutos.
- Peso BGG ~3.0–3.4: mid-heavy. Referência de carga cognitiva: Clank!,
  Lost Ruins of Arnak, Blood Rage. Não Twilight Imperium, não Dominion.
- **Físico primeiro, digital depois.** Toda mecânica deve passar no *teste da
  cartolina*: um humano executa o upkeep em menos de ~10 segundos, sem
  planilha. Onde uma versão digital permitiria algo melhor (ordens secretas
  simultâneas, névoa de guerra real, IA de monstros, cálculo automático),
  **marque explicitamente** como "upgrade digital" — mas a regra física
  precisa funcionar sozinha.

### As três classes de partida (modos)

- **Modo 1 — Assalto Selvagem:** ninguém defende. O castelo é guardado apenas
  por monstros/guardiões. Todos invadem; vence quem ficar com o castelo.
- **Modo 2 — Guerra dos Reinos:** cada jogador tem seu próprio castelo. Pode
  atacar castelos alheios ou defender o seu. Vence quem controlar mais no fim.
  A tensão central é **dividir suas forças** — cada personagem enviado para
  atacar é um personagem ausente da sua própria defesa.
- **Modo 3 — Cerco:** um jogador defende, os outros atacam. Vence quem estiver
  com o castelo no fim do jogo.

Estes **não são três jogos diferentes**. Projete um núcleo único e expresse
cada modo como um *delta* pequeno e legível sobre ele (setup, condição de
vitória, e no máximo 1–2 regras específicas). Se um modo exigir reescrever o
núcleo, o núcleo está errado.

---

## AS 13 CLASSES (nomenclatura PT-BR do Ragnarok)

Use os nomes brasileiros. O equivalente em inglês está entre parênteses para
evitar erro de identidade — atenção especial a **Mercenário = Assassin**, que
não é um "soldado de aluguel".

| Classe | (EN) | Fantasia mecânica de origem |
|---|---|---|
| Cavaleiro | Knight / Lord Knight | Dano sustentado em linha, mobilidade montada |
| Templário | Crusader / Paladin | Tanque, proteção de aliados, dano sagrado em área |
| Bruxo | Wizard / High Wizard | Magia de área massiva, controle de corredor |
| Sábio | Sage / Professor | Contra-magia, anulação, manipulação de terreno |
| Mercenário | Assassin / Assassin Cross | Furtividade, burst, infiltração |
| Arruaceiro | Rogue / Stalker | Roubo, desarme, cópia de habilidades |
| Ferreiro | Blacksmith / Whitesmith | Economia, forja, dano pago com dinheiro |
| Alquimista | Alchemist / Creator | Invocações, químicos, suporte consumível |
| Sacerdote | Priest / High Priest | Cura, barreiras, buffs de sustentação |
| Monge | Monk / Champion | Dano explosivo de uso único, combos |
| Caçador | Hunter / Sniper | Armadilhas, negação de área, dano à distância |
| Bardo/Odalisca | Bard-Dancer / Clown-Gypsy | Auras de grupo, ensembles, debuff de campo |
| Superaprendiz | Super Novice | Versatilidade, imprevisibilidade, sobrevivência improvável |

### Sobre as 4 variações

Cada variação é um **build clássico**, com identidade tática distinta e um custo
real. As quatro de uma mesma classe devem ocupar nichos diferentes — se duas
delas fariam a mesma coisa na mesma sala, uma das duas está errada. Sementes
(use, adapte ou substitua por algo melhor — mas mantenha esse nível de
especificidade):

- **Cavaleiro:** Bowling Bash (dano em área contida) · Spiral Pierce (dano único
  perfurante) · Two-Hand Quicken/Berserk (glass cannon, sem defesa) ·
  Lanceiro montado (mobilidade alta, atravessa salas)
- **Templário:** Devotion (transfere para si o dano de um aliado) · Shield Chain
  (tanque ofensivo) · Grand Cross/Sacrifice (queima a própria vida por área) ·
  Defender (reduz dano à distância de todo o grupo na sala)
- **Bruxo:** Storm Gust (trava corredor) · Meteor Storm (área lenta e devastadora)
  · Jupitel/Napalm (dano de alvo único rápido) · Frost Diver/Stone Curse
  (congela um personagem — tira ele do combate por um turno)
- **Sábio:** Land Protection (anula magia de solo — o contra direto do precast) ·
  Double Casting (dano) · Dispell/Free Cast (remove buffs inimigos) ·
  Endow/Auto Spell (encanta as armas do clã com elemento)
- **Mercenário:** Sonic Blow (burst) · Cloaking (entra ignorando salas) ·
  Enchant Poison/Soul Breaker (dano por veneno persistente) ·
  Grimtooth (ataca de dentro da ocultação, sem se revelar)
- **Arruaceiro:** Full Strip (desequipa o alvo) · Backstab/Raid ·
  Plagiarism (copia a habilidade do último personagem que agiu) ·
  Gank/Steal (rouba um item ou equipamento do inimigo e fica com ele)
- **Ferreiro:** Cart Termination (converte dinheiro em dano) · Forja
  (fabrica equipamento para o clã) · Adrenaline Rush (buff de grupo) ·
  Overcharge/Discount (recruta e compra mais barato — motor puro de economia)
- **Alquimista:** Homúnculo (unidade extra controlável) · Acid Demonstration
  (dano que ignora defesa) · Potion Pitcher (cura em massa barata) ·
  Marine Sphere/Cultivação (invoca obstáculos descartáveis que bloqueiam salas)
- **Sacerdote:** Full Support (Kyrie/Sanctuary) · Pneuma/Safety Wall (nega tipos
  específicos de dano) · Battle Priest (Turn Undead, resiste sozinho) ·
  Ressurreição/Assumptio (traz de volta um personagem caído)
- **Monge:** Asura Strike (um golpe devastador e o personagem se esgota) ·
  Combo (encadeia ataques) · Steel Body (imune, mas incapaz de atacar) ·
  Snap/Body Relocation (teletransporta-se para qualquer sala)
- **Caçador:** Trapper (Ankle Snare — trava movimento em sala) ·
  Double Strafe (dano puro) · Falcão/Blitz Beat (dano automático passivo) ·
  Detecting/Remove Trap (revela ocultos e desarma armadilhas — o anti-infiltrador)
- **Bardo/Odalisca:** Ensemble (só funciona em par — dois personagens, efeito
  enorme) · Canção de suporte (aura permanente na sala) · Slow Grace/Arrow Vulcan
  (debuff de campo) · Marionette (dobra o poder de um personagem, à custa do próprio)
- **Superaprendiz:** copia a variação de outro personagem · Anjo da Guarda
  (sobrevive a uma morte) · improviso barato de preencher espaço ·
  Sobrecarga (usa a habilidade de *qualquer* classe uma única vez e se esgota)

---

## EQUIPAMENTOS E ITENS

Esta camada é o que transforma um personagem recrutado num personagem *seu*.
Ela também é a razão de existirem Full Strip, Gank, Forja e Endow — sem itens,
essas variações não têm alvo.

### Estruturas a projetar

- **Slots de equipamento por personagem.** Provavelmente arma + armadura +
  acessório, mas você decide o número. Poucos slots mantém o turno rápido;
  muitos slots viram contabilidade. Arbitre e defenda.
- **Cartas de monstro encaixáveis.** No RO, equipamentos tinham slots onde se
  encaixavam cartas de monstro que mudavam a build inteira: Thara Frog
  (resistência a humanos), Raydric (resistência a neutro), Hydra (dano contra
  humanos), Marc (imune a congelamento), Angeling/Ghostring (mudança de elemento).
  **Este é o gancho que faz "cartas" importarem no jogo sem torná-lo um
  deckbuilder** — use-o. Uma carta encaixada é uma decisão permanente e visível.
- **Consumíveis de uso único.** Poções (recupera), Asa de Mosca (reposiciona
  dentro do castelo), Asa de Borboleta (retirada de emergência), Folha/Semente
  de Yggdrasil (reanima), Frasco de Ácido, Pergaminho de invocação.
  Consumíveis são a resposta tática ao imprevisto — e devem ser escassos o
  bastante para doer gastar.
- **Refino (+4 / +7 / +10) com risco de quebra.** Empurrar um equipamento para
  cima é push-your-luck: mais poder, chance de destruir o item. O Ferreiro
  reduz esse risco — é o que dá a ele um papel fora do combate.
- **Origem dos itens.** Decida de onde eles vêm e mantenha *uma* economia, não
  duas: loja/mercado? drop de monstros e guardiões derrotados? forja do
  Ferreiro? recompensa por controlar salas específicas? Provavelmente uma
  combinação — mas gastando o mesmo recurso do recrutamento, para que
  "equipar melhor" versus "recrutar mais" seja uma decisão real toda rodada.
- **Itens são pilháveis.** Se o Arruaceiro rouba e o inimigo perde, o
  equipamento precisa ser um objeto físico que troca de mão. Isso cria alvos:
  atacar o personagem *bem equipado* passa a valer mais que atacar o fraco.

---

## O CASTELO

Salas conectadas formando um caminho do portão externo até a sala do Emperium.
Cada sala tem **personalidade**: uma regra que altera *como o combate e o
movimento funcionam ali*. Exemplos do vocabulário certo (não copie a lista —
projete a sua):

- Corredor estreito: no máximo N personagens combatem por vez → recompensa
  controle de área, pune números brutos
- Pátio aberto: sem limite de participantes → recompensa exército grande
- Ponte/Fosso: quem perde o combate é empurrado para fora do castelo
- Labirinto: entrar custa movimento extra, mas confere ocultação
- Salão dos Guardiões: monstros/guardiões fixos que atacam *qualquer* invasor
- Sala do Emperium: só se ataca aqui se as salas anteriores estiverem sob controle
- Armazém/Depósito: gera recurso ou itens para quem o controla
- Forja: permite refinar equipamento sem voltar ao mercado
- Portal/Teleporte: atalho de mão dupla — quebra a linearidade do cerco

Decida: o castelo é **fixo** (aprendizado profundo, decorável) ou **modular**
(rejogabilidade, mas menos maestria)? Escolha um e defenda a escolha.

---

## REFERÊNCIAS MECÂNICAS — o que extrair de cada

Não copie estruturas; extraia o *princípio* e diga por que ele serve a este jogo.

- **Clank!** — o mercado de cartas compradas com um recurso, combinado com um
  relógio de tensão crescente (o dragão) que pune quem se demora dentro da masmorra.
  Aqui, a pergunta equivalente é: *o que pune o jogador que fica esperando os
  outros gastarem forças no Emperium?*
- **Lost Ruins of Arnak** — market row em camadas: opções baratas cedo, caras
  depois, de modo que "quando comprar" seja tão decisivo quanto "o quê comprar".
- **Dune: Imperium** — alocação de ações + conflito recorrente por rodada, onde
  comprometer força é uma aposta secreta. Diretamente aplicável ao Modo 2.
- **Blood Rage** — morrer é parte do plano; unidades voltam. Resolve o problema
  de "perdi meus personagens e agora não tenho jogo".
- **Kemet** — combate por ataques declarados repetidamente contra os mesmos
  alvos, sem espiral de eliminação.
- **Gloomhaven / Middara** — equipamento como identidade de personagem: o item
  não é +1, é uma mudança de como aquela unidade opera.
- **Root / Chaos in the Old World** — assimetria: cada facção vence de um jeito
  diferente. Use com cuidado: seus clãs são simétricos por padrão, e a assimetria
  deve emergir dos personagens recrutados e equipados, não de poderes fixos de facção.
- **Nemesis / Dead of Winter** — tensão de mesa sem alianças formais.

---

## OS PROBLEMAS DIFÍCEIS (resolva explicitamente — este é o coração do trabalho)

Um design que não enfrenta estes pontos está incompleto. Trate cada um por nome:

1. **O problema do "depois de você".** Se quebrar o Emperium dá a vitória,
   ninguém quer ser o primeiro a gastar forças amolecendo a defesa. A mesa
   trava em espera mútua. Qual mecanismo torna *esperar* ativamente ruim?
2. **O problema do defensor solitário (Modo 3).** Um jogador contra três ou
   quatro: como ele tem agência real e turnos interessantes, em vez de só
   reagir? E como você evita que a mesa simplesmente se coordene contra ele
   (o que, ironicamente, seria uma aliança — proibida por premissa)?
3. **A troca de papel.** Quando um atacante quebra o Emperium no meio da
   partida, ele vira o defensor. O sistema precisa absorver essa inversão sem
   trocar de regras — e o novo dono precisa de tempo suficiente para que valer
   a pena, mas não tanto que a partida acabe ali.
4. **O último golpe.** Quem contribui 90% do dano e não dá o golpe final sente
   que jogou de graça. Como recompensar contribuição parcial sem diluir a
   importância de tomar o castelo?
5. **A divisão de forças (Modo 2).** A tensão de atacar-vs-defender só existe se
   ambas as opções forem realmente atraentes na mesma rodada. Como você garante
   isso, em vez de haver uma resposta ótima dominante?
6. **A gramática de 52 cartas.** 52 personagens não podem ser 52 regras
   memorizadas. Defina um vocabulário fechado de **no máximo ~14 palavras-chave**
   e componha todas as variações a partir dele. Se uma classe precisa de uma
   15ª keyword, ela é especial de propósito — e você diz por quê.
7. **A segunda economia.** Equipamentos e itens correm o risco de virar um jogo
   paralelo que dobra a duração do turno. Como a camada de itens se integra ao
   mesmo recurso e ao mesmo fluxo do recrutamento, em vez de existir ao lado dele?
8. **A personalidade da sala sem sobrecarga.** As salas mudam o jogo, mas o
   jogador não pode precisar memorizar 10 exceções. Como a regra da sala fica
   visível e auto-explicativa no próprio tabuleiro?
9. **O relógio.** O jogo precisa acabar. WoE tinha janela de tempo fixa. Qual é
   o seu limitador, e ele cria tensão crescente ou só corta a partida?
10. **Escala 3/4/5.** O que muda entre as contagens de jogadores? Prefira uma
    alavanca única (tamanho do castelo, duração, força dos guardiões) a três
    tabelas de ajuste.
11. **O personagem rico demais.** Se equipamento se acumula num único
    personagem, ele vira intocável — ou vira um alvo tão óbvio que equipar
    deixa de valer a pena. Onde fica o equilíbrio, e qual regra o sustenta?

---

## PROCESSO — pense nesta ordem

1. **Escolha o motor central primeiro** (deckbuilding? alocação de ações?
   pool de dados? mão fixa com programação de ordens?). Apresente sua escolha
   e **duas alternativas que você rejeitou, com o motivo da rejeição.**
2. **Escreva a estrutura do turno antes de escrever qualquer carta.** Se o turno
   não for interessante com personagens genéricos, cartas bonitas não salvam.
3. **Projete a economia:** quais recursos existem, de onde vêm, no que são
   gastos, e qual é a decisão de trade-off que o jogador enfrenta toda rodada.
   Recrutar, equipar e refinar devem competir pelo mesmo bolso.
4. **Só então** detalhe as 13 classes × 4 variações usando a gramática de keywords.
5. **Depois** o catálogo de equipamentos, cartas de monstro e consumíveis —
   projetado *contra* as variações, para que existam sinergias identificáveis
   (ex.: qual carta transforma o Templário Devotion em problema real?).
6. **Simule mentalmente duas rodadas completas com 4 jogadores no Modo 3**,
   narrando as decisões reais. Onde a simulação ficar chata, volte e conserte.
7. **Ataque seu próprio design:** qual é a estratégia mais provável de ser
   dominante? Qual combinação de duas variações mais um item quebra o jogo?

---

## ENTREGÁVEL

Um documento de design v0.1 **jogável**, com números concretos, contendo:

1. **Pitch** — 3 frases, incluindo a decisão central que define o jogo.
2. **Motor central escolhido** + as duas alternativas rejeitadas e o porquê.
3. **Componentes** — lista completa com quantidades.
4. **Estrutura do turno e da rodada** — passo a passo, sem ambiguidade.
5. **Economia** — recursos, mercado, custos de recrutamento *e* de equipamento,
   ritmo de crescimento.
6. **Sistema de combate** — resolução completa, com um exemplo trabalhado que
   inclua ao menos um equipamento e um consumível em uso.
7. **O castelo** — mapa (em ASCII ou descrição de grafo) e todas as salas com
   sua regra própria.
8. **A gramática de keywords** — máximo ~14, cada uma em uma linha.
9. **As 52 variações** — tabela com custo, atributos, keywords, slots de
   equipamento e a fantasia do build de RO que ela representa.
10. **Catálogo de itens** — equipamentos, cartas de monstro encaixáveis e
    consumíveis, com custo, efeito e a regra de refino.
11. **Os três modos** como deltas sobre o núcleo, cada um com sua condição de
    vitória e ajuste de setup.
12. **Respostas nomeadas aos 11 problemas difíceis** acima.
13. **Riscos conhecidos e alavancas de balanceamento** — o que você mudaria
    primeiro se o playtest quebrasse.
14. **Roteiro de playtest** — 5 perguntas *falseáveis* que a primeira partida
    precisa responder (ex.: "o defensor teve pelo menos uma decisão difícil por
    turno?", não "foi divertido?").
15. **Nota de porte digital** — o que fica melhor no Boardzando e por quê.

---

## ANTI-PADRÕES — não faça isso

- **Não** entregue Clank! com arte de Ragnarok. Se o seu design é um deckbuilder
  genérico com nomes de RO colados por cima, refaça.
- **Não** crie 52 habilidades únicas em texto livre. Componha por keywords.
- **Não** faça equipamento ser só "+1 de ataque". Um item deve mudar uma decisão.
- **Não** deixe o defensor sem decisões próprias no Modo 3.
- **Não** use combate de "role um dado e compare" sem uma camada de decisão real.
- **Não** permita eliminação, nem estados em que um jogador não pode fazer nada
  de significativo.
- **Não** escreva "o valor X deve ser balanceado no playtest" — arbitre um número
  agora e diga qual é a alavanca para ajustá-lo.
- **Não** projete algo que só funciona com upkeep automatizado. Físico primeiro.
- **Não** dependa de alianças formais, negociação vinculante ou trocas — a
  premissa é que ninguém é aliado de ninguém.

Se algo estiver ambíguo, **decida e justifique**. Não devolva perguntas em vez
de design.
