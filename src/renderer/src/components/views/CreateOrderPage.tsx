import { useEffect, useState } from "react"
import { useAppDispatch } from "../../store/hooks"
import { setCurrentTab, setOrderToEdit, setGlobalAlert } from "../../store/slices/appSlice"
import { OrderWithState } from "../../../../main/domain/types/electron-env"
import {
  OrderState,
  STATE_LABELS,
  canEditOrderDetails,
  canViewInvoice,
  getAllowedNextStates,
  getRole,
  getStateLabel,
  isLogisticsRole,
  requiresReason,
  requiresTracking,
} from "../../../../main/domain/orderStateRules"
import { useSeletedAddressOnOrder } from "../../hooks/useSeletedAddressOnOrder"
import useSeletedUserOnOrder from "../../hooks/useSeletedUserOnOrder"
import { ItemOrder } from "../ItemOrder"

export interface FormOrderItem {
  id: string
  productId: number
  description: string
  quantity: number
  unitPrice: number
}

interface OrderFormProps {
  initialOrder?: OrderWithState | null
}

interface SessionInfo {
  id?: number
  roleId?: number
  roleName?: string
}

interface FormData {
  clientId: number
  shippingAddressId: number
  currentStateId: number
  trackingNumber: string
  location: string
  notes: string
  invoiceType: 'A' | 'B'
  paymentMethod: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const SHOW_DEBUG = false

const inputClass =
  "w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"

const labelClass = "mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"

const newItem = (): FormOrderItem => ({
  id: crypto.randomUUID(),
  productId: 0,
  description: "",
  quantity: 1,
  unitPrice: 0,
})

const buildFormData = (order?: OrderWithState | null): FormData => ({
  clientId: Number(order?.client?.id ?? -1),
  shippingAddressId: Number(order?.shippingAddressId ?? -1),
  currentStateId: Number(order?.currentState?.id ?? OrderState.Created),
  trackingNumber: order?.trackingNumber || "",
  location: "",
  notes: "",
  invoiceType: (order as any)?.invoiceType ?? 'B',
  paymentMethod: (order as any)?.paymentMethod || 'Efectivo',
})

const mapOrderItems = (order: OrderWithState): FormOrderItem[] => {
  const rawItems = (order as any).items ?? (order as any).itemOrders ?? []
  if (rawItems.length === 0) return [newItem()]

  return rawItems.map((item: any) => ({
    id: item.id ? String(item.id) : crypto.randomUUID(),
    productId: Number(item.productId ?? item.product?.id ?? 0),
    description: item.description ?? item.product?.name ?? "",
    quantity: Number(item.quantity ?? item.amount ?? 1),
    unitPrice: Number(item.unitPrice ?? item.price ?? 0),
  }))
}

const fetchSession = async (): Promise<SessionInfo | null> => {
  const data = await window.electronAPI?.getSession?.()
  if (!data) return null
  return { ...data, id: Number(data.id), roleId: Number(data.roleId) }
}

const assertSuccess = (response: any, fallbackMessage: string) => {
  if (!response?.success) throw new Error(response?.message || fallbackMessage)
}

// ─── Componente ───────────────────────────────────────────────────────────

export default function OrderForm({ initialOrder }: OrderFormProps) {
  const dispatch = useAppDispatch()

  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch((err) => console.error("Error al obtener la sesión activa:", err))
      .finally(() => setLoadingSession(false))
  }, [])

  const role = getRole(session?.roleId, session?.roleName)

  const isEditing = Boolean(initialOrder?.id)
  const orderStateId = Number(
    (initialOrder as any)?.currentStateId ?? initialOrder?.currentState?.id ?? OrderState.Created
  )

  const canEditDetails = !isEditing || canEditOrderDetails(orderStateId, role)
  const allowedNextStates = isEditing ? getAllowedNextStates(orderStateId, role) : []
  const canSubmit = canEditDetails || allowedNextStates.length > 0

  const hasInvoice = Boolean((initialOrder as any)?.invoiceType)
  const showInvoice = isEditing && canViewInvoice(orderStateId, role) && hasInvoice

  const debugInfo = {
    role,
    roleName: session?.roleName,
    roleId: session?.roleId,
    orderStateId,
    allowedNextStates,
    rawState: initialOrder?.currentState,
    rawStateId: (initialOrder as any)?.currentStateId,
  }

  const [formData, setFormData] = useState<FormData>(() => buildFormData(initialOrder))
  const [items, setItems] = useState<FormOrderItem[]>([newItem()])

  const [initialStateId, setInitialStateId] = useState<number>(OrderState.Created)

  const initialStateOptions = [
    OrderState.Created,
    ...getAllowedNextStates(OrderState.Created, role).filter(
      (stateId) => stateId === OrderState.Pending || stateId === OrderState.Paid
    ),
  ]

  const stateChanged = formData.currentStateId !== orderStateId
  const nextStateNeedsTracking = stateChanged && requiresTracking(formData.currentStateId)
  const nextStateNeedsReason = stateChanged && requiresReason(formData.currentStateId)

  const isTargetStatePaid = formData.currentStateId === OrderState.Paid
  const isInitialStatePaid = !isEditing && initialStateId === OrderState.Paid

  const isInvoiceLocked = (isEditing && orderStateId >= OrderState.Paid) || Boolean((initialOrder as any)?.invoiceType)

  const { clients, searchTermClients, setSearchTermClients, isOpenClients, setIsOpenClients } =
    useSeletedUserOnOrder()

  const { addresses, searchTermAddress, setSearchTermAddress, isOpenAddress, setIsOpenAddress } =
    useSeletedAddressOnOrder(formData)

  useEffect(() => {
    setFormData(buildFormData(initialOrder))

    if (!initialOrder?.id) {
      setSearchTermClients("")
      setSearchTermAddress("")
      setItems([newItem()])
      setInitialStateId(OrderState.Created)
      return
    }

    if (initialOrder.client) {
      setSearchTermClients(`${initialOrder.client.name} ${initialOrder.client.lastname}`)
    }

    const addr = (initialOrder as any).shippingAddress
    if (addr) {
      const city = addr.city?.name ? `, ${addr.city.name}` : ""
      setSearchTermAddress(`${addr.street ?? ""} ${addr.number ?? ""}${city}`.trim())
    }

    setItems(mapOrderItems(initialOrder))
  }, [initialOrder])

  const handleAddItem = () => setItems((prev) => [...prev, newItem()])

  const handleRemoveItem = (id: string) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)))

  const handleUpdateItem = (id: string, updatedFields: Partial<FormOrderItem>) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item)))

  const handleClientSelect = (client: (typeof clients)[number]) => {
    setFormData((prev) => ({ ...prev, clientId: Number(client.id), shippingAddressId: -1 }))
    setSearchTermClients(`${client.name} ${client.lastname}`)
    setSearchTermAddress("")
    setIsOpenAddress(false)
    setIsOpenClients(false)
  }

  const handleAddressSelect = (address: (typeof addresses)[number]) => {
    const cityName = address.city?.name ? `, ${address.city.name}` : ""
    setFormData((prev) => ({ ...prev, shippingAddressId: Number(address.id) }))
    setSearchTermAddress(`${address.street} ${address.number}${cityName}`)
    setIsOpenAddress(false)
  }

  const total = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)

  const handleCancel = () => {
    dispatch(setOrderToEdit(null))
    dispatch(setCurrentTab("orders"))
  }

  const handleViewInvoice = async (docType?: 'invoice' | 'credit-note') => {
    try {
      const response = await window.electronAPI?.openOrderInvoice?.(String(initialOrder?.id), docType)
      assertSuccess(response, "No se pudo abrir el comprobante.")
    } catch (err) {
      dispatch(setGlobalAlert(err instanceof Error ? err.message : "Error al abrir el comprobante."))
    }
  }

  const validate = (): string | null => {
    if (canEditDetails) {
      if (formData.clientId <= 0) return "Debe seleccionar un cliente"
      if (formData.shippingAddressId <= 0) return "Debe seleccionar una dirección"
      if (items.some((i) => i.productId <= 0)) return "Todos los ítems deben tener un producto seleccionado"
    }

    const isPayingNow = (!isEditing && initialStateId === OrderState.Paid) || (stateChanged && formData.currentStateId === OrderState.Paid)
    if (isPayingNow && !formData.paymentMethod.trim()) {
      return "Debe seleccionar un método de pago para marcar la orden como pagada."
    }

    if (nextStateNeedsTracking && !formData.trackingNumber.trim()) {
      return "El número de seguimiento (tracking) es obligatorio para poner la orden en camino."
    }
    if (nextStateNeedsReason && !formData.notes.trim()) {
      return "Indicá el motivo del rechazo o la cancelación en Observaciones."
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validate()
    if (validationError) {
      dispatch(setGlobalAlert(validationError))
      return
    }

    try {
      const currentSession = (await fetchSession().catch(() => null)) ?? session
      const orderId = initialOrder?.id ? String(initialOrder.id) : null
      let savedOrderId: string | null = orderId

      if (canEditDetails) {
        const sellerId =
          role === "seller"
            ? Number(currentSession?.id)
            : Number(initialOrder?.sellerId || currentSession?.id || 0)

        const selectedAddress = addresses.find((a) => Number(a.id) === formData.shippingAddressId) || (initialOrder as any)?.shippingAddress

        const details = {
          clientId: formData.clientId,
          shippingAddressId: formData.shippingAddressId,
          sellerId,
          currentStateId: orderStateId,
          total,
          paymentMethod: isInitialStatePaid ? formData.paymentMethod : undefined,
          invoiceType: isInitialStatePaid ? formData.invoiceType : undefined,
          shippingStreet: selectedAddress?.street ?? "",
          shippingNumber: Number(selectedAddress?.number ?? 0),
          shippingFloor: selectedAddress?.floor ?? null,
          shippingApartment: selectedAddress?.apartment ?? null,
          shippingPostalCode: selectedAddress?.postalCode ?? "",
          shippingCityName: selectedAddress?.city?.name ?? "",
          items: items.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
        }

        const response = orderId
          ? await window.electronAPI?.updateOrder?.({ id: orderId, ...details } as any)
          : await window.electronAPI?.createOrder?.({ ...details, initialStateId } as any)

        assertSuccess(response, "Error al guardar la orden.")
        if (!orderId && response?.orderId) {
          savedOrderId = String(response.orderId)
        }
      }

      if (orderId && stateChanged) {
        const response = await window.electronAPI?.updateOrderState?.({
          id: orderId,
          currentStateId: formData.currentStateId,
          trackingNumber: formData.trackingNumber.trim() || undefined,
          location: formData.location.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          invoiceType: isTargetStatePaid ? formData.invoiceType : undefined,
          paymentMethod: isTargetStatePaid ? formData.paymentMethod : undefined,
        } as any)

        assertSuccess(response, "Error al actualizar el estado de la orden.")
      }

      const isPaidNow = (!isEditing && initialStateId === OrderState.Paid) || (isEditing && formData.currentStateId === OrderState.Paid)
      const isCancelledOrRejected = isEditing && (formData.currentStateId === OrderState.Cancelled || formData.currentStateId === OrderState.Rejected)

      if ((isPaidNow || isCancelledOrRejected) && savedOrderId) {
        try {
          await window.electronAPI?.openOrderInvoice?.(savedOrderId)
        } catch (invoiceErr) {
          console.error("No se pudo abrir el comprobante automáticamente:", invoiceErr)
        }
      }

      dispatch(setOrderToEdit(null))
      setTimeout(() => dispatch(setCurrentTab("orders")), 150)
    } catch (err) {
      console.error("Error al guardar la orden:", err)
      dispatch(setGlobalAlert(err instanceof Error ? err.message : "Error de comunicación con el proceso principal de Electron."))
    }
  }

  if (loadingSession) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-gray-500">Cargando datos de sesión...</p>
      </div>
    )
  }

  const title = !isEditing
    ? "Nueva Orden"
    : `Orden #${initialOrder?.id}${canEditDetails ? "" : " (solo lectura)"}`

  const subtitle = !isEditing
    ? "Ingresá los datos necesarios para registrar una nueva orden."
    : canEditDetails
    ? "Mientras la orden esté en borrador podés modificar sus datos."
    : orderStateId === OrderState.Created
    ? "La orden es un borrador del vendedor: no podés modificar sus datos, pero sí cambiar su estado."
    : "La orden ya fue confirmada: los datos y los ítems no se pueden modificar."

  const statusHistory = (initialOrder as any)?.statusHistory ?? []
  const disabledFieldClass = "cursor-not-allowed opacity-60 bg-gray-100 dark:bg-zinc-800"
  const addressDisabled = !canEditDetails || formData.clientId <= 0
  
  const isCancelledOrRejectedState = orderStateId === OrderState.Cancelled || orderStateId === OrderState.Rejected

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>

        <div className="flex gap-2">
          {showInvoice && hasInvoice && isCancelledOrRejectedState ? (
            <>
              <button
                type="button"
                onClick={() => handleViewInvoice('invoice')}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Ver factura original
              </button>
              <button
                type="button"
                onClick={() => handleViewInvoice('credit-note')}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Ver nota de crédito
              </button>
            </>
          ) : showInvoice ? (
            <button
              type="button"
              onClick={() => handleViewInvoice()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Ver comprobante
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
          >
            ← Volver
          </button>
        </div>
      </div>

      {SHOW_DEBUG && (
        <pre className="rounded bg-yellow-100 p-2 text-xs text-black">
          {JSON.stringify(debugInfo, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)}
        </pre>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col gap-6 shadow-sm"
      >
        {/* Selector de Tipo de Factura y Método de Pago permanente (Bloqueados si ya tiene factura / está pagada) */}
        {hasInvoice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-4 border border-gray-200 dark:border-white/10">
              <label className={labelClass}>Tipo de Factura (Bloqueado)</label>
              <select
                value={formData.invoiceType}
                disabled={true}
                className={`${inputClass} bg-white dark:bg-zinc-900 ${disabledFieldClass}`}
              >
                <option value="B" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Factura B (Consumidor Final / Monotributo)</option>
                <option value="A" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Factura A (Responsable Inscripto - IVA 21%)</option>
              </select>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-4 border border-gray-200 dark:border-white/10">
              <label className={labelClass}>Método de Pago (Bloqueado)</label>
              <select
                value={formData.paymentMethod}
                disabled={true}
                className={`${inputClass} bg-white dark:bg-zinc-900 ${disabledFieldClass}`}
              >
                <option value="Efectivo" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Efectivo</option>
                <option value="Transferencia" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Transferencia</option>
                <option value="Tarjeta de Débito" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Tarjeta de Débito</option>
                <option value="Tarjeta de Crédito" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Tarjeta de Crédito</option>
              </select>
            </div>
          </div>
        )}

        {allowedNextStates.length > 0 && (
          <div className="rounded-xl bg-blue-50/50 p-4 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300">Cambio de estado</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Estado</label>
                <select
                  value={formData.currentStateId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currentStateId: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={orderStateId} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                    {getStateLabel(orderStateId)} (actual)
                  </option>
                  {allowedNextStates.map((stateId) => (
                    <option key={stateId} value={stateId} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                      {STATE_LABELS[stateId]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Si estamos transicionando a Paid y aún no tenía factura */}
              {isTargetStatePaid && !hasInvoice && (
                <>
                  <div>
                    <label className={labelClass}>Tipo de Factura <span className="text-red-500">*</span></label>
                    <select
                      value={formData.invoiceType}
                      disabled={isInvoiceLocked}
                      onChange={(e) => setFormData((prev) => ({ ...prev, invoiceType: e.target.value as 'A' | 'B' }))}
                      className={`${inputClass} bg-white dark:bg-zinc-900 ${isInvoiceLocked ? disabledFieldClass : ""}`}
                    >
                      <option value="B" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                        Factura B (Consumidor Final / Monotributo)
                      </option>
                      <option value="A" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                        Factura A (Responsable Inscripto - IVA 21%)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Método de Pago <span className="text-red-500">*</span></label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                      className={`${inputClass} bg-white dark:bg-zinc-900`}
                    >
                      <option value="Efectivo" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Efectivo</option>
                      <option value="Transferencia" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Transferencia</option>
                      <option value="Tarjeta de Débito" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Tarjeta de Débito</option>
                      <option value="Tarjeta de Crédito" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Tarjeta de Crédito</option>
                    </select>
                  </div>
                </>
              )}

              {nextStateNeedsTracking && (
                <div>
                  <label className={labelClass}>Número de seguimiento (tracking)</label>
                  <input
                    type="text"
                    value={formData.trackingNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                    placeholder="Ej. TRK-98234123"
                    className={inputClass}
                    required
                  />
                </div>
              )}
            </div>

            {stateChanged && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isLogisticsRole(role) && (
                  <div>
                    <label className={labelClass}>Ubicación física actual (opcional)</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="Ej. Depósito Central Corrientes"
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>
                    {nextStateNeedsReason ? "Motivo (obligatorio)" : "Observaciones (opcional)"}
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={nextStateNeedsReason ? "Ej. Sin stock del producto" : "Ej. Paquete listo para transporte"}
                    className={inputClass}
                    required={nextStateNeedsReason}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {!isEditing && initialStateOptions.length > 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Estado inicial</label>
              <select
                value={initialStateId}
                onChange={(e) => setInitialStateId(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                {initialStateOptions.map((stateId) => (
                  <option key={stateId} value={stateId} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                    {STATE_LABELS[stateId]}
                  </option>
                ))}
              </select>
            </div>

            {isInitialStatePaid && (
              <>
                <div>
                  <label className={labelClass}>Tipo de Factura <span className="text-red-500">*</span></label>
                  <select
                    value={formData.invoiceType}
                    disabled={isInvoiceLocked}
                    onChange={(e) => setFormData((prev) => ({ ...prev, invoiceType: e.target.value as 'A' | 'B' }))}
                    className={`${inputClass} bg-white dark:bg-zinc-900 ${isInvoiceLocked ? disabledFieldClass : ""}`}
                  >
                    <option value="B" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                      Factura B (Consumidor Final / Monotributo)
                    </option>
                    <option value="A" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                      Factura A (Responsable Inscripto - IVA 21%)
                    </option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Método de Pago <span className="text-red-500">*</span></label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                    className={`${inputClass} bg-white dark:bg-zinc-900`}
                  >
                    <option value="Efectivo" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Efectivo</option>
                    <option value="Transferencia" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Transferencia</option>
                    <option value="Tarjeta de Débito" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Tarjeta de Débito</option>
                    <option value="Tarjeta de Crédito" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">Tarjeta de Crédito</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="relative w-full">
            <label className={labelClass}>Cliente</label>
            <input
              type="text"
              disabled={!canEditDetails}
              className={`${inputClass} ${!canEditDetails ? disabledFieldClass : ""}`}
              placeholder="Buscar cliente por nombre o DNI..."
              value={searchTermClients}
              onChange={(e) => setSearchTermClients(e.target.value)}
              onFocus={() => setIsOpenClients(true)}
              onBlur={() => setTimeout(() => setIsOpenClients(false), 200)}
            />
            {isOpenClients && canEditDetails && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white">
                {clients.length > 0 ? (
                  clients.map((client) => (
                    <li key={String(client.id)}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleClientSelect(client)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
                      >
                        <span>{`${client.name} ${client.lastname}`}</span>
                        <span className="text-xs text-gray-400">#{String(client.id)}</span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-3 text-center text-sm text-gray-500">No se encontraron clientes</li>
                )}
              </ul>
            )}
          </div>

          <div className="relative w-full">
            <label className={labelClass}>Dirección de envío</label>
            <input
              type="text"
              disabled={addressDisabled}
              className={`${inputClass} ${addressDisabled ? disabledFieldClass : ""}`}
              placeholder={formData.clientId > 0 ? "Buscar dirección..." : "Seleccioná un cliente primero"}
              value={searchTermAddress}
              onChange={(e) => setSearchTermAddress(e.target.value)}
              onFocus={() => setIsOpenAddress(true)}
              onBlur={() => setTimeout(() => setIsOpenAddress(false), 200)}
            />
            {isOpenAddress && !addressDisabled && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white">
                {addresses.length > 0 ? (
                  addresses.map((address) => (
                    <li key={String(address.id)}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAddressSelect(address)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
                      >
                        <span>{`${address.street} ${address.number}`}</span>
                        <span className="text-xs text-gray-400">#{String(address.id)}</span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-3 text-center text-sm text-gray-500">
                    No se encontraron direcciones para este cliente
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ítems de la orden</h2>
            {canEditDetails && (
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                + Agregar ítem
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="w-28 px-4 py-3">Cantidad</th>
                  <th className="w-36 px-4 py-3">Precio unit.</th>
                  <th className="w-32 px-4 py-3 text-right">Subtotal</th>
                  <th className="w-12 px-4 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {items.map((item) => (
                  <ItemOrder
                    key={item.id}
                    item={item}
                    disabled={!canEditDetails}
                    isOnlyItem={items.length === 1 || !canEditDetails}
                    selectedProductIds={items.map((i) => i.productId).filter((id) => id > 0)}
                    onUpdateItem={handleUpdateItem}
                    onRemoveItem={handleRemoveItem}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-4 text-base font-bold text-gray-900 dark:text-white">
              <span>Total:</span>
              <span className="text-xl text-blue-600 dark:text-blue-400">
                ${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <StatusTimeline history={statusHistory} />

        <div className="flex justify-end gap-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {canSubmit ? "Cancelar" : "Volver a la lista"}
          </button>

          {canSubmit && (
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              {isEditing ? "Guardar cambios" : "Guardar orden"}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function StatusTimeline({ history }: { history: any[] }) {
  if (history.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Historial de seguimiento</h2>

      <div className="relative border-l-2 border-blue-500 ml-3 flex flex-col gap-6 pl-6 py-2">
        {history.map((event) => (
          <div key={String(event.id)} className="relative">
            <span className="absolute -left-[31px] top-1.5 h-4 w-4 rounded-full bg-blue-600 ring-4 ring-white dark:ring-zinc-900" />

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
              <span className="font-semibold text-gray-900 dark:text-white">
                {getStateLabel(Number(event.stateId), event.stateName)}
              </span>
              <span className="text-xs text-gray-400">
                {event.createdAt ? new Date(event.createdAt).toLocaleString("es-AR") : ""}
              </span>
            </div>

            {event.notes && (
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">{event.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}