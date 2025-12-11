// src/types.ts

// Tipo base reutilizable
type EquipoCategoriaParams = {
  equipoId: string;
  categoriaId: string;
};

export type RootStackParamList = {
  // 🔹 Autenticación
  Login: undefined;
  AuthRedirector: undefined;

  // 🔹 Selección de equipo/categoría
  SeleccionEquipoCategoria: undefined;

  // 🔹 Subida de videos
  SubirVideo: {
    equipoId: string;
    categoriaId: string;
    tipo?: 'entrenamiento' | 'partido' | 'analisis' | 'futpro';
    jugadorId?: string;
  };

  // 🔹 Subida de análisis
  SubirAnalisis: {
    equipoId: string;
    categoriaId: string;
  };

  // 🔹 Subir videos de YouTube (nube)
  SubirDeNube: {
    equipoId: string;
    categoriaId: string;
    tipo: 'entrenamiento' | 'partido' | 'analisis' | 'futpro';
    jugadorId?: string;
  };

  UploadScreen: EquipoCategoriaParams;

  ListaVideos: undefined;

  VideoPlayer: { 
    videoUrl: string;
    titulo: string;
    descripcion: string;
  };

  EditarVideo: { videoId: string };

  // 🔹 Paneles principales
  PanelAdmin: undefined;
  PanelPrincipal: undefined;

  // 🔹 NUEVAS pantallas de administración
  GestionUsuarios: undefined;
  GestionEquipos: undefined;
  GestionCategorias: undefined;
  GestionJugadores: undefined;
  GestionCanalesYouTube: undefined;

  // 🔹 Panel general
  PanelGeneral: { 
    roles: string[];
  };

  // 🔹 Usuarios existentes
  UsuariosAdmin: undefined;
  ListadoUsuarios: undefined;
  CrearUsuario: undefined;

  // 🔹 Pantallas del entrenador
  Entrenamientos: undefined;
  AnalisisPartidos: undefined;
  PartidosCompletos: undefined;
  FutPro: undefined;

  // 🔹 Contenido por categoría
  ContenidoPorCategoria: {
    categoriaId: string;
    categoriaNombre: string;
    equipoId: string;
    tipoContenido: 'entrenamiento' | 'analisis' | 'partido';
    permiteSubir: boolean;
  };

  // 🔹 Nueva pantalla para informes de un jugador
  InformesJugador: {
    equipoId: string;
    categoriaId: string;
    jugadorId: string;
    jugadorNombre: string;
  };

  // 🔹 Perfil de usuario
  PerfilUsuario: undefined;

  // 🔹 Editar análisis
  EditarAnalisis: { analisisId: string };
  EditarAnalisisJugador: { analisisId: string };
};

// Reutilización para distintos perfiles
export type EntrenadorStackParamList = RootStackParamList;
export type AnalistaStackParamList = RootStackParamList;

// Tipado del video (mejorado para cubrir variantes usadas en el proyecto)
export interface VideoItem {
  id: string;
  titulo?: string | null;
  descripcion?: string | null;
  // nombres distintos que pueden aparecer según pantallas/queries:
  video_url?: string | null;
  archivo_url?: string | null;
  informe_url?: string | null;
  pdf_url?: string | null;
  creado_en?: string | null;
  creado_por?: string | null;
  tipo?: string | null;
  jugador_id?: string | null;
  categoria_id?: string | null;
  equipo_id?: string | null;
  // Campos de YouTube
  youtube_video_id?: string | null;
  es_youtube?: boolean | null;
  // campo flexible para cualquier otra propiedad
  [key: string]: any;
}

// Tipado de Jugador
export interface Jugador {
  id: string;
  nombre: string;
  dorlsal: string | null;          // Mantengo el nombre tal cual lo usas
  posicion: string | null;
  foto_url: string | null;
  equipo_id: string;
  categoria_id: string;
  categoria_nombre: string;
  analisis_count: number;
}
