export interface ManualSection {
  id: string
  title: string
  roles?: Array<'admin' | 'supervisor' | 'seller' | 'operator'> // sin roles = todos
  content: string[] // un párrafo o paso por ítem
}

export const manualSections: ManualSection[] = [
  {
    id: 'inicio',
    title: 'Primeros pasos',
    content: [
      'Ingresá con tu usuario y contraseña desde la pantalla de inicio de sesión.',
      'Desde el menú superior navegás entre Inicio, Clientes, Productos y Órdenes.',
      'Podés cambiar tu usuario o contraseña desde el ícono de perfil.'
    ]
  },
  {
    id: 'clientes',
    title: 'Clientes',
    roles: ['admin', 'seller'],
    content: [
      'Para registrar un cliente, tocá "Agregar cliente" y completá nombre, CUIT/CUIL, email y dirección.',
      'Podés agregar más de una dirección con "+ Agregar otra dirección".'
    ]
  },
  {
    id: 'ordenes',
    title: 'Órdenes',
    roles: ['admin', 'seller', 'supervisor', 'operator'],
    content: [
      'Una orden nueva empieza como borrador: mientras esté así podés editar cliente, dirección e ítems.',
      'Al pasar a "Pendiente de pago" o "Pagada" los ítems quedan bloqueados.',
      'Al marcar una orden como pagada elegís el tipo de factura y el método de pago.'
    ]
  },
  {
    id: 'logistica',
    title: 'Despacho y logística',
    roles: ['admin', 'supervisor', 'operator'],
    content: [
      'Para poner una orden "En camino" es obligatorio cargar el número de seguimiento.',
      'Al rechazar o cancelar una orden tenés que indicar el motivo.'
    ]
  },
  {
    id: 'usuarios',
    title: 'Usuarios y backup',
    roles: ['admin'],
    content: [
      'Desde "Usuarios" podés crear usuarios, asignar roles y activarlos o desactivarlos.',
      'Desde "Backup" generás una copia de la base de datos o restaurás una anterior. Restaurar sobrescribe los datos actuales.'
    ]
  }
]