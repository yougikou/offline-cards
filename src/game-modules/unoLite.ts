import { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

export interface UnoCard {
  id: string;
  color: 'Red' | 'Blue' | 'Green' | 'Yellow';
  value: string; // '0'-'9', 'Skip', 'Reverse', 'Draw2'
  hidden?: boolean;
}

export interface UnoLiteState {
  players: string[]; // mapping of player indices to specific player IDs
  deck: UnoCard[];
  discardPile: UnoCard[];
  hands: Record<string, UnoCard[]>;
  deckCount: number;
}

const COLORS: ('Red' | 'Blue' | 'Green' | 'Yellow')[] = ['Red', 'Blue', 'Green', 'Yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function createUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let idCounter = 0;
  for (const color of COLORS) {
    for (const value of VALUES) {
      deck.push({ id: `uno-${idCounter++}`, color, value });
      if (value !== '0') {
        deck.push({ id: `uno-${idCounter++}`, color, value }); // Two of each 1-9
      }
    }
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

export const UnoLiteGame = (playerIds: string[]): Game<UnoLiteState> => ({
  name: 'UnoLite',

  setup: (ctx) => {
    let deck = createUnoDeck();
    deck = shuffle(deck);

    const hands: Record<string, UnoCard[]> = {};
    for (const id of playerIds) {
      hands[id] = [];
      // Deal 7 cards to each player
      for (let i = 0; i < 7; i++) {
        hands[id].push(deck.pop()!);
      }
    }

    const firstCard = deck.pop()!;

    return {
      players: playerIds,
      deck,
      deckCount: deck.length,
      discardPile: [firstCard],
      hands
    };
  },

  moves: {
    drawAndPass: ({ G, ctx, events }) => {
      if (G.deck.length === 0) {
        if (G.discardPile.length <= 1) {
          // Both deck and discard pile (excluding the top card) are empty. This is a rare edge case.
          events.endTurn();
          return;
        }
        // Keep the top card of the discard pile, reshuffle the rest into the deck
        const topCard = G.discardPile.pop()!;
        G.deck = shuffle([...G.discardPile]);
        G.discardPile = [topCard];
      }

      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.deck.pop()!;
      G.deckCount = G.deck.length;
      G.hands[playerId].push(card);

      events.endTurn();
    },

    playCard: ({ G, ctx, events }, cardIndex: number) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const hand = G.hands[playerId];

      if (cardIndex < 0 || cardIndex >= hand.length) {
        return INVALID_MOVE;
      }

      const card = hand[cardIndex];
      const topCard = G.discardPile[G.discardPile.length - 1];

      // Uno Lite logic: match color or value
      if (card.color === topCard.color || card.value === topCard.value) {
        hand.splice(cardIndex, 1);
        G.discardPile.push(card);
        events.endTurn();
      } else {
        return INVALID_MOVE;
      }
    }
  },

  turn: {
    minMoves: 1,
    maxMoves: 1,
  },

  endIf: ({ G, ctx }) => {
    // Check if any player's hand is empty
    for (const [playerId, hand] of Object.entries(G.hands)) {
      if (hand.length === 0) {
        return { winner: playerId };
      }
    }
  },

  playerView: ({ G, ctx, playerID }) => {
    // Sanitize the state for the given playerID
    const safeG = {
      ...G,
      deck: undefined as any, // Hide the actual deck array
      deckCount: G.deck?.length || 0, // Ensure guests know the deck count
      hands: {} as Record<string, UnoCard[]>
    };

    if (G.hands) {
      for (const [pId, handArray] of Object.entries(G.hands)) {
        if (pId === playerID) {
          safeG.hands[pId] = [...handArray]; // True cards for the player
        } else {
          // Map to card backs for opponents
          safeG.hands[pId] = handArray.map(() => ({
            id: Math.random().toString(),
            color: 'Red',
            value: '',
            hidden: true
          }));
        }
      }
    }

    return safeG;
  }
});
