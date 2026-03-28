import { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

export interface SanGuoShaCard {
  id: string;
  name: string;
  suit: 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
  rank: string;
  hidden?: boolean;
  cardType?: 'Basic' | 'Stratagem' | 'DelayedStratagem' | 'Equipment';
  subType?: 'Weapon' | 'Armor' | 'DefensiveHorse' | 'OffensiveHorse';
  distance?: number;
  locked?: boolean;
}

export type Role = 'Lord' | 'Loyalist' | 'Rebel' | 'Renegade';

export interface PlayerState {
  id: string;
  role: Role;
  hp: number;
  maxHp: number;
  dead: boolean;
  hero?: string;
  equipment: {
    weapon: SanGuoShaCard | null;
    armor: SanGuoShaCard | null;
    defensiveHorse: SanGuoShaCard | null;
    offensiveHorse: SanGuoShaCard | null;
  };
  judgments: SanGuoShaCard[];
}

export interface SanGuoShaState {
  players: string[];
  playerStates: Record<string, PlayerState>;
  hands: Record<string, SanGuoShaCard[]>;
  deck: SanGuoShaCard[];
  discardPile: SanGuoShaCard[];
  exitedPlayers: string[];
  gameName: string;
  heroChoices: Record<string, string[]>;

  // Turn state variables
  activeTarget: string | null; // e.g. Who needs to play a Dodge
  pendingCard: SanGuoShaCard | null; // e.g. The Kill card played
  cardsPlayedThisTurn: number; // To limit Kill to 1 per turn
  attackOrigin: string | null; // Who played the Kill

  // Dying State variables
  dyingPlayer: string | null;
  peachResponders: string[];

  // AoE and Duel variables
  targetsQueue: string[];
  currentAoeName: string | null;
  duelTarget: string | null;
}

const SUITS: ('Hearts' | 'Diamonds' | 'Clubs' | 'Spades')[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const STANDARD_HEROES = [
  { id: 'caocao', hp: 4, kingdom: 'Wei' },
  { id: 'simayi', hp: 3, kingdom: 'Wei' },
  { id: 'xiahoudun', hp: 4, kingdom: 'Wei' },
  { id: 'zhangliao', hp: 4, kingdom: 'Wei' },
  { id: 'xuchu', hp: 4, kingdom: 'Wei' },
  { id: 'guojia', hp: 3, kingdom: 'Wei' },
  { id: 'zhenji', hp: 3, kingdom: 'Wei' },
  { id: 'liubei', hp: 4, kingdom: 'Shu' },
  { id: 'guanyu', hp: 4, kingdom: 'Shu' },
  { id: 'zhangfei', hp: 4, kingdom: 'Shu' },
  { id: 'zhugeliang', hp: 3, kingdom: 'Shu' },
  { id: 'zhaoyun', hp: 4, kingdom: 'Shu' },
  { id: 'machao', hp: 4, kingdom: 'Shu' },
  { id: 'huangyueying', hp: 3, kingdom: 'Shu' },
  { id: 'sunquan', hp: 4, kingdom: 'Wu' },
  { id: 'ganning', hp: 4, kingdom: 'Wu' },
  { id: 'lumeng', hp: 4, kingdom: 'Wu' },
  { id: 'huanggai', hp: 4, kingdom: 'Wu' },
  { id: 'zhouyu', hp: 3, kingdom: 'Wu' },
  { id: 'daqiao', hp: 3, kingdom: 'Wu' },
  { id: 'luxun', hp: 3, kingdom: 'Wu' },
  { id: 'sunshangxiang', hp: 3, kingdom: 'Wu' },
  { id: 'huatuo', hp: 3, kingdom: 'Qun' },
  { id: 'lubu', hp: 4, kingdom: 'Qun' },
  { id: 'diaochan', hp: 3, kingdom: 'Qun' }
];

function createSanGuoShaDeck(random?: any): SanGuoShaCard[] {
  const deck: SanGuoShaCard[] = [];
  let idCounter = 0;

  const addCard = (
    name: string,
    suit: 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades',
    rank: string,
    cardType: 'Basic' | 'Stratagem' | 'DelayedStratagem' | 'Equipment',
    subType?: 'Weapon' | 'Armor' | 'DefensiveHorse' | 'OffensiveHorse',
    distance?: number
  ) => {
    deck.push({
      id: `sgs-${idCounter++}`,
      name, suit, rank, cardType, subType, distance
    });
  };

  // 1. Basic Cards
  // Kill (30)
  ['7','8','8','9','9','10','10'].forEach(r => addCard('Kill', 'Spades', r, 'Basic'));
  ['10','10','J'].forEach(r => addCard('Kill', 'Hearts', r, 'Basic'));
  ['2','3','4','5','6','7','8','8','9','9','10','10','J','J'].forEach(r => addCard('Kill', 'Clubs', r, 'Basic'));
  ['6','7','8','9','10','K'].forEach(r => addCard('Kill', 'Diamonds', r, 'Basic'));

  // Dodge (15)
  ['2','2','K'].forEach(r => addCard('Dodge', 'Hearts', r, 'Basic'));
  ['2','2','3','4','5','6','7','8','9','10','J','J'].forEach(r => addCard('Dodge', 'Diamonds', r, 'Basic'));

  // Peach (8)
  ['3','4','6','7','8','9','Q'].forEach(r => addCard('Peach', 'Hearts', r, 'Basic'));
  ['Q'].forEach(r => addCard('Peach', 'Diamonds', r, 'Basic'));

  // 2. Stratagem Cards (Non-delayed)
  // WuZhongShengYou (4)
  ['7','8','9','J'].forEach(r => addCard('WuZhongShengYou', 'Hearts', r, 'Stratagem'));
  // GuoHeChaiQiao (6)
  ['3','4','Q'].forEach(r => addCard('GuoHeChaiQiao', 'Spades', r, 'Stratagem'));
  addCard('GuoHeChaiQiao', 'Hearts', 'Q', 'Stratagem');
  ['3','4'].forEach(r => addCard('GuoHeChaiQiao', 'Clubs', r, 'Stratagem'));
  // ShunShouQianYang (5)
  ['3','4','J'].forEach(r => addCard('ShunShouQianYang', 'Spades', r, 'Stratagem'));
  ['3','4'].forEach(r => addCard('ShunShouQianYang', 'Diamonds', r, 'Stratagem'));
  // JueDou (3)
  addCard('JueDou', 'Spades', 'A', 'Stratagem');
  addCard('JueDou', 'Clubs', 'A', 'Stratagem');
  addCard('JueDou', 'Diamonds', 'A', 'Stratagem');
  // JieDaoShaRen (2)
  ['Q','K'].forEach(r => addCard('JieDaoShaRen', 'Clubs', r, 'Stratagem'));
  // NanManRuQin (3)
  ['7','J'].forEach(r => addCard('NanManRuQin', 'Spades', r, 'Stratagem'));
  addCard('NanManRuQin', 'Clubs', '7', 'Stratagem');
  // WanJianQiFa (1)
  addCard('WanJianQiFa', 'Hearts', 'A', 'Stratagem');
  // WuGuFengDeng (2)
  ['3','4'].forEach(r => addCard('WuGuFengDeng', 'Hearts', r, 'Stratagem'));
  // TaoYuanJieYi (1)
  addCard('TaoYuanJieYi', 'Hearts', 'A', 'Stratagem');
  // WuXieKeJi (4)
  addCard('WuXieKeJi', 'Diamonds', 'Q', 'Stratagem');
  ['Q','K'].forEach(r => addCard('WuXieKeJi', 'Clubs', r, 'Stratagem'));
  addCard('WuXieKeJi', 'Spades', 'J', 'Stratagem');

  // 3. Delayed Stratagems
  // LeBuSiShu (3)
  addCard('LeBuSiShu', 'Hearts', '6', 'DelayedStratagem');
  addCard('LeBuSiShu', 'Spades', '6', 'DelayedStratagem');
  addCard('LeBuSiShu', 'Clubs', '6', 'DelayedStratagem');
  // ShanDian (2)
  addCard('ShanDian', 'Spades', 'A', 'DelayedStratagem');
  addCard('ShanDian', 'Hearts', 'Q', 'DelayedStratagem');

  // 4. Equipment Cards
  // Weapons
  addCard('ZhuGeLianNu', 'Clubs', 'A', 'Equipment', 'Weapon', 1);
  addCard('ZhuGeLianNu', 'Diamonds', 'A', 'Equipment', 'Weapon', 1);
  addCard('CiXiongShuangGuJian', 'Spades', '2', 'Equipment', 'Weapon', 2);
  addCard('QingGangJian', 'Spades', '6', 'Equipment', 'Weapon', 2);
  addCard('QingLongYanYueDao', 'Spades', '5', 'Equipment', 'Weapon', 3);
  addCard('ZhangBaSheMao', 'Spades', 'Q', 'Equipment', 'Weapon', 3);
  addCard('GuanShiFu', 'Diamonds', '5', 'Equipment', 'Weapon', 3);
  addCard('FangTianHuaJi', 'Diamonds', 'Q', 'Equipment', 'Weapon', 4);
  addCard('QiLinGong', 'Hearts', '5', 'Equipment', 'Weapon', 5);

  // Armors
  addCard('BaGuaZhen', 'Spades', '2', 'Equipment', 'Armor');
  addCard('BaGuaZhen', 'Clubs', '2', 'Equipment', 'Armor');

  // Defensive Horses (+1)
  addCard('JueYing', 'Spades', '5', 'Equipment', 'DefensiveHorse');
  addCard('DiLu', 'Clubs', '5', 'Equipment', 'DefensiveHorse');
  addCard('ZhuaHuangFeiDian', 'Hearts', 'K', 'Equipment', 'DefensiveHorse');

  // Offensive Horses (-1)
  addCard('ChiTu', 'Hearts', '5', 'Equipment', 'OffensiveHorse');
  addCard('DaYuan', 'Spades', 'K', 'Equipment', 'OffensiveHorse');
  addCard('ZiXing', 'Diamonds', 'K', 'Equipment', 'OffensiveHorse');

  return deck;
}

function shuffle(array: any[], random?: any) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = random ? (random.Die(i + 1) - 1) : Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getRoles(numPlayers: number): Role[] {
  if (numPlayers === 2) return ['Lord', 'Rebel'];
  if (numPlayers === 3) return ['Lord', 'Rebel', 'Renegade'];
  if (numPlayers === 4) return ['Lord', 'Loyalist', 'Rebel', 'Rebel'];
  if (numPlayers === 5) return ['Lord', 'Loyalist', 'Rebel', 'Rebel', 'Renegade'];
  if (numPlayers === 6) return ['Lord', 'Loyalist', 'Rebel', 'Rebel', 'Rebel', 'Renegade'];
  if (numPlayers === 7) return ['Lord', 'Loyalist', 'Loyalist', 'Rebel', 'Rebel', 'Rebel', 'Renegade'];
  return ['Lord', 'Loyalist', 'Loyalist', 'Rebel', 'Rebel', 'Rebel', 'Rebel', 'Renegade'];
}

function drawCards(G: SanGuoShaState, random: any, playerId: string, count: number) {
  for (let i = 0; i < count; i++) {
    if (G.deck.length === 0) {
      if (G.discardPile.length === 0) break;
      G.deck = shuffle([...G.discardPile], random);
      G.discardPile = [];
    }
    if (G.deck.length > 0) {
      G.hands[playerId].push(G.deck.pop()!);
    }
  }
}

function processDeath(G: SanGuoShaState, playerId: string, events: any, random: any) {
  G.playerStates[playerId].dead = true;
  G.discardPile.push(...G.hands[playerId]);
  G.hands[playerId] = [];

  // Remove equipment
  const equip = G.playerStates[playerId].equipment;
  if (equip.weapon) G.discardPile.push(equip.weapon);
  if (equip.armor) G.discardPile.push(equip.armor);
  if (equip.defensiveHorse) G.discardPile.push(equip.defensiveHorse);
  if (equip.offensiveHorse) G.discardPile.push(equip.offensiveHorse);
  G.playerStates[playerId].equipment = { weapon: null, armor: null, defensiveHorse: null, offensiveHorse: null };

  // Standard Rules: Reward and Punishment
  if (G.attackOrigin && G.players.includes(G.attackOrigin)) {
    const deadRole = G.playerStates[playerId].role;
    const killerRole = G.playerStates[G.attackOrigin]?.role;

    if (deadRole === 'Rebel') {
      // Reward: Anyone killing a Rebel draws 3 cards
      if (random) {
        drawCards(G, random, G.attackOrigin, 3);
      }
    } else if (deadRole === 'Loyalist' && killerRole === 'Lord') {
      // Punishment: Lord killing a Loyalist discards all hand cards and equipment
      G.discardPile.push(...G.hands[G.attackOrigin]);
      G.hands[G.attackOrigin] = [];

      const lordEquip = G.playerStates[G.attackOrigin].equipment;
      if (lordEquip.weapon) G.discardPile.push(lordEquip.weapon);
      if (lordEquip.armor) G.discardPile.push(lordEquip.armor);
      if (lordEquip.defensiveHorse) G.discardPile.push(lordEquip.defensiveHorse);
      if (lordEquip.offensiveHorse) G.discardPile.push(lordEquip.offensiveHorse);
      G.playerStates[G.attackOrigin].equipment = { weapon: null, armor: null, defensiveHorse: null, offensiveHorse: null };
    }
  }

  checkGameOver(G, events);
}

function checkDeath(G: SanGuoShaState, playerId: string, events: any, random: any) {
  if (G.playerStates[playerId].hp <= 0) {
    // Initiate Dying State
    G.dyingPlayer = playerId;

    // Create an array of players to ask for Peach, starting from the current player
    const allAlive = G.players.filter(p => !G.playerStates[p].dead);

    // We want to ask starting from current player.
    // However, if we're not in a turn (e.g. edge case), just start from dying player
    // For simplicity, let's just ask everyone in order starting from dying player
    const dyingIdx = allAlive.indexOf(playerId);
    let responders = [];
    if (dyingIdx !== -1) {
      responders = [...allAlive.slice(dyingIdx), ...allAlive.slice(0, dyingIdx)];
    } else {
      responders = [...allAlive];
    }

    G.peachResponders = responders;

    // Set stage to dying
    if (G.peachResponders.length > 0) {
       const firstResponder = G.peachResponders[0];
       events.setActivePlayers({
          value: {
             [G.players.indexOf(firstResponder).toString()]: 'dying',
          }
       });
    } else {
       // Edge case: no one alive to ask?
      processDeath(G, playerId, events, random);
       G.dyingPlayer = null;
       events.endStage();
    }
  } else {
    // Not dying, just end response stage or move to next AoE target
    if (G.currentAoeName) {
      continueAoeOrEndStage(G, events);
    } else {
      G.activeTarget = null;
      G.attackOrigin = null;
      if (G.pendingCard) {
        G.discardPile.push(G.pendingCard);
        G.pendingCard = null;
      }
      events.endStage();
    }
  }
}

function checkGameOver(G: SanGuoShaState, events: any) {
    const lord = G.players.find(p => G.playerStates[p].role === 'Lord');

    // Condition 1: Lord is dead
    if (!lord || G.playerStates[lord].dead) {
      // Check if Renegade is the ONLY one alive
      const alivePlayers = G.players.filter(p => !G.playerStates[p].dead);
      if (alivePlayers.length === 1 && G.playerStates[alivePlayers[0]].role === 'Renegade') {
        events.endGame({ winner: 'Renegade' });
      } else {
        events.endGame({ winner: 'Rebels' });
      }
      return;
    }

    // Condition 2: All Rebels and Renegades are dead -> Lord wins
    const aliveRebelsOrRenegades = G.players.some(p =>
      !G.playerStates[p].dead &&
      (G.playerStates[p].role === 'Rebel' || G.playerStates[p].role === 'Renegade')
    );
    if (!aliveRebelsOrRenegades) {
      events.endGame({ winner: 'Lord' });
    }
}

export function continueAoeOrEndStage(G: SanGuoShaState, events: any) {
  // Find next alive target
  while (G.targetsQueue.length > 0) {
    const nextTarget = G.targetsQueue.shift()!;
    if (!G.playerStates[nextTarget].dead) {
      G.activeTarget = nextTarget;
      let stageName = 'respond';
      if (G.currentAoeName === 'NanManRuQin') stageName = 'respondToNanMan';
      if (G.currentAoeName === 'WanJianQiFa') stageName = 'respondToWanJian';
      if (G.currentAoeName === 'JueDou') stageName = 'respondToJueDou';

      events.setActivePlayers({
        value: {
          [G.players.indexOf(nextTarget).toString()]: stageName,
        }
      });
      return; // Stop and wait for this player
    }
  }

  // Queue empty or everyone dead
  if (G.pendingCard) {
    G.discardPile.push(G.pendingCard);
    G.pendingCard = null;
  }
  G.activeTarget = null;
  G.attackOrigin = null;
  G.currentAoeName = null;
  G.duelTarget = null;
  events.endStage(); // End stage for the active player, returning to main turn
}

export function getDistance(G: SanGuoShaState, fromId: string, toId: string): number {
  if (fromId === toId) return 0;

  // Only consider alive players
  const alivePlayers = G.players.filter(p => !G.playerStates[p].dead);

  const fromIdx = alivePlayers.indexOf(fromId);
  const toIdx = alivePlayers.indexOf(toId);

  if (fromIdx === -1 || toIdx === -1) return 999; // Dead players distance

  const n = alivePlayers.length;
  // Circular distance
  const diff = Math.abs(fromIdx - toIdx);
  let dist = Math.min(diff, n - diff);

  // Apply mounts (-1 / +1 horses)
  const fromState = G.playerStates[fromId];
  const toState = G.playerStates[toId];

  if (toState.equipment.defensiveHorse) {
    dist += 1;
  }
  if (fromState.equipment.offensiveHorse) {
    dist -= 1;
  }

  // Distance cannot be less than 1
  return Math.max(1, dist);
}

export const SanGuoShaGame = (playerIds: string[]): Game<SanGuoShaState> => ({
  name: 'SanGuoSha',

  setup: ({ ctx, random }) => {
    let deck = createSanGuoShaDeck(random);
    deck = shuffle(deck, random);

    const roles = shuffle(getRoles(playerIds.length), random);
    const playerStates: Record<string, PlayerState> = {};
    const hands: Record<string, SanGuoShaCard[]> = {};
    const heroChoices: Record<string, string[]> = {};

    let lordId = playerIds[0];
    for (let i = 0; i < playerIds.length; i++) {
      if (roles[i] === 'Lord') {
        lordId = playerIds[i];
      }
    }

    // Rearrange playerIds so Lord goes first
    const lordIndex = playerIds.indexOf(lordId);
    const orderedPlayerIds = [
      ...playerIds.slice(lordIndex),
      ...playerIds.slice(0, lordIndex)
    ];

    // Deal heroes
    let availableHeroes = shuffle([...STANDARD_HEROES], random);

    for (let i = 0; i < orderedPlayerIds.length; i++) {
      const id = orderedPlayerIds[i];
      const role = roles[playerIds.indexOf(id)];

      // HP is set later during heroSelection phase
      playerStates[id] = {
        id,
        role,
        hp: 0,
        maxHp: 0,
        dead: false,
        equipment: {
          weapon: null,
          armor: null,
          defensiveHorse: null,
          offensiveHorse: null
        },
        judgments: []
      };

      // Assign 3 random unique hero choices
      heroChoices[id] = [];
      for (let k = 0; k < 3; k++) {
         if (availableHeroes.length > 0) {
            heroChoices[id].push(availableHeroes.pop()!.id);
         }
      }

      hands[id] = [];
      for (let j = 0; j < 4; j++) {
        hands[id].push(deck.pop()!);
      }
    }

    return {
      players: orderedPlayerIds,
      playerStates,
      hands,
      deck,
      discardPile: [],
      exitedPlayers: [],
      gameName: 'SanGuoSha',
      heroChoices,
      activeTarget: null,
      pendingCard: null,
      cardsPlayedThisTurn: 0,
      attackOrigin: null,
      dyingPlayer: null,
      peachResponders: [],
      targetsQueue: [],
      currentAoeName: null,
      duelTarget: null
    };
  },

  phases: {
    heroSelection: {
      start: true,
      moves: {
        selectHero: ({ G, ctx, events }, heroId: string) => {
          const playerId = G.players[parseInt(ctx.currentPlayer)];
          if (G.playerStates[playerId].hero) return INVALID_MOVE; // Already selected

          const choices = G.heroChoices[playerId] || [];
          if (!choices.includes(heroId)) return INVALID_MOVE; // Must be one of the dealt choices

          const heroData = STANDARD_HEROES.find(h => h.id === heroId);
          if (!heroData) return INVALID_MOVE;

          G.playerStates[playerId].hero = heroId;

          // Set HP
          const isLord = G.playerStates[playerId].role === 'Lord';
          // Lord gets maxHp + 1 (if more than 2 players)
          const bonusHp = (isLord && G.players.length > 2) ? 1 : 0;
          const maxHp = heroData.hp + bonusHp;

          G.playerStates[playerId].maxHp = maxHp;
          G.playerStates[playerId].hp = maxHp;

          // Check if all players have selected
          const allSelected = G.players.every(pId => G.playerStates[pId].hero !== undefined);
          if (allSelected) {
            events.endPhase(); // Transitions to the next phase (which is 'play')
          } else {
            events.endTurn(); // Next player's turn to select
          }
        }
      },
      next: 'play',
    },
    play: {
      turn: {
        order: {
          first: ({ G }) => {
            // Lord always goes first. Ordered players array has Lord at index 0.
            return 0;
          },
          next: ({ ctx }) => (parseInt(ctx.currentPlayer) + 1) % ctx.numPlayers,
        },
        onBegin: ({ G, ctx, events, random }) => {
          const currentPlayerId = G.players[parseInt(ctx.currentPlayer)];
          if (G.playerStates[currentPlayerId].dead) {
            events.endTurn();
            return;
          }
          G.cardsPlayedThisTurn = 0;
          G.activeTarget = null;
          G.pendingCard = null;
          G.attackOrigin = null;

          // Judgment Phase (MVP)
          const judgments = [...G.playerStates[currentPlayerId].judgments];
          let skipPlayPhase = false;

          while (judgments.length > 0) {
            const jCard = judgments.pop()!; // Resolve last added first
            // Draw a judgment card
            let judgmentCard: SanGuoShaCard | undefined;
            if (G.deck.length > 0) {
              judgmentCard = G.deck.pop();
            } else if (G.discardPile.length > 0) {
              G.deck = shuffle([...G.discardPile], random);
              G.discardPile = [];
              judgmentCard = G.deck.pop();
            }

            if (judgmentCard) {
              G.discardPile.push(judgmentCard);
              G.discardPile.push(jCard); // discard the delayed stratagem itself
              G.playerStates[currentPlayerId].judgments = G.playerStates[currentPlayerId].judgments.filter(c => c.id !== jCard.id);

              if (jCard.name === 'LeBuSiShu') {
                if (judgmentCard.suit !== 'Hearts') {
                  skipPlayPhase = true;
                }
              } else if (jCard.name === 'ShanDian') {
                if (judgmentCard.suit === 'Spades' && parseInt(judgmentCard.rank) >= 2 && parseInt(judgmentCard.rank) <= 9) {
                  // Take 3 damage
                  G.playerStates[currentPlayerId].hp -= 3;
                  checkDeath(G, currentPlayerId, events, random);
                  // If dead, drawing cards etc will just skip or end turn
                } else {
                  // Pass to next alive player
                  const alivePlayers = G.players.filter(p => !G.playerStates[p].dead);
                  const myIdx = alivePlayers.indexOf(currentPlayerId);
                  if (myIdx !== -1 && alivePlayers.length > 1) {
                    const nextId = alivePlayers[(myIdx + 1) % alivePlayers.length];
                    G.playerStates[nextId].judgments.push(jCard);
                    G.discardPile.pop(); // Take it back out of discard pile
                  }
                }
              }
            }
          }

          // Draw Phase
          if (!G.playerStates[currentPlayerId].dead) {
             drawCards(G, random, currentPlayerId, 2);
             if (skipPlayPhase) {
               events.setActivePlayers({ currentPlayer: 'discard' });
             }
          }
        },
        stages: {
          dying: {
            moves: {
              playPeachOnDying: ({ G, ctx, events, playerID }, cardIndex: number) => {
                const dyingId = G.dyingPlayer;
                if (!dyingId) return INVALID_MOVE;

                // Active player must be the one responding
                const currentResponder = G.peachResponders[0];
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== currentResponder) return INVALID_MOVE;

                const card = G.hands[currentResponder][cardIndex];
                if (!card || card.name !== 'Peach') return INVALID_MOVE;

                // Discard Peach
                G.hands[currentResponder].splice(cardIndex, 1);
                G.discardPile.push(card);

                // Heal target
                G.playerStates[dyingId].hp += 1;

                if (G.playerStates[dyingId].hp > 0) {
                  // Saved!
                  G.dyingPlayer = null;
                  G.peachResponders = [];
                  G.activeTarget = null;
                  G.attackOrigin = null;
                  if (G.currentAoeName) {
                    continueAoeOrEndStage(G, events);
                  } else {
                    if (G.pendingCard) {
                      G.discardPile.push(G.pendingCard);
                      G.pendingCard = null;
                    }
                    events.endStage(); // End dying stage, back to main turn
                  }
                } else {
                  // Still dying (e.g. was at -1 HP, played one peach, now at 0, need more peaches)
                  // Keep asking the SAME person if they have more peaches, or they can pass
                }
              },
              passPeach: ({ G, ctx, events, playerID, random }) => {
                const dyingId = G.dyingPlayer;
                if (!dyingId) return INVALID_MOVE;

                const currentResponder = G.peachResponders[0];
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== currentResponder) return INVALID_MOVE;

                // Move to next responder
                G.peachResponders.shift();

                if (G.peachResponders.length > 0) {
                  const nextResponder = G.peachResponders[0];
                  events.setActivePlayers({
                    value: {
                      [G.players.indexOf(nextResponder).toString()]: 'dying',
                    }
                  });
                } else {
                  // Nobody saved them
                  processDeath(G, dyingId, events, random);
                  G.dyingPlayer = null;
                  G.activeTarget = null;
                  G.attackOrigin = null;
                  if (G.currentAoeName) {
                    continueAoeOrEndStage(G, events);
                  } else {
                    if (G.pendingCard) {
                      G.discardPile.push(G.pendingCard);
                      G.pendingCard = null;
                    }
                    events.endStage();
                  }
                }
              }
            }
          },
          respond: {
            moves: {
              playDodge: ({ G, ctx, events, playerID }, cardIndex: number) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                const card = G.hands[playerId][cardIndex];
                if (!card || card.name !== 'Dodge') return INVALID_MOVE;

                G.hands[playerId].splice(cardIndex, 1);
                G.discardPile.push(card);

                // Dodge successful
                if (G.pendingCard) {
                  G.discardPile.push(G.pendingCard);
                  G.pendingCard = null;
                }
                G.activeTarget = null;
                G.attackOrigin = null;
                events.endStage(); // Return to attacker's play phase
              },
              takeDamage: ({ G, ctx, events, playerID, random }) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                G.playerStates[playerId].hp -= 1;

                // Do not discard pending card here yet if it's an AoE
                checkDeath(G, playerId, events, random);
                // Note: checkDeath will call events.endStage() or continueAoeOrEndStage() if not dying
              }
            }
          },
          respondToNanMan: {
            moves: {
              playKillForNanMan: ({ G, ctx, events, playerID }, cardIndex: number) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                const card = G.hands[playerId][cardIndex];
                if (!card || card.name !== 'Kill') return INVALID_MOVE;

                G.hands[playerId].splice(cardIndex, 1);
                G.discardPile.push(card);

                continueAoeOrEndStage(G, events);
              },
              takeDamageForNanMan: ({ G, ctx, events, playerID, random }) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                G.playerStates[playerId].hp -= 1;
                checkDeath(G, playerId, events, random);
              }
            }
          },
          respondToWanJian: {
            moves: {
              playDodgeForWanJian: ({ G, ctx, events, playerID }, cardIndex: number) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                const card = G.hands[playerId][cardIndex];
                if (!card || card.name !== 'Dodge') return INVALID_MOVE;

                G.hands[playerId].splice(cardIndex, 1);
                G.discardPile.push(card);

                continueAoeOrEndStage(G, events);
              },
              takeDamageForWanJian: ({ G, ctx, events, playerID, random }) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                G.playerStates[playerId].hp -= 1;
                checkDeath(G, playerId, events, random);
              }
            }
          },
          respondToJueDou: {
            moves: {
              playKillForJueDou: ({ G, ctx, events, playerID }, cardIndex: number) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                const card = G.hands[playerId][cardIndex];
                if (!card || card.name !== 'Kill') return INVALID_MOVE;

                G.hands[playerId].splice(cardIndex, 1);
                G.discardPile.push(card);

                // In JueDou, if they play a Kill, the other person now has to respond
                const nextTarget = playerId === G.attackOrigin ? G.duelTarget : G.attackOrigin;

                if (!nextTarget) return INVALID_MOVE;

                // We clear the queue and push the new target so continueAoeOrEndStage handles it
                G.targetsQueue = [nextTarget];

                continueAoeOrEndStage(G, events);
              },
              takeDamageForJueDou: ({ G, ctx, events, playerID, random }) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                G.playerStates[playerId].hp -= 1;

                // JueDou is over when someone takes damage
                G.targetsQueue = [];
                checkDeath(G, playerId, events, random);
              }
            }
          },
          discard: {
            moves: {
              discardCards: ({ G, ctx, events }, cardIndices: number[]) => {
                const playerId = G.players[parseInt(ctx.currentPlayer)];
                const currentHp = G.playerStates[playerId].hp;
                const handSize = G.hands[playerId].length;
                const excess = handSize - currentHp;

                if (excess <= 0) {
                  events.endTurn();
                  return;
                }

                if (cardIndices.length !== excess) return INVALID_MOVE;

                // Validate and discard
                const sortedIndices = [...cardIndices].sort((a, b) => b - a);
                for (const idx of sortedIndices) {
                  if (idx < 0 || idx >= G.hands[playerId].length) return INVALID_MOVE;
                  const card = G.hands[playerId].splice(idx, 1)[0];
                  G.discardPile.push(card);
                }

                events.endTurn();
              }
            }
          }
        }
      }
    }
  },

  moves: {
    equipCard: ({ G, ctx }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.hands[playerId][cardIndex];
      if (!card || card.cardType !== 'Equipment') return INVALID_MOVE;

      const playerState = G.playerStates[playerId];

      let oldEquip: SanGuoShaCard | null = null;
      if (card.subType === 'Weapon') {
        oldEquip = playerState.equipment.weapon;
        playerState.equipment.weapon = card;
      } else if (card.subType === 'Armor') {
        oldEquip = playerState.equipment.armor;
        playerState.equipment.armor = card;
      } else if (card.subType === 'DefensiveHorse') {
        oldEquip = playerState.equipment.defensiveHorse;
        playerState.equipment.defensiveHorse = card;
      } else if (card.subType === 'OffensiveHorse') {
        oldEquip = playerState.equipment.offensiveHorse;
        playerState.equipment.offensiveHorse = card;
      } else {
        return INVALID_MOVE;
      }

      G.hands[playerId].splice(cardIndex, 1);
      if (oldEquip) {
        G.discardPile.push(oldEquip);
      }
    },
    playKill: ({ G, ctx, events }, { cardIndex, targetId }: { cardIndex: number, targetId: string }) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      if (G.activeTarget !== null) return INVALID_MOVE; // Phase lock
      const playerState = G.playerStates[playerId];

      const hasZhuGeLianNu = playerState.equipment.weapon?.name === 'ZhuGeLianNu';
      if (!hasZhuGeLianNu && G.cardsPlayedThisTurn >= 1) return INVALID_MOVE;

      if (G.playerStates[targetId].dead) return INVALID_MOVE;
      if (playerId === targetId) return INVALID_MOVE;

      // Check distance for Kill
      const distance = getDistance(G, playerId, targetId);
      let attackRange = 1;
      if (playerState.equipment.weapon && playerState.equipment.weapon.distance) {
        attackRange = playerState.equipment.weapon.distance;
      }

      if (distance > attackRange) return INVALID_MOVE;

      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'Kill') return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.pendingCard = card;
      G.cardsPlayedThisTurn += 1;
      G.activeTarget = targetId;
      G.attackOrigin = playerId;

      // Force target to respond
      events.setActivePlayers({
        value: {
          [G.players.indexOf(targetId).toString()]: 'respond',
        }
      });
    },
    playPeach: ({ G, ctx }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const playerState = G.playerStates[playerId];

      if (playerState.hp >= playerState.maxHp) return INVALID_MOVE;

      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'Peach') return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.discardPile.push(card);

      playerState.hp += 1;
    },
    playWuZhongShengYou: ({ G, ctx, random }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'WuZhongShengYou') return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.discardPile.push(card);

      drawCards(G, random, playerId, 2);
    },
    playTaoYuanJieYi: ({ G, ctx }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'TaoYuanJieYi') return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.discardPile.push(card);

      G.players.forEach(pId => {
        const state = G.playerStates[pId];
        if (!state.dead && state.hp < state.maxHp) {
          state.hp += 1;
        }
      });
    },
    playDelayStratagem: ({ G, ctx }, { cardIndex, targetId }: { cardIndex: number, targetId: string }) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      if (G.playerStates[targetId].dead) return INVALID_MOVE;

      const card = G.hands[playerId][cardIndex];
      if (!card || card.cardType !== 'DelayedStratagem') return INVALID_MOVE;

      // Cannot place duplicate delayed stratagems of the same name
      if (G.playerStates[targetId].judgments.some(j => j.name === card.name)) return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.playerStates[targetId].judgments.push(card);
    },
    // Implementations for MVP stratagems
    playWuGuFengDeng: ({ G, ctx, random }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'WuGuFengDeng') return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.discardPile.push(card);

      // MVP implementation: simply draw 1 card for every alive player in order
      const currentPlayerIdx = G.players.indexOf(playerId);
      const alivePlayers = G.players.filter(p => !G.playerStates[p].dead);
      const myAliveIdx = alivePlayers.indexOf(playerId);

      for (let i = 0; i < alivePlayers.length; i++) {
        const targetId = alivePlayers[(myAliveIdx + i) % alivePlayers.length];
        drawCards(G, random, targetId, 1);
      }
    },
    playWuXieKeJi: ({ G, ctx }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'WuXieKeJi') return INVALID_MOVE;
      // MVP Stub
      G.hands[playerId].splice(cardIndex, 1);
      G.discardPile.push(card);
    },
    playJieDaoShaRen: ({ G, ctx }, { cardIndex, targetId }: { cardIndex: number, targetId: string }) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'JieDaoShaRen') return INVALID_MOVE;
      // MVP Stub
      G.hands[playerId].splice(cardIndex, 1);
      G.discardPile.push(card);
    },
    playGuoHeChaiQiao: ({ G, ctx, random }, { cardIndex, targetId }: { cardIndex: number, targetId: string }) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      if (G.playerStates[targetId].dead || playerId === targetId) return INVALID_MOVE;

      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'GuoHeChaiQiao') return INVALID_MOVE;

      // Ensure target has cards
      const targetHand = G.hands[targetId];
      if (targetHand.length === 0) return INVALID_MOVE; // Simplified MVP: only targets hand

      // Discard our card
      G.hands[playerId].splice(cardIndex, 1);
      G.discardPile.push(card);

      // Randomly discard from target using deterministic random
      const randomIndex = (random!.Die(targetHand.length) - 1);
      const discardedCard = targetHand.splice(randomIndex, 1)[0];
      G.discardPile.push(discardedCard);
    },
    playShunShouQianYang: ({ G, ctx, random }, { cardIndex, targetId }: { cardIndex: number, targetId: string }) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      if (G.playerStates[targetId].dead || playerId === targetId) return INVALID_MOVE;
      if (getDistance(G, playerId, targetId) > 1) return INVALID_MOVE;

      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'ShunShouQianYang') return INVALID_MOVE;

      // Ensure target has cards
      const targetHand = G.hands[targetId];
      if (targetHand.length === 0) return INVALID_MOVE; // Simplified MVP: only targets hand

      // Discard our card
      G.hands[playerId].splice(cardIndex, 1);
      G.discardPile.push(card);

      // Randomly steal from target using deterministic random
      const randomIndex = (random!.Die(targetHand.length) - 1);
      const stolenCard = targetHand.splice(randomIndex, 1)[0];
      G.hands[playerId].push(stolenCard);
    },
    playNanManRuQin: ({ G, ctx, events }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'NanManRuQin') return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.pendingCard = card;
      G.attackOrigin = playerId;
      G.currentAoeName = 'NanManRuQin';

      // Start targeting from next player
      const currentPlayerIdx = G.players.indexOf(playerId);
      const alivePlayers = G.players.filter(p => !G.playerStates[p].dead);
      const myAliveIdx = alivePlayers.indexOf(playerId);

      const targets = [];
      for (let i = 1; i < alivePlayers.length; i++) {
        targets.push(alivePlayers[(myAliveIdx + i) % alivePlayers.length]);
      }
      G.targetsQueue = targets;

      continueAoeOrEndStage(G, events);
    },
    playWanJianQiFa: ({ G, ctx, events }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'WanJianQiFa') return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.pendingCard = card;
      G.attackOrigin = playerId;
      G.currentAoeName = 'WanJianQiFa';

      const alivePlayers = G.players.filter(p => !G.playerStates[p].dead);
      const myAliveIdx = alivePlayers.indexOf(playerId);

      const targets = [];
      for (let i = 1; i < alivePlayers.length; i++) {
        targets.push(alivePlayers[(myAliveIdx + i) % alivePlayers.length]);
      }
      G.targetsQueue = targets;

      continueAoeOrEndStage(G, events);
    },
    playJueDou: ({ G, ctx, events }, { cardIndex, targetId }: { cardIndex: number, targetId: string }) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      if (G.playerStates[targetId].dead || playerId === targetId) return INVALID_MOVE;

      const card = G.hands[playerId][cardIndex];
      if (!card || card.name !== 'JueDou') return INVALID_MOVE;

      G.hands[playerId].splice(cardIndex, 1);
      G.pendingCard = card;
      G.attackOrigin = playerId;
      G.currentAoeName = 'JueDou';

      // Store who the duel is directed towards right now
      G.duelTarget = targetId;

      // Queue is just the target initially. They need to respond.
      // If they play Kill, they will push the attacker to the queue.
      G.targetsQueue = [targetId];

      continueAoeOrEndStage(G, events);
    },
    endPlayPhase: ({ G, ctx, events }) => {
      if (G.activeTarget !== null) return INVALID_MOVE; // Phase lock
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const currentHp = G.playerStates[playerId].hp;
      const handSize = G.hands[playerId].length;

      if (handSize > currentHp) {
        events.setActivePlayers({ currentPlayer: 'discard' });
      } else {
        events.endTurn();
      }
    },
    leaveGame: ({ G, ctx, events, random }, playerId: string) => {
      if (!G.exitedPlayers.includes(playerId)) {
        G.exitedPlayers.push(playerId);
        if (!G.playerStates[playerId].dead) {
          G.playerStates[playerId].hp = 0;
          processDeath(G, playerId, events, random); // Need random here too if they die and give rewards
        }
      }
    }
  },

  endIf: ({ G, ctx }) => {
    // Also handled dynamically in checkGameOver
    const lord = G.players.find(p => G.playerStates[p].role === 'Lord');
    if (!lord || G.playerStates[lord].dead) {
      const alivePlayers = G.players.filter(p => !G.playerStates[p].dead);
      if (alivePlayers.length === 1 && G.playerStates[alivePlayers[0]].role === 'Renegade') {
        return { winner: 'Renegade' };
      } else {
        return { winner: 'Rebels' };
      }
    }
    const aliveRebelsOrRenegades = G.players.some(p =>
      !G.playerStates[p].dead &&
      (G.playerStates[p].role === 'Rebel' || G.playerStates[p].role === 'Renegade')
    );
    if (!aliveRebelsOrRenegades) {
      return { winner: 'Lord' };
    }
  },

  playerView: ({ G, ctx, playerID }) => {
    const safeG = {
      ...G,
      deck: undefined as any,
      hands: {} as Record<string, SanGuoShaCard[]>,
      playerStates: JSON.parse(JSON.stringify(G.playerStates)) as Record<string, PlayerState>
    };

    if (G.hands) {
      for (const [pId, handArray] of Object.entries(G.hands)) {
        if (pId === playerID) {
          // If the player is the turn player, and there's no active stage, lock Kill if limit reached
          let isActiveStage = false;
          let playerIndex = G.players.indexOf(playerID).toString();
          if (ctx.activePlayers && ctx.activePlayers[playerIndex]) {
            isActiveStage = true;
          }

          const playerState = G.playerStates[pId];
          const hasZhuGeLianNu = playerState?.equipment?.weapon?.name === 'ZhuGeLianNu';

          safeG.hands[pId] = handArray.map(c => {
            if (!isActiveStage && c.name === 'Kill' && G.cardsPlayedThisTurn >= 1 && !hasZhuGeLianNu) {
              return { ...c, locked: true };
            }
            return c;
          });
        } else {
          safeG.hands[pId] = handArray.map(() => ({
            id: Math.random().toString(),
            name: 'Kill', // dummy
            suit: 'Hearts', // dummy
            rank: '',
            hidden: true
          }));
        }
      }
    }

    // Hide roles unless Lord or dead or self
    if (safeG.playerStates) {
      for (const [pId, pState] of Object.entries(safeG.playerStates)) {
        if (pId !== playerID && pState.role !== 'Lord' && !pState.dead) {
          (pState as any).role = 'Unknown';
        }
      }
    }

    return safeG;
  }
});