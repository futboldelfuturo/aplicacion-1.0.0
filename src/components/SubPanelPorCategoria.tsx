// src/screens/Principal/SubPanelPorCategoria.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/utils/supabase';
import { EntrenadorStackParamList } from '@/types';
import HeaderLogo from './HeaderLogo';

type NavigationProp = NativeStackNavigationProp<EntrenadorStackParamList, 'ContenidoPorCategoria'>;

type Props = {
  tipoContenido: 'entrenamiento' | 'analisis' | 'partido';
  tituloPrincipal: string;
  permiteSubir: boolean;
};

const numColumns = 3;
const SCREEN_W = Dimensions.get('window').width;
// En web, hacer los cuadros más pequeños y centrados
const CARD_SIZE = Platform.OS === 'web' 
  ? Math.min(180, (SCREEN_W - 120) / numColumns) 
  : SCREEN_W / numColumns - 24;

const COLORS = {
  bg: '#121212',
  card: '#1F1F1F',
  text: '#FFFFFF',
  textMuted: '#AAAAAA',
  shadow: 'rgba(0,0,0,0.12)',
};

const SubPanelPorCategoria: React.FC<Props> = ({ tipoContenido, tituloPrincipal, permiteSubir }) => {
  const navigation = useNavigation<NavigationProp>();
  const { equipoId } = useAppContext();
  const route = useRoute();
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);

  // refs de animación
  const tileAnims = useRef<Animated.Value[]>([]);
  const scaleAnims = useRef<Animated.Value[]>([]);

  useEffect(() => {
    if (equipoId && equipoId !== '') {
      fetchCategorias();
    } else {
      setCategorias([]);
    }
  }, [equipoId]);

  useEffect(() => {
    if (categorias.length > 0) {
      categorias.forEach((_, i) => {
        if (!tileAnims.current[i]) tileAnims.current[i] = new Animated.Value(0);
        if (!scaleAnims.current[i]) scaleAnims.current[i] = new Animated.Value(1);
      });

      // Animación de aparición escalonada
      const seq = tileAnims.current.map((a, i) =>
        Animated.timing(a, { toValue: 1, duration: 360, delay: i * 70, useNativeDriver: true })
      );
      Animated.stagger(60, seq).start();
    }
  }, [categorias]);

  const fetchCategorias = async () => {
    if (!equipoId || equipoId === '') {
      setCategorias([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('id, nombre')
        .eq('equipo_id', equipoId)
        .order('nombre', { ascending: false });

      if (error) {
        console.error('❌ Error al cargar categorías:', error.message);
        setCategorias([]);
        return;
      }
      setCategorias(data || []);
    } catch (err) {
      console.error('❌ Error al cargar categorías:', err);
      setCategorias([]);
    }
  };

  const renderItem = ({ item, index }: { item: { id: string; nombre: string }; index: number }) => {
    const animStyle = {
      opacity: tileAnims.current[index] || new Animated.Value(1),
      transform: [
        {
          translateY: tileAnims.current[index]
            ? tileAnims.current[index].interpolate({ inputRange: [0, 1], outputRange: [12, 0] })
            : 0,
        },
        {
          scale: scaleAnims.current[index] || 1,
        },
      ],
    };

    const onPressIn = () => {
      if (scaleAnims.current[index])
        Animated.spring(scaleAnims.current[index], { toValue: 0.985, friction: 8, useNativeDriver: true }).start();
    };

    const onPressOut = () => {
      if (scaleAnims.current[index])
        Animated.spring(scaleAnims.current[index], { toValue: 1, friction: 8, useNativeDriver: true }).start();
    };

    return (
      <Animated.View style={[animStyle, { marginBottom: 12 }]}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.9}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => {
            if (!equipoId) {
              Alert.alert('Error', 'No se ha seleccionado un equipo válido.');
              return;
            }
            navigation.navigate('ContenidoPorCategoria', {
              equipoId,
              categoriaId: item.id,
              categoriaNombre: item.nombre,
              tipoContenido,
              permiteSubir,
            });
          }}
        >
          <Image source={require('../../assets/Flogo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.nombre}>{item.nombre}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (!equipoId) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Cargando equipo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderLogo />
      <Text style={[styles.routeText, { marginTop: 80 }]}>Estás en: {route.name}</Text>
      <Text style={styles.titulo}>{tituloPrincipal}</Text>
      <Text style={styles.subtitulo}>CATEGORÍAS</Text>

      {categorias.length === 0 ? (
        <Text style={styles.noCategorias}>No hay categorías disponibles para este equipo.</Text>
      ) : (
        <FlatList
          data={categorias}
          renderItem={({ item, index }) => renderItem({ item, index })}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={styles.grid}
        />
      )}
    </View>
  );
};

export default SubPanelPorCategoria;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 20,
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
  },
  routeText: {
    textAlign: 'center',
    marginTop: 10,
    color: COLORS.textMuted,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    paddingHorizontal: Platform.OS === 'web' ? 24 : 12,
    gap: Platform.OS === 'web' ? 16 : 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    maxWidth: Platform.OS === 'web' ? 800 : '100%',
  },
  card: {
    width: CARD_SIZE,
    height: Platform.OS === 'web' ? CARD_SIZE + 20 : CARD_SIZE + 30,
    backgroundColor: COLORS.card,
    borderRadius: Platform.OS === 'web' ? 12 : 14,
    margin: Platform.OS === 'web' ? 6 : 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  logo: {
    width: Platform.OS === 'web' ? '50%' : '70%',
    height: Platform.OS === 'web' ? '50%' : '70%',
    marginBottom: Platform.OS === 'web' ? 4 : 6,
  },
  nombre: {
    fontSize: Platform.OS === 'web' ? 12 : 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  noCategorias: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
    color: COLORS.textMuted,
  },
});
