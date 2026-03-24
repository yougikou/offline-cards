import { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

export interface Card {
  id: string;
  suit?: 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
  rank: string;
  value: number; // For comparison
  isJoker?: boolean;
  hidden?: boolean;
}

export interface JiangsuTaopaiState {
  players: string[];
  hands: Record<string, Card[]>;
  currentTrick: {
    cards: Card[];
    pattern: string;
    value: number;
    playerId: string;
  }[];
  lastPlayPlayer: string | null;
  gameName: string;
  exitedPlayers: string[];
  extraPile?: Card[];
  consecutivePasses: number;
}

const SUITS: ('Hearts' | 'Diamonds' | 'Clubs' | 'Spades')[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
// Assign numerical values for simple comparison: 3=3, ..., A=14, 2=15, Small Joker=16, Big Joker=17
const RANK_VALUES: Record<string, number> = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15
};

function createPokerDeck(): Card[] {
  const deck: Card[] = [];
  let idCounter = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `card-${idCounter++}`,
        suit,
        rank,
        value: RANK_VALUES[rank]
      });
    }
  }
  // Add Jokers
  deck.push({ id: `card-${idCounter++}`, rank: 'Black Joker', value: 16, isJoker: true });
  deck.push({ id: `card-${idCounter++}`, rank: 'Red Joker', value: 17, isJoker: true });
  return deck;
}

function shuffle(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper to evaluate hand patterns
export function evaluatePattern(cards: Card[]): { pattern: string; value: number } | null {
  if (!cards || cards.length === 0) return null;
  const len = cards.length;
  const sorted = [...cards].sort((a, b) => a.value - b.value);
  const values = sorted.map(c => c.value);

  // 1. Single
  if (len === 1) return { pattern: 'Single', value: values[0] };

  // 2. Pair
  if (len === 2 && values[0] === values[1]) return { pattern: 'Pair', value: values[0] };

  // 3. Rocket (Wang Zha)
  if (len === 2 && sorted.every(c => c.isJoker)) return { pattern: 'Rocket', value: 999 };

  // 4. Bomb
  if (len === 4 && values[0] === values[1] && values[1] === values[2] && values[2] === values[3]) {
    return { pattern: 'Bomb', value: values[0] };
  }

  // 5. Triple with Pair (3带2)
  if (len === 5) {
    const counts: Record<number, number> = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    const countValues = Object.values(counts);
    if (countValues.length === 2 && countValues.includes(3) && countValues.includes(2)) {
      const tripleValue = Object.keys(counts).find(k => counts[parseInt(k)] === 3);
      return { pattern: 'TriplePair', value: parseInt(tripleValue!) };
    }
  }

  // Helper for Straights
  const isStraightValues = (arr: number[]) => {
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] + 1 !== arr[i + 1]) return false;
    }
    return true;
  };

  // Triple
  if (len === 3 && values[0] === values[1] && values[1] === values[2]) {
    return { pattern: 'Triple', value: values[0] };
  }

  // Consecutive Triples (exactly 6 cards)
  if (len === 6) {
    let isTriples = true;
    const tripleValues: number[] = [];
    for (let i = 0; i < len; i += 3) {
      if (values[i] !== values[i + 1] || values[i + 1] !== values[i + 2]) {
        isTriples = false;
        break;
      }
      tripleValues.push(values[i]);
    }
    if (isTriples) {
      if (isStraightValues(tripleValues)) {
        return { pattern: 'ConsecutiveTriples', value: tripleValues[tripleValues.length - 1] };
      }
    }
  }

  // 6. Straight (5+ cards)
  if (len >= 5) {
    // Check if it's all distinct
    const distinct = new Set(values);
    if (distinct.size === len) {
      // Handle special A and 2 rules (A=14, 2=15)
      // Allowed: A-2-3-4-5 (14,15,3,4,5 -> effectively 1,2,3,4,5) or 10-J-Q-K-A (10,11,12,13,14)
      // We will map values to find if they form a straight

      // Map A->1, 2->2 (if 3,4,5 are present)
      let adjustedValues = [...values];
      if (adjustedValues.includes(14) && adjustedValues.includes(15) && adjustedValues.includes(3)) {
         adjustedValues = adjustedValues.map(v => v === 14 ? 1 : v === 15 ? 2 : v).sort((a,b) => a-b);
      } else if (adjustedValues.includes(14) && adjustedValues.includes(2) === false && adjustedValues.includes(3)) {
          // A-2-3-4-5 without 2 is not 5 length unless it's a longer straight but usually A is just 1.
         adjustedValues = adjustedValues.map(v => v === 14 ? 1 : v).sort((a,b) => a-b);
      }

      if (isStraightValues(adjustedValues)) {
        // value is the highest card in the straight
        return { pattern: 'Straight', value: adjustedValues[adjustedValues.length - 1] };
      }
    }
  }

  // 7. Double Straight (3+ pairs, length >= 6 and even)
  if (len >= 6 && len % 2 === 0) {
    let isPairs = true;
    const pairValues: number[] = [];
    for (let i = 0; i < len; i += 2) {
      if (values[i] !== values[i + 1]) {
        isPairs = false;
        break;
      }
      pairValues.push(values[i]);
    }
    if (isPairs) {
      let adjustedPairs = [...pairValues];
      // special A, 2 rules
      if (adjustedPairs.includes(14) && adjustedPairs.includes(15) && adjustedPairs.includes(3)) {
         adjustedPairs = adjustedPairs.map(v => v === 14 ? 1 : v === 15 ? 2 : v).sort((a,b) => a-b);
      } else if (adjustedPairs.includes(14) && adjustedPairs.includes(2) === false && adjustedPairs.includes(3)) {
         adjustedPairs = adjustedPairs.map(v => v === 14 ? 1 : v).sort((a,b) => a-b);
      }

      if (isStraightValues(adjustedPairs)) {
        return { pattern: 'DoubleStraight', value: adjustedPairs[adjustedPairs.length - 1] };
      }
    }
  }

  return null;
}

