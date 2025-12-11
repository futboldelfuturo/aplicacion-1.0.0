import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

interface HeaderLogoProps {
  showBackButton?: boolean;
}

export default function HeaderLogo({ showBackButton = true }: HeaderLogoProps) {
  const navigation = useNavigation();

  const statusBarHeight = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0);
  const bannerTop = statusBarHeight;

  // Si showBackButton es false, no mostrar nada
  if (!showBackButton) {
    return null;
  }

  // Intentar retroceder, si falla significa que no hay pantalla anterior
  const handleGoBack = () => {
    try {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      console.log('No se puede retroceder');
    }
  };

  // Verificar si puede retroceder
  let canGoBack = false;
  try {
    canGoBack = navigation.canGoBack();
  } catch (error) {
    canGoBack = false;
  }

  // Solo mostrar si puede retroceder
  if (!canGoBack) {
    return null;
  }

  return (
    <View style={[styles.container, { top: bannerTop }]}>
      <TouchableOpacity
        onPress={handleGoBack}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={24} color="#00AA00" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    zIndex: 1000,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

