// src/components/layoutConBanner.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
  rol: 'admin' | 'entrenador' | 'analista';
}

const LayoutConBanner = ({ children }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, padding: 15 },
});

export default LayoutConBanner;
