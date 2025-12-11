// src/screens/Principal/PanelPrincipal.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  View,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { useAppContext, RoleType } from '@/context/AppContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import LayoutConBanner from '@/components/layoutConBanner';
import { supabase } from '@/utils/supabase';
import { Feather } from '@expo/vector-icons';
import HeaderLogo from '@/components/HeaderLogo';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width: SCREEN_W } = Dimensions.get('window');
const IS_WIDE = SCREEN_W >= 740;

const COLORS = {
  bg: '#121212',
  card: '#1F1F1F',
  text: '#FFFFFF',
  textMuted: '#AAAAAA',
  shadow: 'rgba(0,0,0,0.12)',
};
const RADIUS = { md: 14 };
const SPACING = { md: 18 };
const FONT = { TITLE: 'MontserratBold', UI: 'PoppinsMedium' };

const roleLabel = (r: RoleType) =>
  r === 'administrador'
    ? 'Administrador'
    : r === 'entrenador'
    ? 'Entrenador'
    : r === 'analista'
    ? 'Analista'
    : 'Invitado';

const roleIcons: Record<RoleType, React.ComponentProps<typeof Feather>['name']> = {
  administrador: 'user',
  entrenador: 'award',
  analista: 'monitor',
  invitado: 'user-check',
};

