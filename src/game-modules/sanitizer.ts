import { GameState } from './types';

/**
 * A pure function that removes secret information from the global state
 * before it is sent to a specific player.
 */
export function sanitizeStateForPlayer(globalState: GameState, targetPlayerId: string): GameState {
  // Deep clone to avoid mutating the original state
  const sanitizedState: GameState = JSON.parse(JSON.stringify(globalState));

  // 1. Sanitize the deck
  if (Array.isArray(sanitizedState.deck)) {
    sanitizedState.deckCount = sanitizedState.deck.length;
    // We could either remove deck or replace it with nulls.
    // The prompt says: "将其替换为一个整数 deckCount ... 或者将数组里的元素全部替换为 null"
    // Let's remove the deck array to be completely safe, or set to an empty array
    // Wait, the GameState type has `deck?: any[]`.
    // I'll replace it with an empty array or delete it, and add deckCount.
    delete sanitizedState.deck;
  }

  // 2. Sanitize opponent hands
  if (sanitizedState.players) {
    for (const playerId in sanitizedState.players) {
      if (playerId !== targetPlayerId) {
        // This is an opponent. Hide their hand.
        const hand = sanitizedState.players[playerId].hand;
        if (Array.isArray(hand)) {
          // Replace with nulls to keep the count, but hide the data
          sanitizedState.players[playerId].hand = new Array(hand.length).fill(null);
        }
      }
    }
  }

  // 3. Table is public, keep it as is.

  return sanitizedState;
}
