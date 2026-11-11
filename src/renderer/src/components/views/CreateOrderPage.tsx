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
import type { FormOrderItem } from "../../types/FormOrderItem"

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
  invoiceType: 'A' | 'B' | 'EXENTO'
  paymentMethod: string
}

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
  currentStateId: Number(order?.currentStateId ?? order?.currentState?.id ?? OrderState.Created),
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

export default function CreateOrderPage({ initialOrder }: OrderFormProps) {
  const dispatch = useAppDispatch()

  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch((err) => console.error("Error al obtener la sesión activa:", err))
      .finally(() => setLoadingSession(false))
  }, [])

  const role = getRole(session?.roleId, session?.roleName)
  const currentOrderId = initialOrder?.id ? Number(initialOrder.id) : null
  const isEditing = Boolean(currentOrderId)
  
  const orderStateId = Number(
    (initialOrder as any)?.currentStateId ?? initialOrder?.currentState?.id ?? OrderState.Created
  )

  const allowedNextStates = currentOrderId ? getAllowedNextStates(orderStateId, role) : []
  const canEditDetails = !currentOrderId || canEditOrderDetails(orderStateId, role)
  const canSubmit = canEditDetails || allowedNextStates.length > 0

  const hasInvoice = Boolean((initialOrder as any)?.invoiceType)
  const showInvoice = currentOrderId && canViewInvoice(orderStateId, role) && hasInvoice

  const [formData, setFormData] = useState<FormData>(() => buildFormData(initialOrder))
  const [items, setItems] = useState<FormOrderItem[]>([newItem()])
  
  const stateChanged = formData.currentStateId !== orderStateId
  const nextStateNeedsTracking = stateChanged && requiresTracking(formData.currentStateId)
  const nextStateNeedsReason = stateChanged && requiresReason(formData.currentStateId)

  const isTargetStatePaid = formData.currentStateId === OrderState.Paid
  const isInitialStatePaid = !currentOrderId && formData.currentStateId === OrderState.Paid

  const { clients, searchTermClients, setSearchTermClients, isOpenClients, setIsOpenClients } =
    useSeletedUserOnOrder()

  const { addresses, searchTermAddress, setSearchTermAddress, isOpenAddress, setIsOpenAddress } =
    useSeletedAddressOnOrder(formData)

  const initialStateOptions = [
    OrderState.Created,
    ...getAllowedNextStates(OrderState.Created, role).filter(
      (stateId) => stateId === OrderState.Pending || stateId === OrderState.Paid
    ),
  ]

  useEffect(() => {
    setFormData(buildFormData(initialOrder))
    if (!initialOrder?.id) {
      setSearchTermClients("")
      setSearchTermAddress("")
      setItems([newItem()])
      return
    }

    if (initialOrder?.client) {
      setSearchTermClients(`${initialOrder.client.name} ${initialOrder.client.lastname}`)
    }

    const addr = (initialOrder as any)?.shippingAddress
    if (addr) {
      const city = addr.city?.name ? `, ${addr.city.name}` : ""
      setSearchTermAddress(`${addr.street ?? ""} ${addr.number ?? ""}${city}`.trim())
    }

    if (initialOrder) {
      setItems(mapOrderItems(initialOrder))
    }
  }, [initialOrder])

  const handleAddItem = () => {
    if (formData.clientId <= 0) {
      dispatch(setGlobalAlert("Debe seleccionar un cliente antes de agregar ítems."))
      return
    }
    setItems((prev) => [...prev, newItem()])
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)))
  }

  const handleUpdateItem = (id: string, updatedFields: Partial<FormOrderItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item)))
  }

  const handleClientSelect = (client: (typeof clients)[number]) => {
    const newClientId = Number(client.id)
    setFormData((prev) => ({ ...prev, clientId: newClientId, shippingAddressId: -1 }))
    setSearchTermClients(`${client.name} ${client.lastname}`)
    setSearchTermAddress("")
    setIsOpenAddress(false)
    setIsOpenClients(false)
  }

  const handleAddressSelect = (address: (typeof addresses)[number]) => {
    const newAddressId = Number(address.id)
    const cityName = address.city?.name ? `, ${address.city.name}` : ""
    setFormData((prev) => ({ ...prev, shippingAddressId: newAddressId }))
    setSearchTermAddress(`${address.street} ${address.number}${cityName}`)
    setIsOpenAddress(false)
  }

  const handleCancel = () => {
    dispatch(setOrderToEdit(null))
    dispatch(setCurrentTab("orders"))
  }

  const handleViewInvoice = async (docType?: 'invoice' | 'credit-note') => {
    try {
      const response = await window.electronAPI?.openOrderInvoice?.(String(currentOrderId), docType)
      assertSuccess(response, "No se pudo abrir el comprobante.")
    } catch (err) {
      dispatch(setGlobalAlert(err instanceof Error ? err.message : "Error al abrir el comprobante."))
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    
    let finalClientId = formData.clientId
    if (finalClientId <= 0 && searchTermClients.trim().length > 2 && clients.length > 0) {
      const matchedClient = clients.find(c => `${c.name} ${c.lastname}`.toLowerCase().includes(searchTermClients.toLowerCase()))
      if (matchedClient) finalClientId = Number(matchedClient.id)
    }

    let finalAddressId = formData.shippingAddressId
    if (finalAddressId <= 0 && searchTermAddress.trim().length > 2 && addresses.length > 0) {
      const matchedAddress = addresses.find(a => `${a.street} ${a.number}`.toLowerCase().includes(searchTermAddress.toLowerCase()))
      if (matchedAddress) finalAddressId = Number(matchedAddress.id)
    }

    if (canEditDetails) {
      if (!finalClientId || finalClientId <= 0) {
        dispatch(setGlobalAlert("Debe seleccionar un cliente de la lista."))
        return
      }
      if (!finalAddressId || finalAddressId <= 0) {
        dispatch(setGlobalAlert("Debe seleccionar una dirección de la lista."))
        return
      }
      if (items.some((i) => i.productId <= 0)) {
        dispatch(setGlobalAlert("Todos los ítems deben tener un producto seleccionado"))
        return
      }
    }

    const isPayingNow = formData.currentStateId === OrderState.Paid
    if (isPayingNow && !formData.paymentMethod.trim()) {
      dispatch(setGlobalAlert("Debe seleccionar un método de pago."))
      return
    }
    if (nextStateNeedsTracking && !formData.trackingNumber.trim()) {
      dispatch(setGlobalAlert("El número de seguimiento es obligatorio."))
      return
    }
    if (nextStateNeedsReason && !formData.notes.trim()) {
      dispatch(setGlobalAlert("Indicá el motivo del rechazo."))
      return
    }

    setIsSaving(true)
    let generatedOrderId: number | null = currentOrderId

    try {
      const selectedAddress = addresses.find((a) => Number(a.id) === finalAddressId) || (initialOrder as any)?.shippingAddress
      const sellerId = role === "seller" ? Number(session?.id) : Number(initialOrder?.sellerId || session?.id || 0)
      
      const details = {
        clientId: finalClientId,
        shippingAddressId: finalAddressId,
        sellerId,
        // Se envía el total bruto (ej. $245.000) para que el SP lo divida y guarde el neto.
        total: items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0), 
        shippingStreet: selectedAddress?.street ?? "",
        shippingNumber: Number(selectedAddress?.number ?? 0),
        shippingFloor: selectedAddress?.floor ?? null,
        shippingApartment: selectedAddress?.apartment ?? null,
        shippingPostalCode: selectedAddress?.postalCode ?? "",
        shippingCityName: selectedAddress?.city?.name ?? "",
        items: items.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
      }

      if (!currentOrderId) {
        const payload = {
          ...details,
          initialStateId: formData.currentStateId,
          paymentMethod: isPayingNow ? formData.paymentMethod : undefined,
          invoiceType: isPayingNow ? formData.invoiceType : undefined,
        }
        const response = await window.electronAPI?.createOrder?.(payload as any)
        assertSuccess(response, "Error al crear la orden.")
        
        if (response?.orderId) {
          generatedOrderId = Number(response.orderId)
        }
      } else {
        const updateRes = await window.electronAPI?.updateOrder?.({ id: String(currentOrderId), ...details } as any)
        assertSuccess(updateRes, "Error al actualizar los datos.")

        if (formData.currentStateId !== orderStateId) {
          const statePayload = {
            id: String(currentOrderId),
            currentStateId: formData.currentStateId,
            trackingNumber: formData.trackingNumber.trim() || undefined,
            location: formData.location.trim() || undefined,
            notes: formData.notes.trim() || undefined,
            invoiceType: isTargetStatePaid ? formData.invoiceType : undefined,
            paymentMethod: isTargetStatePaid ? formData.paymentMethod : undefined,
          }
          const stateResponse = await window.electronAPI?.updateOrderState?.(statePayload as any)
          assertSuccess(stateResponse, "Error al actualizar el estado de la orden.")
        }
      }

      const isCancelledOrRejected = formData.currentStateId === OrderState.Cancelled || formData.currentStateId === OrderState.Rejected

      if ((isPayingNow || isCancelledOrRejected) && generatedOrderId) {
        try {
          await window.electronAPI?.openOrderInvoice?.(String(generatedOrderId))
        } catch (invoiceErr) {
          console.error("No se pudo abrir el comprobante:", invoiceErr)
        }
      }

      dispatch(setOrderToEdit(null))
      setTimeout(() => dispatch(setCurrentTab("orders")), 150)
    } catch (err) {
      console.error("Error al guardar la orden:", err)
      dispatch(setGlobalAlert(err instanceof Error ? err.message : "Error de comunicación."))
    } finally {
      setIsSaving(false)
    }
  }

  if (loadingSession) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-gray-500">Cargando sesión...</p>
      </div>
    )
  }

  const title = !initialOrder?.id
    ? "Nueva Orden"
    : `Orden #${currentOrderId}${canEditDetails ? "" : " (solo lectura)"}`

  const subtitle = !initialOrder?.id
    ? "Ingresá los datos necesarios para registrar una nueva orden."
    : canEditDetails
    ? "Mientras la orden esté en borrador podés modificar sus datos."
    : orderStateId === OrderState.Created
    ? "La orden es un borrador del vendedor: no podés modificar sus datos, pero sí cambiar su estado."
    : "La orden ya fue confirmada: los datos y los ítems no se pueden modificar."

  const disabledFieldClass = "cursor-not-allowed opacity-60 bg-gray-100 dark:bg-zinc-800"
  const addressDisabled = !canEditDetails || (formData.clientId <= 0 && searchTermClients.trim().length === 0)
  const isCancelledOrRejectedState = orderStateId === OrderState.Cancelled || orderStateId === OrderState.Rejected

  const rawSubtotal = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)
  const isExento = formData.invoiceType === 'EXENTO'
  
  // 1. Calculamos el monto neto (si es exento, dividimos el bruto por 1.21)
  const netAmount = isExento ? Number((rawSubtotal / 1.21).toFixed(2)) : rawSubtotal
  
  // 2. El Total a pagar será el Neto si es exento, o el bruto si es Factura A/B
  const displayTotal = isExento ? netAmount : rawSubtotal

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
              <button type="button" onClick={() => handleViewInvoice('invoice')} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Ver factura original</button>
              <button type="button" onClick={() => handleViewInvoice('credit-note')} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">Ver nota de crédito</button>
            </>
          ) : showInvoice ? (
            <button type="button" onClick={() => handleViewInvoice()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Ver comprobante</button>
          ) : null}

          <button type="button" onClick={handleCancel} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5">
            ← Volver
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col gap-6 shadow-sm">
        
        {hasInvoice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-4 border border-gray-200 dark:border-white/10">
              <label className={labelClass}>Tipo de Factura (Bloqueado)</label>
              <select disabled={true} value={formData.invoiceType} className={`${inputClass} ${disabledFieldClass}`}>
                <option value="B">Factura B</option><option value="EXENTO">Factura B - Sujeto Exento</option><option value="A">Factura A</option>
              </select>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-4 border border-gray-200 dark:border-white/10">
              <label className={labelClass}>Método de Pago (Bloqueado)</label>
              <select disabled={true} value={formData.paymentMethod} className={`${inputClass} ${disabledFieldClass}`}>
                <option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta de Débito">Tarjeta de Débito</option><option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
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
                <select value={formData.currentStateId} onChange={(e) => setFormData((prev) => ({ ...prev, currentStateId: Number(e.target.value) }))} className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value={orderStateId}>{getStateLabel(orderStateId)} (actual)</option>
                  {allowedNextStates.map((stateId) => (<option key={stateId} value={stateId}>{STATE_LABELS[stateId]}</option>))}
                </select>
              </div>
              {isTargetStatePaid && !hasInvoice && (
                <>
                  <div>
                    <label className={labelClass}>Tipo de Factura <span className="text-red-500">*</span></label>
                    <select value={formData.invoiceType} onChange={(e) => setFormData((prev) => ({ ...prev, invoiceType: e.target.value as any }))} className={`${inputClass} bg-white dark:bg-zinc-900`}>
                      <option value="B">Factura B</option><option value="EXENTO">Factura B - Sujeto Exento</option><option value="A">Factura A</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Método de Pago <span className="text-red-500">*</span></label>
                    <select value={formData.paymentMethod} onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))} className={`${inputClass} bg-white dark:bg-zinc-900`}>
                      <option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta de Débito">Tarjeta de Débito</option><option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                    </select>
                  </div>
                </>
              )}
              {nextStateNeedsTracking && (
                <div>
                  <label className={labelClass}>Número de seguimiento</label>
                  <input type="text" value={formData.trackingNumber} onChange={(e) => setFormData(prev => ({...prev, trackingNumber: e.target.value}))} placeholder="Ej. TRK-98234" className={inputClass} required />
                </div>
              )}
            </div>
            {stateChanged && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isLogisticsRole(role) && (
                  <div>
                    <label className={labelClass}>Ubicación (opcional)</label>
                    <input type="text" value={formData.location} onChange={(e) => setFormData(prev => ({...prev, location: e.target.value}))} placeholder="Ej. Depósito Central" className={inputClass} />
                  </div>
                )}
                <div>
                  <label className={labelClass}>{nextStateNeedsReason ? "Motivo (obligatorio)" : "Observaciones (opcional)"}</label>
                  <input type="text" value={formData.notes} onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))} placeholder="Ej. Motivo..." className={inputClass} required={nextStateNeedsReason} />
                </div>
              </div>
            )}
          </div>
        )}

        {!initialOrder?.id && initialStateOptions.length > 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Estado inicial</label>
              <select value={formData.currentStateId} onChange={(e) => setFormData((prev) => ({ ...prev, currentStateId: Number(e.target.value) }))} className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                {initialStateOptions.map((stateId) => (<option key={stateId} value={stateId}>{STATE_LABELS[stateId]}</option>))}
              </select>
            </div>
            {isInitialStatePaid && (
              <>
                <div>
                  <label className={labelClass}>Tipo de Factura <span className="text-red-500">*</span></label>
                  <select value={formData.invoiceType} onChange={(e) => setFormData(prev => ({...prev, invoiceType: e.target.value as any}))} className={`${inputClass} bg-white dark:bg-zinc-900`}>
                    <option value="B">Factura B</option><option value="EXENTO">Factura B - Sujeto Exento</option><option value="A">Factura A</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Método de Pago <span className="text-red-500">*</span></label>
                  <select value={formData.paymentMethod} onChange={(e) => setFormData(prev => ({...prev, paymentMethod: e.target.value}))} className={`${inputClass} bg-white dark:bg-zinc-900`}>
                    <option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta de Débito">Tarjeta de Débito</option><option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
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
              placeholder="Buscar cliente..."
              value={searchTermClients}
              onChange={(e) => setSearchTermClients(e.target.value)}
              onFocus={() => setIsOpenClients(true)}
              onBlur={() => setTimeout(() => setIsOpenClients(false), 200)}
            />
            {isOpenClients && canEditDetails && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white">
                {clients.length > 0 ? clients.map((client) => (
                  <li key={String(client.id)}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleClientSelect(client)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">
                      <span>{`${client.name} ${client.lastname}`}</span>
                      <span className="text-xs text-gray-400">#{String(client.id)}</span>
                    </button>
                  </li>
                )) : (<li className="px-4 py-3 text-center text-sm text-gray-500">No se encontraron clientes</li>)}
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
                {addresses.length > 0 ? addresses.map((address) => (
                  <li key={String(address.id)}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleAddressSelect(address)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">
                      <span>{`${address.street} ${address.number}`}</span>
                      <span className="text-xs text-gray-400">#{String(address.id)}</span>
                    </button>
                  </li>
                )) : (<li className="px-4 py-3 text-center text-sm text-gray-500">No se encontraron direcciones</li>)}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ítems de la orden</h2>
            {canEditDetails && (
              <button type="button" onClick={handleAddItem} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">
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
                  <th className="w-36 px-4 py-3 text-right">Precio unit.</th>
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
                    currentStateId={orderStateId}
                    onUpdateItem={handleUpdateItem}
                    onRemoveItem={handleRemoveItem}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex flex-col items-end gap-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-4">
              <span>Neto {isExento ? 'Exento' : 'Gravado'}: ${netAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              {!isExento && formData.invoiceType === 'A' && (
                <span>IVA (21%): ${(rawSubtotal - (rawSubtotal / 1.21)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-base font-bold text-gray-900 dark:text-white">
              <span>Total:</span>
              <span className="text-xl text-blue-600 dark:text-blue-400">
                ${displayTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <button type="button" onClick={handleCancel} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">
            {canSubmit ? "Cancelar" : "Volver a la lista"}
          </button>

          {canSubmit && (
            <button type="submit" disabled={isSaving} className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar orden"}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}