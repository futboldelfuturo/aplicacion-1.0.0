import React from 'react';
import SubPanelPorCategoria from '../../components/SubPanelPorCategoria';
import { useUserInfo } from '@/hooks/useUserInfo';

const AnalisisPartidos = () => {
  const { roles } = useUserInfo(); // Aquí obtienes los roles del usuario logueado
  const esAnalista = roles?.includes('analista');

  return (
    <SubPanelPorCategoria
      tipoContenido="analisis"
      tituloPrincipal="ANÁLISIS DE PARTIDOS"
      permiteSubir={esAnalista} // solo true si el rol es analista
    />
  );
};

export default AnalisisPartidos;
