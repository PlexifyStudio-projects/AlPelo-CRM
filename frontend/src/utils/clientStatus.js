export const STATUS = {
  NUEVO: 'nuevo',
  ACTIVO: 'activo',
  EN_RIESGO: 'en_riesgo',
  INACTIVO: 'inactivo',
  VIP: 'vip',
};

export const STATUS_META = {
  [STATUS.VIP]: { label: 'VIP', color: 'accent', priority: 0 },
  [STATUS.NUEVO]: { label: 'Nuevo', color: 'info', priority: 1 },
  [STATUS.ACTIVO]: { label: 'Activo', color: 'success', priority: 2 },
  [STATUS.EN_RIESGO]: { label: 'En Riesgo', color: 'warning', priority: 3 },
  [STATUS.INACTIVO]: { label: 'Inactivo', color: 'danger', priority: 4 },
};
