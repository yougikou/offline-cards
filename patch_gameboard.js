const fs = require('fs');
const path = 'src/components/GameBoard.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetToReplace = `{selectedCards.length > 0 && (
          <View style={styles.selectedSummaryContainer}>
            {gameName === 'SanGuoSha' && selectedCards.length === 1 && myHand[selectedCards[0]] && (
              <Text style={{ color: '#E0E0E0', fontSize: 12, marginBottom: 5, textAlign: 'center' }}>
                {t('game.sgs_desc_' + myHand[selectedCards[0]].name, { defaultValue: '' })}
              </Text>
            )}
            {[...selectedCards].sort((a, b) => a - b).map(idx => {
              const c = myHand[idx];
              if (!c) return null;
              if (gameName === 'UnoLite') {
                 const cardColor = c.color ? c.color.toLowerCase() : 'gray';
                 return (
                   <View key={\`sel-\${idx}\`} style={[styles.miniCard, { backgroundColor: cardColor }]}>
                     <Text style={[styles.miniCardText, { color: 'white' }]}>{c.value}</Text>
                   </View>
                 );
              } else {
                 const textColor = c.suit === 'Hearts' || c.suit === 'Diamonds' || c.rank === 'Red Joker' ? 'red' : 'black';
                 const suitIcon = c.suit === 'Hearts' ? '♥' : c.suit === 'Diamonds' ? '♦' : c.suit === 'Clubs' ? '♣' : c.suit === 'Spades' ? '♠' : '';
                 return (
                   <View key={\`sel-\${idx}\`} style={[styles.miniCard, { backgroundColor: 'white' }]}>
                     <Text style={[styles.miniCardText, { color: textColor }]}>{c.rank}</Text>
                     {suitIcon ? <Text style={[styles.miniCardSuit, { color: textColor }]}>{suitIcon}</Text> : null}
                   </View>
                 );
              }
            })}
          </View>
        )}`;

code = code.replace(targetToReplace, '');

fs.writeFileSync(path, code);
