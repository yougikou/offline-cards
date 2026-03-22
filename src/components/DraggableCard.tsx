import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Text, View, Animated, PanResponder, TouchableOpacity } from 'react-native';

export interface DraggableCardProps {
  card: any;
  index: number;
  totalCards: number;
  isMyTurn: boolean;
  gameName: string;
  isSelected: boolean;
  hasSelection?: boolean;
  onPress: (index: number) => void;
  onDragUp: (index: number) => void;
  isOpponent?: boolean;
  multiPan?: Animated.ValueXY;
  multiScale?: Animated.Value;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isMultiDragging?: boolean;
  customMarginLeft?: number;
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  card,
  index,
  totalCards,
  isMyTurn,
  gameName,
  isSelected,
  hasSelection = false,
  onPress,
  onDragUp,
  isOpponent = false,
  multiPan,
  multiScale,
  onDragStart,
  onDragEnd,
  isMultiDragging = false,
  customMarginLeft,
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const [zIndex, setZIndex] = useState(1);

  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: isSelected ? 1 : 0,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [isSelected, selectAnim]);

  const currentPan = (isSelected && multiPan) ? multiPan : pan;
  const currentScale = (isSelected && multiScale) ? multiScale : scale;

  const propsRef = useRef({ isMyTurn, isOpponent, onDragUp, index, isSelected, currentPan, currentScale, onDragStart, onDragEnd });
  useEffect(() => {
    propsRef.current = { isMyTurn, isOpponent, onDragUp, index, isSelected, currentPan, currentScale, onDragStart, onDragEnd };
  }, [isMyTurn, isOpponent, onDragUp, index, isSelected, currentPan, currentScale, onDragStart, onDragEnd]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (!propsRef.current.isSelected) return false;
        // Only take over if dragged more than 5 pixels
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        if (!propsRef.current.isMyTurn || propsRef.current.isOpponent) return;
        const { currentPan, currentScale, onDragStart } = propsRef.current;

        if (onDragStart) onDragStart();

        setZIndex(999);
        // Provide tactile feedback on drag start
        Animated.spring(currentScale, {
          toValue: 1.05,
          useNativeDriver: true,
          friction: 4,
          tension: 100,
        }).start();

        currentPan.setOffset({
          x: (currentPan.x as any)._value,
          y: (currentPan.y as any)._value,
        });
        currentPan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (e, gestureState) => {
        if (!propsRef.current.isMyTurn || propsRef.current.isOpponent) return;
        const { currentPan } = propsRef.current;
        Animated.event(
          [
            null,
            { dx: currentPan.x, dy: currentPan.y }
          ],
          { useNativeDriver: false }
        )(e, gestureState);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!propsRef.current.isMyTurn || propsRef.current.isOpponent) return;
        const { currentPan, currentScale, onDragEnd, onDragUp, index } = propsRef.current;

        if (onDragEnd) onDragEnd();
        setZIndex(1);

        // Reset tactile feedback
        Animated.spring(currentScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
          tension: 100,
        }).start();

        currentPan.flattenOffset();

        if (gestureState.dy < -100) {
          // Check if dragged up sufficiently
          onDragUp(index);
        }

        // Always snap back, if it was a valid play the card will be removed from hand
        Animated.spring(currentPan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 5,
        }).start();
      },
      onPanResponderTerminate: () => {
        if (!propsRef.current.isMyTurn || propsRef.current.isOpponent) return;
        const { currentPan, currentScale, onDragEnd } = propsRef.current;

        if (onDragEnd) onDragEnd();
        setZIndex(1);

        Animated.spring(currentScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
          tension: 100,
        }).start();
        Animated.spring(currentPan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 5,
        }).start();
      }
    })
  ).current;

  if (isOpponent || card.hidden) {
    return (
      <View style={[styles.card, styles.cardBack]}>
        <Text style={styles.cardBackText}>{gameName === 'ZhengShangYou' ? 'POKER' : 'UNO'}</Text>
      </View>
    );
  }

  // If a wild card, use #1E1E1E (black-ish), else lower case the color name.
  const isWildColor = card.color === 'Black';
  const cardColor = isWildColor ? '#2C2C2C' : (card.color ? card.color.toLowerCase() : 'white');
  const textColor = card.color ? 'white' : (card.suit === 'Hearts' || card.suit === 'Diamonds' || card.rank === 'Red Joker' ? '#D32F2F' : '#212121');
  const borderStyle = isSelected ? { borderColor: '#444', borderWidth: 2 } : { borderColor: '#E0E0E0', borderWidth: 1 };

  // Calculate overlapping margin
  const marginLeft = customMarginLeft !== undefined ? customMarginLeft : (index > 0 ? -35 : 0);

  // Make cards darker when not turn. Also dim heavily if there is a selection but this card isn't selected.
  let opacity = isMyTurn ? 1 : 0.6;

  // When actively dragging, we must force the highest possible zIndex and elevation
  // PanResponder updates `zIndex` state to 999 internally when drag starts.
  // Selected cards retain base zIndex to preserve natural overlapping order and scanning flow.
  let baseZIndex = 1;
  let calculatedZIndex = Math.max(zIndex, isMultiDragging ? 999 : baseZIndex);
  let calculatedElevation = calculatedZIndex === 999 ? 999 : 6;

  const renderCardContent = () => {
    if (gameName === 'UnoLite') {
      let displayValue = card.value;
      if (card.value === 'Skip') displayValue = '⊘';
      if (card.value === 'Reverse') displayValue = '⇄';
      if (card.value === 'Draw2') displayValue = '+2';
      if (card.value === 'Wild') displayValue = 'Wild';
      if (card.value === 'WildDraw4') displayValue = '+4';

      const isWild = card.color === 'Black';

      // Provide strong text shadow for better readability
      const textShadowStyle = {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      };

      return (
        <View style={{ flex: 1, width: '100%' }}>
          {/* Top Left Corner */}
          <View style={{ position: 'absolute', top: 4, left: 4, alignItems: 'center' }}>
            <Text style={[{ color: textColor, fontSize: isWild ? 12 : 16, fontWeight: '900', userSelect: 'none' as any }, textShadowStyle]}>{displayValue}</Text>
          </View>

          {/* Bottom Right Corner (Upside Down) */}
          <View style={{ position: 'absolute', bottom: 4, right: 4, alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
            <Text style={[{ color: textColor, fontSize: isWild ? 12 : 16, fontWeight: '900', userSelect: 'none' as any }, textShadowStyle]}>{displayValue}</Text>
          </View>

          {/* Center */}
          <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Text style={[styles.cardText, { color: textColor, fontSize: isWild ? 20 : 28, fontWeight: '900' }, textShadowStyle]}>
              {displayValue !== undefined ? displayValue : ''}
            </Text>
          </View>
        </View>
      );
    } else {
      const suitIcon = card.suit === 'Hearts' ? '♥' : card.suit === 'Diamonds' ? '♦' : card.suit === 'Clubs' ? '♣' : card.suit === 'Spades' ? '♠' : '';
      return (
        <View style={{ flex: 1, width: '100%' }}>
          {/* Top Left Corner */}
          <View style={{ position: 'absolute', top: 4, left: 4, alignItems: 'center' }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold', userSelect: 'none' as any }}>{card.rank}</Text>
            {suitIcon ? <Text style={{ color: textColor, fontSize: 14, userSelect: 'none' as any }}>{suitIcon}</Text> : null}
          </View>

          {/* Bottom Right Corner (Upside Down) */}
          <View style={{ position: 'absolute', bottom: 4, right: 4, alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold', userSelect: 'none' as any }}>{card.rank}</Text>
            {suitIcon ? <Text style={{ color: textColor, fontSize: 14, userSelect: 'none' as any }}>{suitIcon}</Text> : null}
          </View>

          {/* Center (Optional, could just leave empty for standard cards, or put a big suit) */}
          {suitIcon ? (
             <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ color: textColor, fontSize: 32, opacity: 0.2, userSelect: 'none' as any }}>{suitIcon}</Text>
             </View>
          ) : (
             <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ color: textColor, fontSize: 24, fontWeight: 'bold', userSelect: 'none' as any }}>{card.rank}</Text>
             </View>
          )}
        </View>
      );
    }
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.cardContainer,
        { marginLeft, opacity, zIndex: calculatedZIndex, elevation: calculatedElevation, touchAction: 'none' } as any,
        {
          transform: [
            { translateX: currentPan.x },
            { translateY: currentPan.y },
            { scale: currentScale }
          ]
        }
      ]}
    >
      <TouchableOpacity activeOpacity={0.8} accessibilityRole="button" onPress={() => onPress(index)}>
        <Animated.View style={{
          transform: [
            { translateY: selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }
          ]
        }}>
          <View
            style={[styles.card, { backgroundColor: cardColor }, borderStyle, isSelected ? { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 } : {}]}
          >
            {renderCardContent()}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    // Allows the shadow to show around the card
    padding: 2,
    zIndex: 1, // Standard zIndex; the actual stack will naturally follow the rendering order
    userSelect: 'none' as any,
  },
  card: {
    width: 70,
    height: 110,
    backgroundColor: 'white',
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    userSelect: 'none' as any,
  },
  cardBack: {
    width: 45,
    height: 70,
    backgroundColor: '#1E1E1E',
    borderColor: '#424242',
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  cardText: {
    fontSize: 24,
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
  cardBackText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: 'bold',
    userSelect: 'none' as any,
  },
});

export default DraggableCard;