export function canPlay(attemptCards: Card[], currentTrick: { cards: Card[]; pattern: string; value: number } | undefined): boolean {
  const attempt = evaluatePattern(attemptCards);
  if (!attempt) return false;

  // If leading
  if (!currentTrick) return true;

  const { pattern: tryPat, value: tryVal } = attempt;
  const { cards: trickCards, pattern: trickPat, value: trickVal } = currentTrick;

  // Rocket beats anything
  if (tryPat === 'Rocket') return true;

  // Bomb beats non-bomb and lower bomb
  if (tryPat === 'Bomb') {
    if (trickPat !== 'Bomb' && trickPat !== 'Rocket') return true;
    if (trickPat === 'Bomb' && tryVal > trickVal) return true;
    return false;
  }

  // Otherwise, strictly match pattern type, length, and beat the value
  if (tryPat !== trickPat) return false;
  if (attemptCards.length !== trickCards.length) return false;
  if (tryVal <= trickVal) return false;

  return true;
}

export const JiangsuTaopaiGame = (playerIds: string[]): Game<JiangsuTaopaiState> => ({
  name: 'JiangsuTaopai',

  setup: (ctx) => {
    let deck = createPokerDeck();
    deck = shuffle(deck);

    const hands: Record<string, Card[]> = {};
    for (const id of playerIds) {
      hands[id] = [];
    }

    const extraPile: Card[] = [];

    // Deal 18 cards per player
    for (const playerId of playerIds) {
      for (let i = 0; i < 18; i++) {
        if (deck.length > 0) {
          hands[playerId].push(deck.pop()!);
        }
      }
    }

    // Remaining cards go to extra pile (applicable for 2-player)
    while (deck.length > 0) {
      extraPile.push(deck.pop()!);
    }

    // Sort hands by value
    for (const id of playerIds) {
      hands[id].sort((a, b) => a.value - b.value);
    }

    // Find the player with the smallest spade
    // First, map each player to their smallest spade
    let startingPlayerIndex = 0;
    let minSpadeValue = Infinity;

    playerIds.forEach((playerId, index) => {
      const spades = hands[playerId].filter(c => c.suit === 'Spades');
      if (spades.length > 0) {
        const minSpadeForPlayer = Math.min(...spades.map(c => c.value));
        if (minSpadeForPlayer < minSpadeValue) {
          minSpadeValue = minSpadeForPlayer;
          startingPlayerIndex = index;
        }
      }
    });

    return {
      players: playerIds,
      hands,
      currentTrick: [],
      lastPlayPlayer: null,
      gameName: 'JiangsuTaopai',
      exitedPlayers: [],
      extraPile,
      consecutivePasses: 0,
    };
  },

  turn: {
    order: {
      first: ({ G, ctx }) => {
        let startingPlayerIndex = 0;
        let minSpadeValue = Infinity;

        G.players.forEach((playerId, index) => {
          const spades = G.hands[playerId].filter(c => c.suit === 'Spades');
          if (spades.length > 0) {
            const minSpadeForPlayer = Math.min(...spades.map(c => c.value));
            if (minSpadeForPlayer < minSpadeValue) {
              minSpadeValue = minSpadeForPlayer;
              startingPlayerIndex = index;
            }
          }
        });

        return startingPlayerIndex;
      },
      next: ({ G, ctx }) => (ctx.playOrderPos + 1) % ctx.numPlayers,
    },
    onBegin: ({ G, ctx }) => {
      const activePlayers = G.players.filter(p => !G.exitedPlayers.includes(p));
      if (G.consecutivePasses >= activePlayers.length - 1 && G.lastPlayPlayer === G.players[ctx.currentPlayer]) {
        // Everyone passed, the trick is won by the last player who played
        G.currentTrick = [];
        G.consecutivePasses = 0;
      }
    }
  },

  moves: {
    playCard: ({ G, ctx, events }, cardIndices: number[]) => {
      if (!cardIndices || cardIndices.length === 0) return INVALID_MOVE;

      const playerId = G.players[ctx.currentPlayer];
      const hand = G.hands[playerId];

      for (const idx of cardIndices) {
        if (idx < 0 || idx >= hand.length) return INVALID_MOVE;
      }

      const uniqueIndices = new Set(cardIndices);
      if (uniqueIndices.size !== cardIndices.length) return INVALID_MOVE;

      const selectedCards = cardIndices.map(idx => hand[idx]);
      const currentTrickTop = G.currentTrick.length > 0 ? G.currentTrick[G.currentTrick.length - 1] : undefined;

      if (!canPlay(selectedCards, currentTrickTop)) {
        return INVALID_MOVE;
      }

      const attempt = evaluatePattern(selectedCards)!;

      // Apply move
      const sortedIndices = [...cardIndices].sort((a, b) => b - a);
      for (const idx of sortedIndices) {
        hand.splice(idx, 1);
      }

      G.currentTrick.push({
        cards: selectedCards,
        pattern: attempt.pattern,
        value: attempt.value,
        playerId
      });

      G.lastPlayPlayer = playerId;
      G.consecutivePasses = 0;

      events.endTurn();
    },

    pass: ({ G, ctx, events }) => {
      if (G.currentTrick.length === 0) {
        return INVALID_MOVE; // Cannot pass if leading
      }

      G.consecutivePasses += 1;
      events.endTurn();
    },

    leaveGame: ({ G, ctx, events }, playerId: string) => {
      if (!G.exitedPlayers.includes(playerId)) {
        G.exitedPlayers.push(playerId);
      }
    }
  },

  endIf: ({ G, ctx }) => {
    const activePlayers = G.players.filter(p => !G.exitedPlayers.includes(p));
    if (activePlayers.length === 1) {
      return { winner: activePlayers[0] };
    }

    for (const [playerId, hand] of Object.entries(G.hands)) {
      if (!G.exitedPlayers.includes(playerId) && hand.length === 0) {
        return { winner: playerId };
      }
    }
  },

  playerView: ({ G, ctx, playerID }) => {
    const safeG = {
      ...G,
      hands: {} as Record<string, Card[]>
    };

    if (G.hands) {
      for (const [pId, handArray] of Object.entries(G.hands)) {
        if (pId === playerID) {
          safeG.hands[pId] = [...handArray];
        } else {
          safeG.hands[pId] = handArray.map((_, index) => ({
            id: `${pId}-hidden-${index}`,
            rank: '',
            value: 0,
            hidden: true
          }));
        }
      }
    }

    if (safeG.extraPile) {
      safeG.extraPile = safeG.extraPile.map((_, index) => ({
        id: `extra-hidden-${index}`,
        rank: '',
        value: 0,
        hidden: true
      }));
    }

    return safeG;
  }
});
