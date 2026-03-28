const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

let before = `        <Animated.View style={[
          styles.turnBadge,
          isMyTurn ? styles.turnBadgeActive : styles.turnBadgeInactive,
          isMyTurn ? { transform: [{ scale: turnAnim }] } : null
        ]}>
          <Text style={[
            styles.turnBadgeText,
            isMyTurn ? styles.turnBadgeTextActive : styles.turnBadgeTextInactive
          ]}>
            P{(G.players || []).indexOf(myPlayerId) + 1} {t('game.me')} {isMyTurn ? t('game.yourTurn') : ''}
          </Text>
        </Animated.View>`;

let after = `        <Animated.View style={[
          styles.turnBadge,
          isMyTurn ? styles.turnBadgeActive : styles.turnBadgeInactive,
          isMyTurn ? { transform: [{ scale: turnAnim }] } : null,
          isTargetingMode && selectedTargetId === myPlayerId ? { borderColor: '#FF5252', borderWidth: 2, backgroundColor: 'rgba(0,0,0,0.8)' } : null
        ]}>
          <TouchableOpacity
            disabled={!isTargetingMode || (gameName === 'SanGuoSha' && selectedCards.length > 0 && myHand[selectedCards[0]]?.name !== 'ShanDian')}
            onPress={() => setSelectedTargetId(myPlayerId)}
            style={{ padding: 4 }}
          >
            <Text style={[
              styles.turnBadgeText,
              isMyTurn && !(isTargetingMode && selectedTargetId === myPlayerId) ? styles.turnBadgeTextActive : styles.turnBadgeTextInactive,
              isTargetingMode && selectedTargetId === myPlayerId ? { color: 'white' } : null
            ]}>
              P{(G.players || []).indexOf(myPlayerId) + 1} {t('game.me')} {isMyTurn ? t('game.yourTurn') : ''}
            </Text>
          </TouchableOpacity>
        </Animated.View>`;

code = code.replace(before, after);
fs.writeFileSync('src/components/GameBoard.tsx', code);
console.log('ShanDian self-targeting patched');
