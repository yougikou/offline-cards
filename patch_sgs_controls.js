const fs = require('fs');
let code = fs.readFileSync('src/components/sanguosha/SanGuoShaControls.tsx', 'utf8');

code = code.replace(
`interface SanGuoShaControlsProps {
  G: any;
  ctx: any;
  myPlayerId: string;
  isMyTurn: boolean;
  gameOver: boolean;
  selectedCards: number[];
  myHand: any[];
  opponents: string[];
  onAction: (action: string, args?: any) => void;
  setSelectedCards: (cards: number[]) => void;
}`,
`interface SanGuoShaControlsProps {
  G: any;
  ctx: any;
  myPlayerId: string;
  isMyTurn: boolean;
  gameOver: boolean;
  selectedCards: number[];
  myHand: any[];
  opponents: string[];
  onAction: (action: string, args?: any) => void;
  setSelectedCards: (cards: number[]) => void;
  isTargetingMode: boolean;
  selectedTargetId: string | null;
  setSelectedTargetId: (id: string | null) => void;
}`
);

code = code.replace(
`}) => {
  const { t } = useTranslation();
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Clear target when selection changes or turn ends
  useEffect(() => {
    setSelectedTargetId(null);
  }, [selectedCards, isMyTurn]);

  const myPlayerIndex = (G.players || []).indexOf(myPlayerId).toString();
  const myActiveStage = ctx.activePlayers ? ctx.activePlayers[myPlayerIndex] : undefined;

  // Determine if we are in targeting mode
  const needsTarget = (cardName: string) => {
    return ['Kill', 'GuoHeChaiQiao', 'ShunShouQianYang', 'JueDou', 'JieDaoShaRen', 'LeBuSiShu', 'ShanDian'].includes(cardName);
  };

  let isTargetingMode = false;
  if (selectedCards.length > 0) {
    const cardIndex = selectedCards[0];
    const card = myHand[cardIndex];
    if (card && needsTarget(card.name) && !myActiveStage) {
      isTargetingMode = true;
    }
  }`,
`  isTargetingMode,
  selectedTargetId,
  setSelectedTargetId
}) => {
  const { t } = useTranslation();

  const myPlayerIndex = (G.players || []).indexOf(myPlayerId).toString();
  const myActiveStage = ctx.activePlayers ? ctx.activePlayers[myPlayerIndex] : undefined;`
);

// Remove the targetSelectionContainer
let startIdx = code.indexOf(`{isTargetingMode && (`);
let endIdx = code.indexOf(`{isWaitingForResponse && !myActiveStage && (`);
if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + code.substring(endIdx);
}

fs.writeFileSync('src/components/sanguosha/SanGuoShaControls.tsx', code);
console.log('Done');
