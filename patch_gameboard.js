const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

// Add import
code = code.replace(
`import { SanGuoShaHeroSelection } from './sanguosha/SanGuoShaHeroSelection';`,
`import { SanGuoShaHeroSelection } from './sanguosha/SanGuoShaHeroSelection';\nimport { getDistance } from '../game-modules/sanguosha';`
);

// Add selectedTargetId state
code = code.replace(
`  // We manage target selection in SanGuoShaControls now`,
`  // SanGuoSha specific state\n  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);`
);

// Add clear target logic when turn ends or selected cards changes
code = code.replace(
`  useEffect(() => {
    // Reset scroll if hand becomes small again`,
`  // Clear target when selection changes or turn ends
  useEffect(() => {
    setSelectedTargetId(null);
  }, [selectedCards, isMyTurn]);

  useEffect(() => {
    // Reset scroll if hand becomes small again`
);

// Calculate targeting mode
code = code.replace(
`  const gameOver = ctx.gameover;`,
`  const gameOver = ctx.gameover;

  const needsTarget = (cardName: string) => {
    return ['Kill', 'GuoHeChaiQiao', 'ShunShouQianYang', 'JueDou', 'JieDaoShaRen', 'LeBuSiShu', 'ShanDian'].includes(cardName);
  };

  let isTargetingMode = false;
  let outOfRangePlayers: Record<string, boolean> = {};

  if (gameName === 'SanGuoSha' && selectedCards.length > 0) {
    const cardIndex = selectedCards[0];
    const card = myHand[cardIndex];
    const myActiveStage = ctx.activePlayers ? ctx.activePlayers[myPlayerIndex || ''] : undefined;
    if (card && needsTarget(card.name) && !myActiveStage) {
      isTargetingMode = true;

      // Calculate ranges
      G.players.forEach((pId: string) => {
        if (pId === myPlayerId && card.name !== 'ShanDian') return;
        const distance = getDistance(G, myPlayerId, pId);
        let outOfRange = false;

        if (card.name === 'Kill' && distance > 1) {
           let attackRange = 1;
           const weapon = G.playerStates?.[myPlayerId]?.equipment?.weapon;
           if (weapon && weapon.distance) {
             attackRange = weapon.distance;
           }
           if (distance > attackRange) {
              outOfRange = true;
           }
        }
        if (card.name === 'ShunShouQianYang' && distance > 1) {
          outOfRange = true;
        }
        if (outOfRange) {
          outOfRangePlayers[pId] = true;
        }
      });
    }
  }`
);

// Add props to SanGuoShaControls
code = code.replace(
`            <SanGuoShaControls
              G={G}
              ctx={ctx}
              myPlayerId={myPlayerId}
              isMyTurn={isMyTurn}
              gameOver={gameOver}
              selectedCards={selectedCards}
              myHand={myHand}
              opponents={opponents}
              onAction={onAction}
              setSelectedCards={setSelectedCards}
            />`,
`            <SanGuoShaControls
              G={G}
              ctx={ctx}
              myPlayerId={myPlayerId}
              isMyTurn={isMyTurn}
              gameOver={gameOver}
              selectedCards={selectedCards}
              myHand={myHand}
              opponents={opponents}
              onAction={onAction}
              setSelectedCards={setSelectedCards}
              isTargetingMode={isTargetingMode}
              selectedTargetId={selectedTargetId}
              setSelectedTargetId={setSelectedTargetId}
            />`
);

fs.writeFileSync('src/components/GameBoard.tsx', code);
console.log('GameBoard patched');
