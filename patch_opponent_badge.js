const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

let before = `        const isLowCards = gameName === 'JiangsuTaopai' && opponentHand.length > 0 && opponentHand.length <= 2;

        return (
          <Animated.View key={opponentId} style={[
            styles.opponentCard,
            layoutStyle,
            {
              backgroundColor: isOpponentTurnState ? 'rgba(0,0,0,0.9)' : (isLowCards ? 'rgba(244, 67, 54, 0.8)' : 'rgba(0,0,0,0.4)'),
              borderColor: isOpponentTurnState ? '#FFFFFF' : (isLowCards ? '#FFCDD2' : 'transparent'),
              borderWidth: isOpponentTurnState ? 2 : (isLowCards ? 2 : 2),
              transform: isOpponentTurnState ? [{ scale: turnAnim }] : [],
              shadowColor: '#000000',
              shadowOffset: isOpponentTurnState ? { width: 0, height: 4 } : { width: 0, height: 0 },
              shadowOpacity: isOpponentTurnState ? 0.9 : 0,
              shadowRadius: isOpponentTurnState ? 6 : 0,
              elevation: isOpponentTurnState ? 10 : 0,
              opacity: isOpponentTurnState ? 1 : 0.4,
            }
          ]}>
            <Text style={[styles.opponentName, {
              color: 'white',
              textShadowColor: isOpponentTurnState ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
              textShadowOffset: { width: 0, height: isOpponentTurnState ? 2 : 0 },
              textShadowRadius: isOpponentTurnState ? 4 : 0,
            }]}>
              {shortName} {isOpponentTurnState ? '(Turn)' : ''} {sgsState && sgsState.dead ? '💀' : ''}
            </Text>`;

let after = `        const isLowCards = gameName === 'JiangsuTaopai' && opponentHand.length > 0 && opponentHand.length <= 2;

        // Targetting logic
        const isOutOfRange = isTargetingMode && outOfRangePlayers[opponentId];
        const isSelectedTarget = isTargetingMode && selectedTargetId === opponentId;
        const isValidTarget = isTargetingMode && !isOutOfRange && !(sgsState && sgsState.dead);
        // Note: ShanDian targets self, generally opponents aren't targeted with ShanDian unless rule changed.

        let bgColor = isOpponentTurnState ? 'rgba(0,0,0,0.9)' : (isLowCards ? 'rgba(244, 67, 54, 0.8)' : 'rgba(0,0,0,0.4)');
        let borderColor = isOpponentTurnState ? '#FFFFFF' : (isLowCards ? '#FFCDD2' : 'transparent');
        let borderWidth = isOpponentTurnState ? 2 : (isLowCards ? 2 : 2);
        let opacity = isOpponentTurnState ? 1 : 0.4;
        let shadowOpacity = isOpponentTurnState ? 0.9 : 0;
        let elevation = isOpponentTurnState ? 10 : 0;

        if (isTargetingMode) {
           opacity = isOutOfRange ? 0.3 : 1;
           if (isSelectedTarget) {
              borderColor = '#FF5252';
              borderWidth = 3;
              shadowOpacity = 1;
              elevation = 15;
              bgColor = 'rgba(0,0,0,0.8)';
           } else if (isValidTarget) {
              borderColor = '#FFF';
              borderWidth = 2;
           }
        }

        return (
          <Animated.View key={opponentId} style={[
            styles.opponentCard,
            layoutStyle,
            {
              backgroundColor: bgColor,
              borderColor: borderColor,
              borderWidth: borderWidth,
              transform: isOpponentTurnState ? [{ scale: turnAnim }] : [],
              shadowColor: isSelectedTarget ? '#FF5252' : '#000000',
              shadowOffset: isOpponentTurnState || isSelectedTarget ? { width: 0, height: 4 } : { width: 0, height: 0 },
              shadowOpacity: shadowOpacity,
              shadowRadius: isOpponentTurnState || isSelectedTarget ? 6 : 0,
              elevation: elevation,
              opacity: opacity,
            }
          ]}>
            {isTargetingMode && (
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                disabled={isOutOfRange || (sgsState && sgsState.dead)}
                onPress={() => {
                  setSelectedTargetId(opponentId);
                }}
                accessibilityRole="button"
              />
            )}
            {isOutOfRange && (
              <View style={{ position: 'absolute', top: -10, right: -10, backgroundColor: '#D32F2F', padding: 2, borderRadius: 4, zIndex: 10 }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>Dist &gt; 1</Text>
              </View>
            )}
            <Text style={[styles.opponentName, {
              color: 'white',
              textShadowColor: isOpponentTurnState ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
              textShadowOffset: { width: 0, height: isOpponentTurnState ? 2 : 0 },
              textShadowRadius: isOpponentTurnState ? 4 : 0,
            }]}>
              {shortName} {isOpponentTurnState ? '(Turn)' : ''} {sgsState && sgsState.dead ? '💀' : ''}
            </Text>`;

code = code.replace(before, after);
fs.writeFileSync('src/components/GameBoard.tsx', code);
console.log('Opponent badge patched');
