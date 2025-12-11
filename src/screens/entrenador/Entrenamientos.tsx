import React from 'react';
import SubPanelPorCategoria from '../../components/SubPanelPorCategoria';

const Entrenamientos = () => {
  return (
    <SubPanelPorCategoria
      tipoContenido="entrenamiento"
      tituloPrincipal="ENTRENAMIENTOS"
      permiteSubir={true} // Solo entrenadores podrán subir
    />
  );
};

export default Entrenamientos;
