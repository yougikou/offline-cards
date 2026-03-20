import { Game } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

export interface UnoCard {
  id: string;
  color: 'Red' | 'Blue' | 'Green' | 'Yellow' | 'Black';
  value: string; // '0'-'9', 'Skip', 'Reverse', 'Draw2', 'Wild', 'WildDraw4'
  hidden?: boolean;
}

export interface UnoLiteState {
  players: string[]; // mapping of player indices to specific player IDs
  deck: UnoCard[];
  discardPile: UnoCard[];
  hands: Record<string, UnoCard[]>;
  deckCount: number;
  exitedPlayers: string[];
  direction: 1 | -1;
  chosenColor?: 'Red' | 'Blue' | 'Green' | 'Yellow';
}

const COLORS: ('Red' | 'Blue' | 'Green' | 'Yellow')[] = ['Red', 'Blue', 'Green', 'Yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SPECIAL_VALUES = ['Skip', 'Reverse', 'Draw2'];

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
    for (const special of SPECIAL_VALUES) {
      deck.push({ id: `uno-${idCounter++}`, color, value: special });
      deck.push({ id: `uno-${idCounter++}`, color, value: special });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `uno-${idCounter++}`, color: 'Black', value: 'Wild' });
    deck.push({ id: `uno-${idCounter++}`, color: 'Black', value: 'WildDraw4' });
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

    // In Uno, the first card cannot be a WildDraw4.
    // To keep it simple, if it's a wild card, we'll let the first player choose the color or just default it.
    // Let's draw until we get a non-black card if we want to be strictly correct,
    // but for now let's just draw the top card.
    let firstCard = deck.pop()!;
    while (firstCard.color === 'Black') {
        deck.unshift(firstCard);
        firstCard = deck.pop()!;
    }

    return {
      players: playerIds,
      deck,
      deckCount: deck.length,
      discardPile: [firstCard],
      hands,
      exitedPlayers: [],
      direction: 1,
    };
  },

  turn: {
    order: {
      first: () => 0,
      next: ({ G, ctx }) => {
        const numPlayers = G.players.length;
        // Basic next player logic factoring in direction
        let nextPlayerIndex = (ctx.playOrderPos + G.direction) % numPlayers;
        if (nextPlayerIndex < 0) {
          nextPlayerIndex += numPlayers;
        }
        return nextPlayerIndex;
      },
    }
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

    playCard: ({ G, ctx, events }, payload: any) => {
      // payload can be either a number (cardIndex) or an object { cardIndex, chosenColor }
      let cardIndex = -1;
      let chosenColor: UnoCard['color'] | undefined = undefined;

      if (typeof payload === 'number') {
        cardIndex = payload;
      } else if (payload && typeof payload.cardIndex === 'number') {
        cardIndex = payload.cardIndex;
        chosenColor = payload.chosenColor;
      }

      const playerId = G.players[parseInt(ctx.currentPlayer)];
      const hand = G.hands[playerId];

      if (cardIndex < 0 || cardIndex >= hand.length) {
        return INVALID_MOVE;
      }

      const card = hand[cardIndex];
      const topCard = G.discardPile[G.discardPile.length - 1];

      const effectiveTopColor = G.chosenColor || topCard.color;

      // Card matching logic
      const isWild = card.color === 'Black';
      const matchesColor = card.color === effectiveTopColor;
      const matchesValue = card.value === topCard.value && topCard.color !== 'Black'; // allow 2 skips to match if top isn't wild

      if (!isWild && !matchesColor && !matchesValue) {
        return INVALID_MOVE;
      }

      // If it's wild, a color must be chosen (if not provided, maybe reject or default. We'll reject)
      if (isWild && !chosenColor) {
        return INVALID_MOVE; // Expect UI to provide the chosen color
      }

      // Valid play
      hand.splice(cardIndex, 1);
      G.discardPile.push(card);

      if (isWild) {
        G.chosenColor = chosenColor as 'Red' | 'Blue' | 'Green' | 'Yellow';
      } else {
        G.chosenColor = undefined;
      }

      // Apply special effects
      const numPlayers = G.players.length;
      let nextPlayerIndex = (ctx.playOrderPos + G.direction) % numPlayers;
      if (nextPlayerIndex < 0) nextPlayerIndex += numPlayers;
      let nextPlayerId = G.players[nextPlayerIndex];

      const drawCardsForNextPlayer = (count: number) => {
        for (let i = 0; i < count; i++) {
          if (G.deck.length === 0) {
            if (G.discardPile.length <= 1) break;
            const t = G.discardPile.pop()!;
            G.deck = shuffle([...G.discardPile]);
            G.discardPile = [t];
          }
          if (G.deck.length > 0) {
            G.hands[nextPlayerId].push(G.deck.pop()!);
          }
        }
        G.deckCount = G.deck.length;
      };

      if (card.value === 'Reverse') {
        if (numPlayers === 2) {
          // In 2 player game, reverse acts as a skip
          events.endTurn({ next: ctx.currentPlayer });
          return;
        } else {
          G.direction = (G.direction === 1 ? -1 : 1) as 1 | -1;
        }
      } else if (card.value === 'Skip') {
         // calculate the player *after* the next one to pass turn to
         let skipNextPlayerIndex = (ctx.playOrderPos + (G.direction * 2)) % numPlayers;
         if (skipNextPlayerIndex < 0) skipNextPlayerIndex += numPlayers;
         events.endTurn({ next: skipNextPlayerIndex.toString() });
         return;
      } else if (card.value === 'Draw2') {
         drawCardsForNextPlayer(2);
         // skip next player
         let skipNextPlayerIndex = (ctx.playOrderPos + (G.direction * 2)) % numPlayers;
         if (skipNextPlayerIndex < 0) skipNextPlayerIndex += numPlayers;
         events.endTurn({ next: skipNextPlayerIndex.toString() });
         return;
      } else if (card.value === 'WildDraw4') {
         drawCardsForNextPlayer(4);
         let skipNextPlayerIndex = (ctx.playOrderPos + (G.direction * 2)) % numPlayers;
         if (skipNextPlayerIndex < 0) skipNextPlayerIndex += numPlayers;
         events.endTurn({ next: skipNextPlayerIndex.toString() });
         return;
      }

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

    // Check if any active player's hand is empty
    for (const [playerId, hand] of Object.entries(G.hands)) {
      if (!G.exitedPlayers.includes(playerId) && hand.length === 0) {
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
      hands: {} as Record<string, UnoCard[]>,
      chosenColor: G.chosenColor,
    };

    if (G.hands) {
      for (const [pId, handArray] of Object.entries(G.hands)) {
        if (pId === playerID) {
          safeG.hands[pId] = [...handArray]; // True cards for the player
        } else {
          // Map to card backs for opponents
          safeG.hands[pId] = handArray.map(() => ({
            id: Math.random().toString(),
            color: 'Red' as UnoCard['color'],
            value: '',
            hidden: true
          }));
        }
      }
    }

    return safeG;
  }
});
