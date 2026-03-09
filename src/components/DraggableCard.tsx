import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, Text, View, Animated, PanResponder, TouchableWithoutFeedback } from 'react-native';

export interface DraggableCardProps {
  card: any;
  index: number;
  totalCards: number;
  isMyTurn: boolean;
  gameName: string;
  isSelected: boolean;
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
  const translateY = useRef(new Animated.Value(isSelected ? -20 : 0)).current;
  const [zIndex, setZIndex] = useState(1);

  const currentPan = (isSelected && multiPan) ? multiPan : pan;
  const currentScale = (isSelected && multiScale) ? multiScale : scale;

  const propsRef = useRef({ isMyTurn, isOpponent, onDragUp, index, isSelected, currentPan, currentScale, onDragStart, onDragEnd });
  useEffect(() => {
    propsRef.current = { isMyTurn, isOpponent, onDragUp, index, isSelected, currentPan, currentScale, onDragStart, onDragEnd };
  }, [isMyTurn, isOpponent, onDragUp, index, isSelected, currentPan, currentScale, onDragStart, onDragEnd]);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isSelected ? -20 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 40,
    }).start();
  }, [isSelected]);

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

  const cardColor = card.color ? card.color.toLowerCase() : 'white';
  const textColor = card.color ? 'white' : (card.suit === 'Hearts' || card.suit === 'Diamonds' || card.rank === 'Red Joker' ? '#D32F2F' : '#212121');
  const borderStyle = isSelected ? { borderColor: '#FFD700', borderWidth: 3 } : { borderColor: '#E0E0E0' };

  // Calculate overlapping margin
  const marginLeft = customMarginLeft !== undefined ? customMarginLeft : (index > 0 ? -35 : 0);
  // Make cards darker when not turn
  const opacity = isMyTurn ? 1 : 0.6;
  let calculatedZIndex = Math.max(zIndex, isMultiDragging ? 999 : isSelected ? 100 : 1);

  const renderCardContent = () => {
    if (gameName === 'UnoLite') {
      return (
        <View style={{ flex: 1, width: '100%' }}>
          {/* Top Left Corner */}
          <View style={{ position: 'absolute', top: 4, left: 4, alignItems: 'center' }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>{card.value}</Text>
          </View>

          {/* Bottom Right Corner (Upside Down) */}
          <View style={{ position: 'absolute', bottom: 4, right: 4, alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>{card.value}</Text>
          </View>

          {/* Center */}
          <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Text style={[styles.cardText, { color: textColor }]}>
              {card.value !== undefined ? card.value : ''}
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
            <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>{card.rank}</Text>
            {suitIcon ? <Text style={{ color: textColor, fontSize: 14 }}>{suitIcon}</Text> : null}
          </View>

          {/* Bottom Right Corner (Upside Down) */}
          <View style={{ position: 'absolute', bottom: 4, right: 4, alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>{card.rank}</Text>
            {suitIcon ? <Text style={{ color: textColor, fontSize: 14 }}>{suitIcon}</Text> : null}
          </View>

          {/* Center (Optional, could just leave empty for standard cards, or put a big suit) */}
          {suitIcon ? (
             <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ color: textColor, fontSize: 32, opacity: 0.2 }}>{suitIcon}</Text>
             </View>
          ) : (
             <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ color: textColor, fontSize: 24, fontWeight: 'bold' }}>{card.rank}</Text>
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
        { marginLeft, opacity, zIndex: calculatedZIndex, elevation: calculatedZIndex, touchAction: 'none' } as any,
        {
          transform: [
            { translateX: currentPan.x },
            { translateY: Animated.add(currentPan.y, translateY) },
            { scale: currentScale }
          ]
        }
      ]}
    >
      <TouchableWithoutFeedback onPress={() => onPress(index)}>
        <View
          style={[styles.card, { backgroundColor: cardColor }, borderStyle]}
        >
          {renderCardContent()}
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    // Allows the shadow to show around the card
    padding: 2,
    zIndex: 1, // Standard zIndex; the actual stack will naturally follow the rendering order
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
  },
  cardBackText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: 'bold',
  },
});

export default DraggableCard;