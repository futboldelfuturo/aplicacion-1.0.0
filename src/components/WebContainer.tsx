import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface WebContainerProps {
  children: React.ReactNode;
}

/**
 * Contenedor que solo aplica estilos en web para centrar y limitar el ancho del contenido
 * En móvil, simplemente pasa los children sin modificar
 */
export default function WebContainer({ children }: WebContainerProps) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View style={styles.webWrapper}>
      <View style={styles.webContent}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#121212', // Fondo uniforme en toda la pantalla
    alignItems: 'center', // Centrar el contenido horizontalmente
  },
  webContent: {
    width: '100%',
    maxWidth: 1400, // Ancho máximo para agrupar contenido
    flex: 1,
    paddingHorizontal: Platform.OS === 'web' ? 40 : 0, // Padding lateral para agrupar
    backgroundColor: 'transparent', // Transparente para mantener el fondo uniforme
  },
});

