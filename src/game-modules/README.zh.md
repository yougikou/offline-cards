# 游戏模块扩展指南

此目录包含 offline-cards 应用程序的游戏模块。每个游戏模块都是基于 `boardgame.io` 构建的。

## 如何添加新游戏模块

1. **创建新游戏配置文件**：添加一个新的 TypeScript 文件（例如 `MyGame.ts`），并导出一个 `boardgame.io` 的 `Game` 配置对象。
2. **定义游戏状态接口**：您的状态应当包含 `players: string[]` 字段，并通过 `exitedPlayers: string[]` 字段来记录已退出的玩家。
3. **注册游戏**：将您的游戏模块导入并在 `App.tsx` 的 `getGameModule` 结构中进行配置，同时更新 `GameMode` 类型来包含您新添加的游戏名称。

## 玩家断线及退出接口判定

为了处理玩家中途掉线或主动退出的情况，您的游戏模块 **必须** 实现一个 `leaveGame` 移动（move），并在游戏的 `endIf` 生命周期中加入应对退出后的胜负判定机制。

### 实现示例

**1. 状态定义**
确保您游戏的状态跟踪记录中包含了 `exitedPlayers`：
```typescript
export interface MyGameState {
  players: string[];
  exitedPlayers: string[];
  // ...其他状态变量
}
```

**2. 初始化 (Setup)**
在标准构建中初始化 `exitedPlayers`：
```typescript
setup: (ctx) => {
  return {
    players: playerIds,
    exitedPlayers: [],
    // ...其他初始值
  };
}
```

**3. 添加 `leaveGame` 行动**
在 `moves` 对象中实现 `leaveGame` 行动。当由于网络或其他原因导致玩家退出时，主引擎将自动调用此函数：
```typescript
moves: {
  // ...其他行动
  leaveGame: ({ G }, playerId: string) => {
    if (!G.exitedPlayers.includes(playerId)) {
      G.exitedPlayers.push(playerId);
    }
  }
}
```

**4. `endIf` 生命周期钩子（自动胜负判定）**
检查是否仅剩一名活跃玩家。如果只剩一人，即可直接判定该玩家胜出。
```typescript
endIf: ({ G, ctx }) => {
  const activePlayers = G.players.filter(p => !G.exitedPlayers.includes(p));
  
  if (activePlayers.length === 1) {
    return { winner: activePlayers[0] };
  }
  
  // ...其他常规胜负条件
}
```

*注意：请确保您游戏的 `turn` 配置不要对所有的移动强加限制（如全局 `maxMoves: 1`），因为这可能会干扰 `leaveGame` 处理的执行。建议您在常规移动中使用 `events.endTurn()` 显式地结束回合。*