const ActionTile: React.FC<{
  title: string;
  subtitle?: string;
  onPress: () => void;
  iconName?: React.ComponentProps<typeof Feather>['name'];
  testID?: string;
}> = ({ title, subtitle, onPress, iconName = 'box', testID }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, friction: 8 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 12 }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={styles.tile}
        testID={testID}
      >
        <View style={styles.tileLeft}>
          <Feather name={iconName} size={26} color={COLORS.text} style={{ opacity: 0.95 }} />
        </View>

        <View style={styles.tileBody}>
          <Text style={styles.tileTitle}>{title}</Text>
          {subtitle ? <Text style={styles.tileSubtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.tileRight}>
          <Feather
            name="chevron-right"
            size={18}
            color={COLORS.textMuted}
            style={{ opacity: 0.9 }}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const PanelPrincipal = () => {
  const navigation = useNavigation<NavigationProp>();
  const { rolActual, changeRole, userRoles, rolesLoaded, equipoId, equipoSeleccionado } =
    useAppContext();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamEscudoUrl, setTeamEscudoUrl] = useState<string | null>(null);
  const [loadingTeam, setLoadingTeam] = useState<boolean>(false);
  const fade = useRef(new Animated.Value(0)).current;
  const tileAnims = useRef<Animated.Value[]>(Array.from({ length: 4 }, () => new Animated.Value(0)))
    .current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
    const seq = tileAnims.map((a, i) =>
      Animated.timing(a, { toValue: 1, duration: 360, delay: i * 70, useNativeDriver: true })
    );
    Animated.stagger(60, seq).start();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadTeamData = async () => {
      setLoadingTeam(true);
      try {
        const idToUse =
          equipoId ?? (equipoSeleccionado ? String(equipoSeleccionado) : null);
        if (!idToUse) {
          setTeamName(null);
          setTeamEscudoUrl(null);
          setLoadingTeam(false);
          return;
        }

        const { data, error } = await supabase
          .from('teams')
          .select('nombre, escudo_url')
          .eq('id', idToUse)
          .maybeSingle();

        if (!mounted) return;
        setTeamName(error ? null : data?.nombre ?? null);
        setTeamEscudoUrl(error ? null : data?.escudo_url ?? null);
      } catch {
        if (mounted) {
          setTeamName(null);
          setTeamEscudoUrl(null);
        }
      } finally {
        if (mounted) setLoadingTeam(false);
      }
    };
    loadTeamData();
    return () => {
      mounted = false;
    };
  }, [equipoId, equipoSeleccionado]);

  useFocusEffect(
    React.useCallback(() => {
      if (rolActual === 'entrenador' || rolActual === 'analista') {
        navigation.setOptions({ headerBackVisible: false });
        const onBackPress = () => true;
        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => sub.remove();
      }
      navigation.setOptions({ headerBackVisible: true });
      return;
    }, [navigation, rolActual])
  );

  const handleRolePress = async (rol: RoleType) => {
    const ok = await changeRole(rol);
    if (!ok) {
      Alert.alert('Rol no permitido', `No tienes asignado el rol '${roleLabel(rol)}'.`);
      return;
    }
    if (rol === 'administrador') navigation.navigate('PanelAdmin' as never);
  };

  const bannerRol = rolActual === 'administrador' ? 'admin' : (rolActual as any);
  const availableRoles = (userRoles || []).filter(r => r !== rolActual);

  if (!rolesLoaded)
    return (
      <LayoutConBanner rol={bannerRol as 'entrenador' | 'analista' | 'admin'}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.text} />
          <Text style={{ marginTop: 12, color: COLORS.text }}>Cargando usuario...</Text>
        </View>
      </LayoutConBanner>
    );

  return (
    <LayoutConBanner rol={bannerRol as 'entrenador' | 'analista' | 'admin'}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <HeaderLogo showBackButton={false} />

      {/* Botón de perfil en la esquina superior izquierda */}
      <View style={styles.perfilButtonContainer}>
        <TouchableOpacity
          onPress={() => navigation.navigate('PerfilUsuario' as never)}
          style={styles.perfilButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="user" size={24} color="#00AA00" />
        </TouchableOpacity>
      </View>

      {/* Botones de cambio de rol en la esquina superior derecha */}
      <View style={styles.roleButtonsContainer}>
        {userRoles.includes('entrenador') && rolActual !== 'entrenador' && (
          <TouchableOpacity
            onPress={() => handleRolePress('entrenador')}
            style={styles.roleButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="award" size={20} color="#00AA00" />
          </TouchableOpacity>
        )}
        {userRoles.includes('analista') && rolActual !== 'analista' && (
          <TouchableOpacity
            onPress={() => handleRolePress('analista')}
            style={styles.roleButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="monitor" size={20} color="#00AA00" />
          </TouchableOpacity>
        )}
        {userRoles.includes('administrador') && rolActual !== 'administrador' && (
          <TouchableOpacity
            onPress={() => handleRolePress('administrador')}
            style={styles.roleButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="shield" size={20} color="#00AA00" />
          </TouchableOpacity>
        )}
      </View>

      {/* Escudo y logo empresa centrados arriba */}
      <View style={styles.escudoContainer}>
        {/* Imágenes centradas */}
        <View style={styles.imagesContainer}>
          {teamEscudoUrl ? (
            <View style={styles.dualImageRow}>
              <Image
                source={require('../../../assets/logo2.png')}
                style={styles.logoEmpresa}
                resizeMode="contain"
              />
              <Image
                source={{ uri: teamEscudoUrl }}
                style={styles.teamShield}
                resizeMode="contain"
              />
            </View>
          ) : (
            <Image
              source={require('../../../assets/escudo.png')}
              style={styles.teamShield}
              resizeMode="contain"
            />
          )}
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={[styles.container, { flexGrow: 1 }]}
        style={{ opacity: fade, backgroundColor: COLORS.bg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image
                source={require('../../../assets/Flogo.png')}
                style={styles.logoFijo}
                resizeMode="contain"
              />
              <View style={{ flexDirection: 'column' }}>
                <Text style={[styles.title, { fontFamily: FONT.TITLE }]}>Panel</Text>
                <Text style={styles.subtitle}>({roleLabel(rolActual)})</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('SeleccionEquipoCategoria' as never)}
              activeOpacity={0.85}
              style={[styles.teamBtn, { backgroundColor: '#00AA00' }]}
            >
              {loadingTeam ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <>
                  <Text
                    style={[styles.teamLabel, { fontFamily: FONT.UI, color: '#fff' }]}
                  >
                    {teamName ?? 'Sin equipo'}
                  </Text>
                  <Text style={[styles.teamSub, { color: '#fff' }]}>
                    {teamName ? 'Equipo seleccionado' : 'Seleccionar'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Grid actions */}
        <View style={[styles.grid, IS_WIDE ? { flexDirection: 'row' } : {}]}>
          <View style={IS_WIDE ? styles.col : undefined}>
            <Animated.View
              style={{
                opacity: tileAnims[0],
                transform: [
                  {
                    translateY: tileAnims[0].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  },
                ],
              }}
            >
              <ActionTile
                title="ENTRENAMIENTOS"
                subtitle="Mira tus sesiones"
                onPress={() => navigation.navigate('Entrenamientos' as never)}
                iconName="calendar"
                testID="btnEntrenamientos"
              />
            </Animated.View>

            <Animated.View
              style={{
                opacity: tileAnims[1],
                transform: [
                  {
                    translateY: tileAnims[1].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  },
                ],
              }}
            >
              <ActionTile
                title="FUT PRO"
                subtitle="Analisis de jugadores PRO"
                onPress={() => navigation.navigate('FutPro' as never)}
                iconName="users"
                testID="btnFutPro"
              />
            </Animated.View>
          </View>

          <View style={IS_WIDE ? styles.col : undefined}>
            <Animated.View
              style={{
                opacity: tileAnims[2],
                transform: [
                  {
                    translateY: tileAnims[2].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  },
                ],
              }}
            >
              <ActionTile
                title="ANALISIS DE PARTIDOS"
                subtitle="Revisión táctica"
                onPress={() => navigation.navigate('AnalisisPartidos' as never)}
                iconName="bar-chart-2"
                testID="btnAnalisisPartidos"
              />
            </Animated.View>

            <Animated.View
              style={{
                opacity: tileAnims[3],
                transform: [
                  {
                    translateY: tileAnims[3].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  },
                ],
              }}
            >
              <ActionTile
                title="PARTIDOS COMPLETOS"
                subtitle="Reproducir grabaciones"
                onPress={() => navigation.navigate('PartidosCompletos' as never)}
                iconName="play-circle"
                testID="btnPartidosCompletos"
              />
            </Animated.View>
          </View>
        </View>


        <View style={{ height: 28 }} />
      </Animated.ScrollView>
    </LayoutConBanner>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, backgroundColor: COLORS.bg },
  escudoContainer: { alignItems: 'center', marginTop: 60, marginBottom: 16, position: 'relative', width: '100%' },
  perfilButtonContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
    left: 16,
    zIndex: 10,
  },
  perfilButton: { 
    padding: 8, 
    borderRadius: 20,
    backgroundColor: 'rgba(0, 170, 0, 0.1)',
  },
  roleButtonsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  roleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 170, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 170, 0, 0.3)',
  },
  imagesContainer: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  dualImageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  logoEmpresa: { width: 150, height: 150, borderRadius: 999 },
  logoFijo: { width: 55, height: 55, marginRight: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted },
  headerRight: { alignItems: 'flex-end' },
  teamBtn: { backgroundColor: COLORS.card, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.md, alignItems: 'flex-end', minWidth: 120 },
  teamShield: { width: 80, height: 80, borderRadius: 999, borderWidth: 1, borderColor: COLORS.text },
  teamLabel: { color: COLORS.text, fontWeight: '700' },
  teamSub: { color: COLORS.textMuted, fontSize: 12 },
  grid: { flexDirection: IS_WIDE ? 'row' : 'column', gap: 12 as any },
  col: { width: IS_WIDE ? '48%' : '100%' },
  tile: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, padding: 12, minHeight: 82, shadowColor: COLORS.shadow, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6, backgroundColor: COLORS.card },
  tileLeft: { width: 56, alignItems: 'center', justifyContent: 'center' },
  tileBody: { flex: 1, paddingHorizontal: 8 },
  tileTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, fontFamily: FONT.TITLE },
  tileSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontFamily: FONT.UI },
  tileRight: { width: 18, alignItems: 'center', justifyContent: 'center' },
  rolePillsWrap: { marginTop: 18, alignItems: 'center' },
  rolePill: { width: '90%', paddingVertical: 12, borderRadius: 999, borderWidth: 1.2, borderColor: COLORS.text, marginVertical: 8, alignItems: 'center', backgroundColor: 'transparent' },
  rolePillActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  rolePillText: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  rolePillTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, backgroundColor: COLORS.bg },
});

export default PanelPrincipal;
