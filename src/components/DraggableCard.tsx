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
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(isSelected ? -20 : 0)).current;
  const [zIndex, setZIndex] = useState(1);

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
        // Only take over if dragged more than 5 pixels
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        if (!isMyTurn || isOpponent) return;
        setZIndex(999);
        // Provide tactile feedback on drag start
        Animated.spring(scale, {
          toValue: 1.05,
          useNativeDriver: true,
          friction: 4,
          tension: 100,
        }).start();

        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (e, gestureState) => {
        if (!isMyTurn || isOpponent) return;
        Animated.event(
          [
            null,
            { dx: pan.x, dy: pan.y }
          ],
          { useNativeDriver: false }
        )(e, gestureState);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!isMyTurn || isOpponent) return;
        setZIndex(1);
        // Reset tactile feedback
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
          tension: 100,
        }).start();

        pan.flattenOffset();

        if (gestureState.dy < -100) {
          // Check if dragged up sufficiently
          onDragUp(index);
        }

        // Always snap back, if it was a valid play the card will be removed from hand
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 5,
        }).start();
      },
      onPanResponderTerminate: () => {
        if (!isMyTurn || isOpponent) return;
        setZIndex(1);
         Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
          tension: 100,
        }).start();
        Animated.spring(pan, {
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
  const marginLeft = index > 0 ? -35 : 0;
  // Make cards darker when not turn
  const opacity = isMyTurn ? 1 : 0.6;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.cardContainer,
        { marginLeft, opacity, zIndex, elevation: zIndex, touchAction: 'none' } as any,
        {
          transform: [
            { translateX: pan.x },
            { translateY: Animated.add(pan.y, translateY) },
            { scale }
          ]
        }
      ]}
    >
      <TouchableWithoutFeedback onPress={() => onPress(index)}>
        <View
          style={[styles.card, { backgroundColor: cardColor }, borderStyle]}
        >
          <Text style={[styles.cardText, { color: textColor }]}>
            {card.value !== undefined && gameName === 'UnoLite' ? card.value : card.rank}
          </Text>
          {card.suit && (
            <Text style={{ color: textColor, fontSize: 18, marginTop: 4 }}>
              {card.suit === 'Hearts' ? '♥' : card.suit === 'Diamonds' ? '♦' : card.suit === 'Clubs' ? '♣' : '♠'}
            </Text>
          )}
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