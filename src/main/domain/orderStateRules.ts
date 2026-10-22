/**
 * Reglas de negocio de los estados de una orden.
 * Fuente única de verdad: la usa el formulario (UX) y debe usarla el
 * backend (main process) para validar de verdad cada cambio.
 *
 * Ubicación sugerida: src/main/domain/orderStateRules.ts
 */

// IDs: deben coincidir con la tabla de estados en la base de datos.
export const OrderState = {
  Created: 1, // Borrador, los ítems todavía se pueden editar
  Pending: 2, // Confirmada, ítems bloqueados, esperando pago
  Paid: 3, // Pagada, ya puede salir a logística
  InTransit: 4, // En camino (reemplaza a "despachado" + "en camino")
  Delivered: 5, // Entregada
  Rejected: 6, // La empresa la rechaza (stock, error, etc.). El motivo va en notes
  Cancelled: 7, // El cliente se arrepiente
} as const

export type OrderStateId = (typeof OrderState)[keyof typeof OrderState]

export const STATE_LABELS: Record<OrderStateId, string> = {
  [OrderState.Created]: "Creada (borrador)",
  [OrderState.Pending]: "Pendiente de pago",
  [OrderState.Paid]: "Pagada",
  [OrderState.InTransit]: "En camino",
  [OrderState.Delivered]: "Entregada",
  [OrderState.Rejected]: "Rechazada",
  [OrderState.Cancelled]: "Cancelada",
}

export function getStateLabel(stateId: number, fallback = ""): string {
  return STATE_LABELS[stateId as OrderStateId] ?? fallback
}

// ─── Roles ────────────────────────────────────────────────────────────────

export type Role = "admin" | "supervisor" | "seller" | "operator"

const ROLE_BY_ID: Record<number, Role> = {
  1: "admin",
  2: "supervisor",
  3: "seller",
  4: "operator",
}

const ROLE_BY_NAME: Record<string, Role> = {
  admin: "admin",
  supervisor: "supervisor",
  seller: "seller",
  vendedor: "seller",
  operator: "operator",
  operador: "operator",
}

export function getRole(roleId?: number, roleName?: string): Role | null {
  return ROLE_BY_NAME[roleName?.toLowerCase() ?? ""] ?? ROLE_BY_ID[Number(roleId)] ?? null
}

export const isLogisticsRole = (role: Role | null) =>
  role === "operator" || role === "supervisor" || role === "admin"

// ─── Transiciones permitidas: estado actual → rol → estados siguientes ────

const { Created, Pending, Paid, InTransit, Delivered, Rejected, Cancelled } = OrderState

const TRANSITIONS: Partial<Record<OrderStateId, Partial<Record<Role, OrderStateId[]>>>> = {
  [Created]: {
    seller: [Pending, Cancelled],
    admin: [Pending, Cancelled],
  },
  [Pending]: {
    seller: [Paid, Cancelled],
    admin: [Paid, Cancelled],
  },
  // Una orden pagada solo la cancela el admin (implica reembolso)
  [Paid]: {
    operator: [InTransit, Rejected],
    supervisor: [InTransit],
    admin: [InTransit, Rejected, Cancelled],
  },
  [InTransit]: {
    operator: [Delivered, Rejected],
    supervisor: [Delivered],
    admin: [Delivered, Rejected],
  },
  // Delivered, Rejected y Cancelled son estados finales
}

export function getAllowedNextStates(currentStateId: number, role: Role | null): OrderStateId[] {
  if (!role) return []
  return TRANSITIONS[currentStateId as OrderStateId]?.[role] ?? []
}

export function canChangeState(currentStateId: number, nextStateId: number, role: Role | null): boolean {
  return getAllowedNextStates(currentStateId, role).includes(nextStateId as OrderStateId)
}

// ─── Otras reglas ─────────────────────────────────────────────────────────

/** Los ítems (cliente, dirección, productos) solo se editan mientras es borrador. */
export function canEditOrderDetails(currentStateId: number, role: Role | null): boolean {
  return currentStateId === Created && (role === "seller" || role === "admin")
}

const INVOICE_STATES: OrderStateId[] = [Paid, InTransit, Delivered]

/** La factura existe desde que la orden está pagada. La ven seller y admin. */
export function canViewInvoice(currentStateId: number, role: Role | null): boolean {
  return (role === "seller" || role === "admin") && INVOICE_STATES.includes(currentStateId as OrderStateId)
}

export const requiresTracking = (nextStateId: number) => nextStateId === InTransit

export const requiresReason = (nextStateId: number) => nextStateId === Rejected || nextStateId === Cancelled
