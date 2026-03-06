export interface GameAction {
  type: string;
  player: string;
  [key: string]: any;
}

export interface GameState {
  players: Record<string, any>;
  table: any[];
  deck?: any[];
  [key: string]: any;
}

export interface GameModule {
  name: string;
  setup: (playerIds: string[]) => GameState;
  reducer: (state: GameState, action: GameAction) => GameState;
}
