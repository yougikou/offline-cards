import { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

export interface Card {
  id: string;
  suit?: 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
  rank: string;
  value: number;
  isJoker?: boolean;
  hidden?: boolean;
}

export interface ZhengShangYouState {
  players: string[];
  hands: Record<string, Card[]>;
  currentTrick: Card[];
  lastPlayPlayer: string | null;
  gameName: string;
  exitedPlayers: string[];
  extraPile?: Card[];
}

const SUITS: ('Hearts' | 'Diamonds' | 'Clubs' | 'Spades')[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
// Assign numerical values for simple comparison: 3=3, ..., A=14, 2=15
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

export const ZhengShangYouGame = (playerIds: string[]): Game<ZhengShangYouState> => ({
  name: 'ZhengShangYou',

  setup: (ctx) => {
    let deck = createPokerDeck();
    deck = shuffle(deck);

    const hands: Record<string, Card[]> = {};
    for (const id of playerIds) {
      hands[id] = [];
    }

    const extraPile: Card[] = [];

    // Deal all cards evenly
    let currentPlayerIndex = 0;
    while (deck.length > 0) {
      const card = deck.pop()!;

      if (playerIds.length === 2) {
        // If 2 players, deal into 3 piles
        const pileIndex = currentPlayerIndex % 3;
        if (pileIndex === 2) {
          extraPile.push(card);
        } else {
          const playerId = playerIds[pileIndex];
          hands[playerId].push(card);
        }
      } else {
        const playerId = playerIds[currentPlayerIndex % playerIds.length];
        hands[playerId].push(card);
      }
      currentPlayerIndex++;
    }

    // Sort hands by value
    for (const id of playerIds) {
      hands[id].sort((a, b) => a.value - b.value);
    }

    return {
      players: playerIds,
      hands,
      currentTrick: [],
      lastPlayPlayer: null,
      gameName: 'ZhengShangYou',
      exitedPlayers: [],
      extraPile
    };
  },

  moves: {
    playCard: ({ G, ctx, events }, cardIndices: number[]) => {
      if (!cardIndices || cardIndices.length === 0) {
        return INVALID_MOVE;
      }

      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const hand = G.hands[playerId];

      // Validate indices
      for (const idx of cardIndices) {
        if (idx < 0 || idx >= hand.length) {
          return INVALID_MOVE;
        }
      }

      // Check if duplicate indices exist
      const uniqueIndices = new Set(cardIndices);
      if (uniqueIndices.size !== cardIndices.length) {
        return INVALID_MOVE;
      }

      // Extract cards
      const selectedCards = cardIndices.map(idx => hand[idx]);
      const maxSelectedValue = Math.max(...selectedCards.map(c => c.value));

      // MVP Rule validation:
      // If there is an active trick, the number of cards must match, and the max value must be greater.
      if (G.currentTrick.length > 0) {
        if (selectedCards.length !== G.currentTrick.length) {
          return INVALID_MOVE;
        }
        const maxTrickValue = Math.max(...G.currentTrick.map(c => c.value));
        if (maxSelectedValue <= maxTrickValue) {
          return INVALID_MOVE;
        }
      }

      // Apply move
      // Remove played cards from hand (iterate in reverse to avoid shifting index issues)
      const sortedIndices = [...cardIndices].sort((a, b) => b - a);
      for (const idx of sortedIndices) {
        hand.splice(idx, 1);
      }

      G.currentTrick = selectedCards;
      G.lastPlayPlayer = playerId;

      events.endTurn();
    },

    pass: ({ G, ctx, events }) => {
      // Cannot pass if leading the trick
      if (G.currentTrick.length === 0) {
        return INVALID_MOVE;
      }
      events.endTurn();
    },

    leaveGame: ({ G, ctx, events }, playerId: string) => {
      if (!G.exitedPlayers.includes(playerId)) {
        G.exitedPlayers.push(playerId);
      }
    }
  },

  turn: {
    onBegin: ({ G, ctx }) => {
      const currentPlayerId = G.players[parseInt(ctx.currentPlayer)];
      // If the current player is the one who played the last valid trick, they win the trick and can lead a new one.
      if (G.lastPlayPlayer === currentPlayerId) {
        G.currentTrick = [];
      }
    }
  },

  endIf: ({ G, ctx }) => {
    const activePlayers = G.players.filter(p => !G.exitedPlayers.includes(p));
    if (activePlayers.length === 1) {
      return { winner: activePlayers[0] };
    }

    // A player wins if they run out of cards
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
          // Send hidden cards for opponents
          safeG.hands[pId] = handArray.map(() => ({
            id: Math.random().toString(),
            rank: '',
            value: 0,
            hidden: true
          }));
        }
      }
    }

    if (safeG.extraPile) {
      safeG.extraPile = safeG.extraPile.map(() => ({
        id: Math.random().toString(),
        rank: '',
        value: 0,
        hidden: true
      }));
    }

    return safeG;
  }
});
