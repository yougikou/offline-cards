import { Game } from 'boardgame.io';

export interface UnoCard {
  id: string;
  color: 'Red' | 'Blue' | 'Green' | 'Yellow';
  value: string; // '0'-'9', 'Skip', 'Reverse', 'Draw2'
}

export interface UnoLiteState {
  players: string[]; // mapping of player indices to specific player IDs
  deck: UnoCard[];
  discardPile: UnoCard[];
  table: UnoCard[];
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
  // Simplified: No action cards for 'Lite' version to keep state transitions simple initially
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
      discardPile: [],
      table: [firstCard],
      hands
    };
  },

  moves: {
    drawCard: ({ G, ctx, events }) => {
      if (G.deck.length === 0) {
        if (G.discardPile.length === 0) {
          // Both deck and discard pile are empty. This is a rare edge case.
          return;
        }
        // Reshuffle discard pile into deck
        G.deck = shuffle([...G.discardPile]);
        G.discardPile = [];
      }

      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const card = G.deck.pop()!;
      G.deckCount = G.deck.length;
      G.hands[playerId].push(card);

      events.endTurn();
    },

    playCard: ({ G, ctx, events }, cardId: string) => {
      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const hand = G.hands[playerId];
      const cardIndex = hand.findIndex(c => c.id === cardId);

      if (cardIndex === -1) return; // Invalid move, card not in hand

      const card = hand[cardIndex];
      const topCard = G.table[G.table.length - 1];

      // Uno Lite logic: match color or value
      if (card.color === topCard.color || card.value === topCard.value) {
        hand.splice(cardIndex, 1);
        G.discardPile.push(topCard);
        G.table.push(card);
        events.endTurn();
      } else {
        // Invalid move
        return;
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
    // Determine the actual player ID string from the boardgame.io playerID (which is a stringified index '0', '1', ...)
    // Wait, the client will see playerID as the boardgame.io index or undefined if spectator.
    // Let's strip secrets based on the actual target player ID string when we broadcast.
    // The playerView hook in boardgame.io receives playerID from the client configuration.

    // We'll actually handle sanitization manually in App.tsx to avoid index matching issues since we use custom string IDs.
    // But if we use boardgame.io's built-in playerView:
    return G;
  }
});
