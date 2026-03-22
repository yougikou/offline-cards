import { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

export interface SanGuoShaCard {
  id: string;
  name: 'Kill' | 'Dodge' | 'Peach';
  suit: 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
  rank: string;
  hidden?: boolean;
}

export type Role = 'Lord' | 'Loyalist' | 'Rebel' | 'Renegade';

export interface PlayerState {
  id: string;
  role: Role;
  hp: number;
  maxHp: number;
  dead: boolean;
}

export interface SanGuoShaState {
  players: string[];
  playerStates: Record<string, PlayerState>;
  hands: Record<string, SanGuoShaCard[]>;
  deck: SanGuoShaCard[];
  discardPile: SanGuoShaCard[];
  exitedPlayers: string[];
  gameName: string;

  // Turn state variables
  activeTarget: string | null; // e.g. Who needs to play a Dodge
  pendingCard: SanGuoShaCard | null; // e.g. The Kill card played
  cardsPlayedThisTurn: number; // To limit Kill to 1 per turn
  attackOrigin: string | null; // Who played the Kill

  // Dying State variables
  dyingPlayer: string | null;
  peachResponders: string[];
}

const SUITS: ('Hearts' | 'Diamonds' | 'Clubs' | 'Spades')[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createSanGuoShaDeck(): SanGuoShaCard[] {
  const deck: SanGuoShaCard[] = [];
  let idCounter = 0;

  // 30 Kills, 15 Dodges, 8 Peaches (simplified ratios)
  for (let i = 0; i < 30; i++) {
    deck.push({ id: `sgs-${idCounter++}`, name: 'Kill', suit: SUITS[i % 4], rank: RANKS[i % 13] });
  }
  for (let i = 0; i < 15; i++) {
    deck.push({ id: `sgs-${idCounter++}`, name: 'Dodge', suit: SUITS[i % 4], rank: RANKS[i % 13] });
  }
  for (let i = 0; i < 8; i++) {
    deck.push({ id: `sgs-${idCounter++}`, name: 'Peach', suit: 'Hearts', rank: RANKS[i % 13] });
  }
  return deck;
}

function shuffle(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

function drawCards(G: SanGuoShaState, playerId: string, count: number) {
  for (let i = 0; i < count; i++) {
    if (G.deck.length === 0) {
      if (G.discardPile.length === 0) break;
      G.deck = shuffle([...G.discardPile]);
      G.discardPile = [];
    }
    if (G.deck.length > 0) {
      G.hands[playerId].push(G.deck.pop()!);
    }
  }
}

function processDeath(G: SanGuoShaState, playerId: string, events: any) {
  G.playerStates[playerId].dead = true;
  G.discardPile.push(...G.hands[playerId]);
  G.hands[playerId] = [];

  // Remove equipment and delayed tricks (when implemented)
  checkGameOver(G, events);
}

function checkDeath(G: SanGuoShaState, playerId: string, events: any) {
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
       processDeath(G, playerId, events);
       G.dyingPlayer = null;
       events.endStage();
    }
  } else {
    // Not dying, just end response stage
    G.activeTarget = null;
    G.attackOrigin = null;
    events.endStage();
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
  const dist = Math.min(diff, n - diff);

  // Future: apply mounts (-1 / +1 horses)
  // Let dist = dist + target_+1_horse - self_-1_horse
  return dist;
}

export const SanGuoShaGame = (playerIds: string[]): Game<SanGuoShaState> => ({
  name: 'SanGuoSha',

  setup: (ctx) => {
    let deck = createSanGuoShaDeck();
    deck = shuffle(deck);

    const roles = shuffle(getRoles(playerIds.length));
    const playerStates: Record<string, PlayerState> = {};
    const hands: Record<string, SanGuoShaCard[]> = {};

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

    for (let i = 0; i < orderedPlayerIds.length; i++) {
      const id = orderedPlayerIds[i];
      const role = roles[playerIds.indexOf(id)];
      // Lord gets maxHp + 1
      const isLord = role === 'Lord';
      const baseHp = orderedPlayerIds.length <= 2 ? 4 : (isLord ? 5 : 4);
      const maxHp = isLord && orderedPlayerIds.length > 2 ? baseHp : 4;

      playerStates[id] = {
        id,
        role,
        hp: maxHp,
        maxHp: maxHp,
        dead: false
      };

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
      activeTarget: null,
      pendingCard: null,
      cardsPlayedThisTurn: 0,
      attackOrigin: null,
      dyingPlayer: null,
      peachResponders: []
    };
  },

  phases: {
    play: {
      start: true,
      turn: {
        onBegin: ({ G, ctx, events }) => {
          const currentPlayerId = G.players[parseInt(ctx.currentPlayer)];
          if (G.playerStates[currentPlayerId].dead) {
            events.endTurn();
            return;
          }
          G.cardsPlayedThisTurn = 0;
          G.activeTarget = null;
          G.pendingCard = null;
          G.attackOrigin = null;

          // Draw Phase
          drawCards(G, currentPlayerId, 2);
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
                  events.endStage(); // End dying stage, back to main turn
                } else {
                  // Still dying (e.g. was at -1 HP, played one peach, now at 0, need more peaches)
                  // Keep asking the SAME person if they have more peaches, or they can pass
                }
              },
              passPeach: ({ G, ctx, events, playerID }) => {
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
                  processDeath(G, dyingId, events);
                  G.dyingPlayer = null;
                  G.activeTarget = null;
                  G.attackOrigin = null;
                  events.endStage();
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
              takeDamage: ({ G, ctx, events, playerID }) => {
                const playerId = G.activeTarget!;
                const moverUuid = G.players[parseInt(playerID)];
                if (moverUuid !== playerId) return INVALID_MOVE;

                G.playerStates[playerId].hp -= 1;
                if (G.pendingCard) {
                  G.discardPile.push(G.pendingCard);
                  G.pendingCard = null;
                }

                checkDeath(G, playerId, events);
                // Note: checkDeath will call events.endStage() if not dying, or set new active players if dying.
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
    playKill: ({ G, ctx, events }, { cardIndex, targetId }: { cardIndex: number, targetId: string }) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      if (G.activeTarget !== null) return INVALID_MOVE; // Phase lock
      if (G.cardsPlayedThisTurn >= 1) return INVALID_MOVE;
      if (G.playerStates[targetId].dead) return INVALID_MOVE;
      if (playerId === targetId) return INVALID_MOVE;

      // Check distance for Kill
      const distance = getDistance(G, playerId, targetId);
      if (distance > 1) return INVALID_MOVE;

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
    leaveGame: ({ G, ctx, events }, playerId: string) => {
      if (!G.exitedPlayers.includes(playerId)) {
        G.exitedPlayers.push(playerId);
        if (!G.playerStates[playerId].dead) {
          G.playerStates[playerId].dead = true;
          G.playerStates[playerId].hp = 0;
          G.discardPile.push(...G.hands[playerId]);
          G.hands[playerId] = [];
          checkGameOver(G, events);
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
          safeG.hands[pId] = [...handArray];
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