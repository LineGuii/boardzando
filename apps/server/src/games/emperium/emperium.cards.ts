/**
 * O catalogo de Guerra do Emperium vive em `@boardzando/contracts` porque o
 * frontend precisa dos mesmos numeros para desenhar as cartas — nome, custo,
 * poder e palavras-chave sao dados compartilhados, nao regra de servidor.
 *
 * Este arquivo existe so para manter os imports do plugin curtos e locais.
 */
export {
  ALL_CHARACTERS,
  ALTAR_RODADA,
  CHARACTER_BY_ID,
  CONSUMABLES,
  CONSUMABLE_BY_ID,
  DECK_I,
  EQUIPMENT,
  EQUIP_BY_ID,
  MONSTER_BY_ID,
  MONSTER_CARDS,
  TRANSCENDENCIAS,
  TRANSCENDENCIA_BY_ID,
  buildConsumableDeck,
  buildEquipmentDeck,
  buildMonsterDeck,
  buildRecruitDeck,
  caminhosDaClasse,
} from '@boardzando/contracts';

export type {
  CharacterDef,
  Combo,
  ComboEfeito,
  ComboExige,
  Marca,
  ConsumableDef,
  ConsumableId,
  Deck,
  EquipDef,
  EquipSlotKind,
  Keyword,
  KeywordName,
  MonsterCardDef,
  Papel,
  TranscendenceDef,
} from '@boardzando/contracts';
