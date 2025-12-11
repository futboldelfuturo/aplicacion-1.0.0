import React from 'react';
import SubPanelPorCategoria from '../../components/SubPanelPorCategoria';

const PartidosCompletos = () => {
  return (
    <SubPanelPorCategoria
      tipoContenido="partido"
      tituloPrincipal="PARTIDOS COMPLETOS"
      permiteSubir={true} // Nadie sube directamente aquí
    />
  );
};

export default PartidosCompletos;
