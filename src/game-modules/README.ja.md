# ゲームモジュール拡張ガイド

このディレクトリには、offline-cards アプリケーションのゲームモジュールが含まれています。各ゲームモジュールは `boardgame.io` を使用して構築されています。

## 新しいゲームモジュールの追加方法

1. **新しいゲーム構成ファイルの作成**: TypeScript ファイル (例：`MyGame.ts`) を追加し、`boardgame.io` の `Game` 構成オブジェクトをエクスポートします。
2. **ゲーム状態インターフェースの定義**: 状態（State）には `players: string[]` フィールドを含め、退出したプレイヤーを追跡するために `exitedPlayers: string[]` を追加します。
3. **ゲームの登録**: ゲームモジュールをインポートし、`App.tsx` 内の `getGameModule` スイッチ文に追加します。また、`GameMode` 型を更新して、新しく追加されたゲーム名を含めます。

## プレイヤーの切断・退出判定インターフェース

プレイヤーが途中で切断または明示的に退出した場合を処理するため、ゲームモジュールは `leaveGame` アクション (move) を実装し、ゲームの `endIf` ライフサイクルで退出後の勝敗判定を処理する**必要があります**。

### 実装例

**1. 状態（State）の定義**
ゲームの状態管理に `exitedPlayers` が含まれていることを確認します。
```typescript
export interface MyGameState {
  players: string[];
  exitedPlayers: string[];
  // ...その他の状態変数
}
```

**2. 初期化 (Setup)**
標準の初期化内で `exitedPlayers` を初期化します。
```typescript
setup: (ctx) => {
  return {
    players: playerIds,
    exitedPlayers: [],
    // ...その他の初期化
  };
}
```

**3. `leaveGame` アクションの実装**
`moves` オブジェクト内に `leaveGame` アクションを実装してください。プレイヤーが離脱した際、メインエンジンによって自動的にこの関数が呼び出されます。
```typescript
moves: {
  // ...その他のアクション
  leaveGame: ({ G }, playerId: string) => {
    if (!G.exitedPlayers.includes(playerId)) {
      G.exitedPlayers.push(playerId);
    }
  }
}
```

**4. `endIf` ライフサイクルフック（自動勝敗判定）**
アクティブなプレイヤーが残り1人になっているかどうかを確認します。残りが1人であれば、そのプレイヤーを勝者として判定します。
```typescript
endIf: ({ G, ctx }) => {
  const activePlayers = G.players.filter(p => !G.exitedPlayers.includes(p));
  
  if (activePlayers.length === 1) {
    return { winner: activePlayers[0] };
  }
  
  // ...その他の通常の勝利条件
}
```

*注意: ゲームの `turn` 構成で、すべてのアクションに対して制限（例: グローバルに `maxMoves: 1`）を強制しないようにしてください。これにより、ターン外での `leaveGame` の正常な実行が妨げられる可能性があります。代わりに、通常のアクション内で `events.endTurn()` を使用して明示的にターンを終了することを推奨します。*
