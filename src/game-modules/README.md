# Game Modules Extension Guide

This directory contains the game modules for the offline-cards application. Each game module is built using `boardgame.io`.

## How to add a new Game Module

1. **Create a new Game Configuration File**: Add a new TypeScript file (e.g., `MyGame.ts`) that exports a `boardgame.io` `Game` configuration.
2. **Define Game State Interface**: Your state should include `players: string[]` and tracking for `exitedPlayers: string[]`.
3. **Register the Game**: Import and add your game module to `App.tsx` inside the `getGameModule` switch statement, and update `GameMode` type to include your game's unique identifier.

## Player Disconnect / Exit Interface

To handle scenarios where players disconnect or explicitly leave midway, your game module MUST implement a `leaveGame` move and handle win/loss evaluation in the game's `endIf` lifecycle block.

### Example Implementation

**1. State Definition**
Ensure your game's state tracking includes `exitedPlayers`:
```typescript
export interface MyGameState {
  players: string[];
  exitedPlayers: string[];
  // ...other state variables
}
```

**2. Setup Function**
Initialize `exitedPlayers` inside standard setup:
```typescript
setup: (ctx) => {
  return {
    players: playerIds,
    exitedPlayers: [],
    // ...other initializations
  };
}
```

**3. `leaveGame` Move**
Implement the `leaveGame` move inside your `moves` object. This move is automatically called by the engine when a player drops out:
```typescript
moves: {
  // ...other moves
  leaveGame: ({ G }, playerId: string) => {
    if (!G.exitedPlayers.includes(playerId)) {
      G.exitedPlayers.push(playerId);
    }
  }
}
```

**4. `endIf` Lifecycle Hook**
Check whether only a single player remains active, and if so, declare them the winner.
```typescript
endIf: ({ G, ctx }) => {
  const activePlayers = G.players.filter(p => !G.exitedPlayers.includes(p));
  
  if (activePlayers.length === 1) {
    return { winner: activePlayers[0] };
  }
  
  // ...other standard win conditions
}
```

*Note: Ensure your game's `turn` configuration does not strictly limit `maxMoves: 1` generally, as it may interfere with the successful execution of `leaveGame` out of turn. Instead, explicitly end turns within regular moves using `events.endTurn()`.*
