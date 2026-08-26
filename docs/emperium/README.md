# Guerra do Emperium

Board game original baseado na War of Emperium do Ragnarok Online (era clássica/transcendente).
Clãs rivais invadem um castelo para quebrar o Emperium no seu coração. Ninguém é aliado de ninguém.

## Estado atual

**v0.1 escrita, ainda não testada na mesa.** Ver [01-design-v0.1.md](01-design-v0.1.md).

O motor central é: recrutamento em tableau + comprometimento simultâneo oculto +
resolução sala a sala. Combate determinístico, sem dados — a incerteza vem do mercado
e de onde os rivais apostaram. Dado só no refino.

## Parâmetros já fechados

| Decisão | Valor |
|---|---|
| Mídia | Híbrido: físico primeiro (print-and-play), porte digital depois |
| Peso / duração | Mid-heavy, 60–90 min (faixa Clank! / Lost Ruins of Arnak) |
| Jogadores | 3–5, otimizado para 4 |
| Personagens | 13 classes × 4 variações = 52 |
| Camadas | Recrutamento (motor central) + equipamentos, cartas de monstro e consumíveis |
| Modos | Assalto Selvagem · Guerra dos Reinos · Cerco — deltas sobre um núcleo único |

## Arquivos

| Arquivo | O que é |
|---|---|
| [**02-design-v0.2.md**](02-design-v0.2.md) | **O design atual.** Marcha Forçada, Transcendência como evolução, Combos e Marcas. |
| [design-v0.2.html](design-v0.2.html) | Apresentação do design v0.2 (publicada como artifact). |
| [tutorial.html](tutorial.html) | Tutorial de aprendizado, para quem vai jogar (publicado como artifact). |
| [01-design-v0.1.md](01-design-v0.1.md) | Registro histórico. Mantém as tabelas completas das 26 bases e das 39 evoluções. |
| [00-prompt-mestre.md](00-prompt-mestre.md) | O briefing que gerou a v0.1. Útil como checklist do que uma versão precisa cobrir. |

## Roadmap

1. ~~**v0.1** — documento de design a partir do prompt mestre.~~ ✅
2. **Playtest físico** — print-and-play, 4 jogadores, Modo 3 primeiro (é o que mais
   provavelmente quebra). O roteiro com as 5 perguntas falseáveis está na seção 19
   da v0.1.
3. **v0.2+** — iteração sobre a tabela de alavancas (seção 18 da v0.1).
4. **Porte para o Boardzando** — plugin em `apps/server/src/games/emperium/` seguindo
   [skills/add-game-plugin/SKILL.md](../../skills/add-game-plugin/SKILL.md). Só depois
   de o design sobreviver à mesa.
