import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';

type Equipo = {
  id: string;
  nombre: string;
};

type Categoria = {
  id: string;
  nombre: string;
  equipo_id: string;
};

interface Props {
  equipoSeleccionado: string;
  setEquipoSeleccionado: (equipo: string) => void;
  categoriaSeleccionada: string;
  setCategoriaSeleccionada: (categoria: string) => void;
}

const SeleccionEquipoCategoria: React.FC<Props> = ({
  equipoSeleccionado,
  setEquipoSeleccionado,
  categoriaSeleccionada,
  setCategoriaSeleccionada,
}) => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingEquipos, setLoadingEquipos] = useState(true);
  const [loadingCategorias, setLoadingCategorias] = useState(false);

  useEffect(() => {
    const fetchEquipos = async () => {
      const { data, error } = await supabase.from('teams').select('*');
      if (error) {
        console.error('Error cargando equipos:', error.message);
      } else {
        setEquipos(data);
      }
      setLoadingEquipos(false);
    };

    fetchEquipos();
  }, []);

  const handleSeleccionEquipo = async (equipoId: string) => {
    setEquipoSeleccionado(equipoId);
    setCategoriaSeleccionada('');
    setLoadingCategorias(true);

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('equipo_id', equipoId);

    if (error) {
      console.error('Error cargando categorías:', error.message);
    } else {
      setCategorias(data);
    }

    setLoadingCategorias(false);
  };

  return (
    <View>
      <Text style={styles.label}>Selecciona un equipo:</Text>
      {loadingEquipos ? (
        <ActivityIndicator size="small" />
      ) : (
        <Picker
          selectedValue={equipoSeleccionado}
          onValueChange={handleSeleccionEquipo}
          style={styles.picker}
        >
          <Picker.Item label="Selecciona..." value="" />
          {equipos.map((eq) => (
            <Picker.Item key={eq.id} label={eq.nombre} value={eq.id} />
          ))}
        </Picker>
      )}

      {loadingCategorias && <ActivityIndicator size="small" />}

      {categorias.length > 0 && (
        <>
          <Text style={styles.label}>Selecciona una categoría:</Text>
          <Picker
            selectedValue={categoriaSeleccionada}
            onValueChange={setCategoriaSeleccionada}
            style={styles.picker}
          >
            <Picker.Item label="Selecciona..." value="" />
            {categorias.map((cat) => (
              <Picker.Item key={cat.id} label={cat.nombre} value={cat.id} />
            ))}
          </Picker>
        </>
      )}
    </View>
  );
};

export default SeleccionEquipoCategoria;

const styles = StyleSheet.create({
  label: {
    fontWeight: 'bold',
    marginTop: 12,
  },
  picker: {
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
});
