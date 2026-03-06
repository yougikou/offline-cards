import { GameModule, GameState, GameAction } from './types';

interface Card {
  id: string; // Unique ID like 'H-A', 'S-10'
  suit: 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
  rank: string; // '2', '3', ..., 'J', 'Q', 'K', 'A'
}

interface PokerState extends GameState {
  deck: Card[];
  table: Card[];
  players: Record<string, { hand: Card[] }>;
}

const SUITS: ('Hearts' | 'Diamonds' | 'Clubs' | 'Spades')[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit.charAt(0)}-${rank}`,
        suit,
        rank
      });
    }
  }
  // Simple shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const StandardPokerModule: GameModule = {
  name: 'Standard Poker',
  setup: (playerIds: string[]): PokerState => {
    const players: Record<string, { hand: Card[] }> = {};
    for (const id of playerIds) {
      players[id] = { hand: [] };
    }

    return {
      deck: createDeck(),
      table: [],
      players
    };
  },
  reducer: (state: GameState, action: GameAction): GameState => {
    const pokerState = state as PokerState;
    const { player, type } = action;

    if (!pokerState.players[player]) {
      return state; // Invalid player
    }

    switch (type) {
      case 'DRAW_CARD': {
        if (pokerState.deck.length === 0) {
          return state; // Deck is empty
        }

        const newDeck = [...pokerState.deck];
        const drawnCard = newDeck.pop()!;

        const newPlayers = {
          ...pokerState.players,
          [player]: {
            ...pokerState.players[player],
            hand: [...pokerState.players[player].hand, drawnCard]
          }
        };

        return {
          ...pokerState,
          deck: newDeck,
          players: newPlayers
        };
      }
      case 'PLAY_CARD': {
        const cardIdToPlay = action.cardId;
        const playerHand = pokerState.players[player].hand;
        const cardIndex = playerHand.findIndex(c => c.id === cardIdToPlay);

        if (cardIndex === -1) {
          return state; // Card not in hand
        }

        const playedCard = playerHand[cardIndex];
        const newHand = [...playerHand];
        newHand.splice(cardIndex, 1);

        const newPlayers = {
          ...pokerState.players,
          [player]: {
            ...pokerState.players[player],
            hand: newHand
          }
        };

        const newTable = [...pokerState.table, playedCard];

        return {
          ...pokerState,
          table: newTable,
          players: newPlayers
        };
      }
      default:
        return state;
    }
  }
};
