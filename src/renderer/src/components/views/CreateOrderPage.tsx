import { useEffect, useState } from "react"
import { useAppDispatch } from "../../store/hooks"
import { setCurrentTab, setOrderToEdit } from "../../store/slices/appSlice"
import { OrderWithState } from "../../../../main/domain/types/electron-env"
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




export default function OrderForm({ initialOrder }: OrderFormProps) {
  const dispatch = useAppDispatch()
  
  const [session, setSession] = useState<{ id?: number; roleId?: number; roleName?: string } | null>(null)
  const [loadingSession, setLoadingSession] = useState<boolean>(true)
  
  
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionData = await window.electronAPI?.getSession?.()
        if (sessionData) {
          setSession({
            ...sessionData,
            id: Number(sessionData.id),
            roleId: Number(sessionData.roleId),
          })
        }
      } catch (err) {
        console.error("Error al obtener la sesión activa:", err)
      } finally {
        setLoadingSession(false)
      }
    }
    fetchSession()
  }, [])
  
  const roleName = session?.roleName?.toLowerCase() || ''
  const roleId = Number(session?.roleId)
  
  const isAdmin = roleName === 'admin' || roleId === 1
  const isSupervisor = roleName === 'supervisor' || roleId === 2
  const isVendedor = roleName === 'seller' || roleName === 'vendedor' || roleId === 3
  const isOperador = roleName === 'operator' || roleName === 'operador' || roleId === 4
  
  const isAdvancedOrder = Boolean(initialOrder?.id) && Number(initialOrder?.currentState?.id ?? 1) !== 1
  const isReadOnlyDetails = Boolean(initialOrder?.id) && (isOperador || (isVendedor && isAdvancedOrder))
  
  const currentOrderStateId = Number(initialOrder?.currentState?.id ?? 1)
  
  const [formData, setFormData] = useState({
    clientId: initialOrder?.client?.id != null ? Number(initialOrder.client.id) : -1,
    shippingAddressId: initialOrder?.shippingAddressId != null ? Number(initialOrder.shippingAddressId) : -1,
    currentStateId: currentOrderStateId,
    trackingNumber: initialOrder?.trackingNumber || '',
    location: '',
    notes: '',
  })
  
  const {
    clients,
    searchTermClients,
    setSearchTermClients,
    isOpenClients,
    setIsOpenClients,
  } = useSeletedUserOnOrder()

  const {
    addresses,
    searchTermAddress,
    setSearchTermAddress,
    isOpenAddress,
    setIsOpenAddress,
  } = useSeletedAddressOnOrder(formData)

  const [items, setItems] = useState<FormOrderItem[]>([
    { id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 },
  ])

  useEffect(() => {
    if (initialOrder?.id) {
      const clientId = initialOrder.client?.id != null ? Number(initialOrder.client.id) : -1
      const shippingAddressId = initialOrder.shippingAddressId != null ? Number(initialOrder.shippingAddressId) : -1
      const currentStateId = initialOrder.currentState?.id != null ? Number(initialOrder.currentState.id) : 1
      
      setFormData({
        clientId,
        shippingAddressId,
        currentStateId,
        trackingNumber: initialOrder.trackingNumber || '',
        location: '',
        notes: '',
      })
      
      if (initialOrder.client) {
        setSearchTermClients(`${initialOrder.client.name} ${initialOrder.client.lastname}`)
      }

      const addr = (initialOrder as any).shippingAddress
      if (addr) {
        const city = addr.city?.name ? `, ${addr.city.name}` : ""
        setSearchTermAddress(`${addr.street ?? ""} ${addr.number ?? ""}${city}`.trim())
      }
      
      const orderItems = (initialOrder as any).items ?? (initialOrder as any).itemOrders
      if (orderItems && orderItems.length > 0) {
        setItems(
          orderItems.map((item: any) => ({
            id: item.id ? String(item.id) : crypto.randomUUID(),
            productId: Number(item.productId ?? item.product?.id ?? 0),
            description: item.description ?? item.product?.name ?? "",
            quantity: Number(item.quantity ?? item.amount ?? 1),
            unitPrice: Number(item.unitPrice ?? item.price ?? 0),
          }))
        )
      }
    } else {
      setFormData({ clientId: -1, shippingAddressId: -1, currentStateId: 1, trackingNumber: '', location: '', notes: '' })
      setSearchTermClients("")
      setSearchTermAddress("")
      setItems([{ id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 }])
    }
  }, [initialOrder])

  const handleAddItem = () => {
    if (isReadOnlyDetails) return
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 },
    ])
  }

  const handleRemoveItem = (id: string) => {
    if (isReadOnlyDetails || items.length === 1) return
    setItems((prev) => prev.filter((item) => item.id !== id))
  }
  
  const handleUpdateItem = (id: string, updatedFields: Partial<FormOrderItem>) => {
    if (isReadOnlyDetails) return
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    )
  }

  const handleClientSelect = (client: (typeof clients)[number]) => {
    if (isReadOnlyDetails) return
    setFormData((prev) => ({ ...prev, clientId: Number(client.id), shippingAddressId: -1 }))
    setSearchTermClients(`${client.name} ${client.lastname}`)
    setSearchTermAddress("")
    setIsOpenClients(false)
  }
  
  const handleAddressSelect = (ubic: (typeof addresses)[number]) => {
    if (isReadOnlyDetails) return
    setFormData((prev) => ({ ...prev, shippingAddressId: Number(ubic.id) }))
    const cityName = ubic.city?.name ? `, ${ubic.city.name}` : ""
    setSearchTermAddress(`${ubic.street} ${ubic.number}${cityName}`)
    setIsOpenAddress(false)
  }

  const total = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)

  const handleCancel = () => {
    dispatch(setOrderToEdit(null))
    dispatch(setCurrentTab("orders"))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let currentSession = session
    try {
      const freshSession = await window.electronAPI?.getSession?.()
      if (freshSession) {
        currentSession = {
          ...freshSession,
          id: Number(freshSession.id),
          roleId: Number(freshSession.roleId),
        }
      }
    } catch (err) {
      console.error("Error al refrescar sesión en submit:", err)
    }

    if (isVendedor && isAdvancedOrder) {
      return alert("Esta orden ya fue procesada y se encuentra en modo de solo lectura.")
    }

    const isLogisticsAction = (isOperador || isSupervisor || isAdmin) && Boolean(initialOrder?.id)

    if (isLogisticsAction && initialOrder?.id) {
      if (formData.currentStateId >= 4 && !formData.trackingNumber.trim()) {
        return alert("El número de seguimiento (tracking) es obligatorio al despachar el paquete.")
      }
      
      try {
        // Se envía directamente al backend y este validará si la transición o rol son correctos
        const response = await window.electronAPI?.updateOrderState?.({
          id: String(initialOrder.id),
          currentStateId: formData.currentStateId,
          trackingNumber: formData.trackingNumber.trim(),
          location: formData.location.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        } as any)
        
        if (!response?.success) {
          return alert(response?.message || "Error al actualizar el estado logístico.")
        }

        dispatch(setOrderToEdit(null))
        setTimeout(() => {
          dispatch(setCurrentTab("orders"))
        }, 150)
        return
      } catch (err) {
        console.error("Error al actualizar estado logístico:", err)
        return alert("Ocurrió un error inesperado al actualizar el estado de la orden.")
      }
    }

    if (formData.clientId <= 0) return alert("Debe seleccionar un cliente")
    if (formData.shippingAddressId <= 0) return alert("Debe seleccionar una dirección")
    if (items.some((i) => i.productId <= 0)) return alert("Todos los ítems deben tener un producto seleccionado")

    const sellerId = isVendedor ? Number(currentSession?.id) : Number(initialOrder?.sellerId || currentSession?.id || 0)

    const payload = {
      clientId: formData.clientId,
      shippingAddressId: formData.shippingAddressId,
      sellerId: sellerId,
      currentStateId: formData.currentStateId,
      trackingNumber: formData.trackingNumber,
      location: formData.location.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      total: total,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    }

    try {
      let response: any

      if (initialOrder?.id) {
        response = await window.electronAPI?.updateOrder?.({
          id: String(initialOrder.id),
          ...payload,
        } as any)
      } else {
        response = await window.electronAPI?.createOrder?.(payload as any)
      }
      
      if (!response?.success) {
        return alert(response?.message || "Error al procesar la orden")
      }

      dispatch(setOrderToEdit(null))
      setTimeout(() => {
        dispatch(setCurrentTab("orders"))
      }, 150)
    } catch (err) {
      console.error("Error al guardar la orden:", err)
      alert("Error de comunicación con el proceso principal de Electron.")
    }
  }

  const formatStateLabel = (name: string, stateId: number) => {
    const map: Record<number, string> = {
      1: "Creada / Borrador",
      2: "Pendiente",
      3: "Pagada",
      4: "Despachado",
      5: "En Camino",
      6: "Entregado",
      7: "Rechazado / Cancelado",
      8: "Error de Stock",
    }
    return map[stateId] || name
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"

  const statusHistoryList = (initialOrder as any)?.statusHistory || []
  
  if (loadingSession) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-gray-500">Cargando datos de sesión...</p>
      </div>
    )
  }
  
  const ALL_STATUSES = [
    { id: 1, label: "Creada / Borrador (created)" },
    { id: 2, label: "Pendiente (pending)" },
    { id: 3, label: "Pagada (paid)" },
    { id: 4, label: "Despachado (dispatched)" },
    { id: 5, label: "En Camino (in_transit)" },
    { id: 6, label: "Entregado (delivered)" },
  ]
  
  const sliceStatuses = ALL_STATUSES.slice(currentOrderStateId - 1, currentOrderStateId + 1);
  
  if(currentOrderStateId == 7 || session?.roleId !== 3 && (currentOrderStateId !== 6)){
    sliceStatuses.push({ id: 7, label: "Rechazado / Cancelado (rejected)" })
  }
  
  if((currentOrderStateId == 8 || session?.roleId == 1 || session?.roleId === 2) && currentOrderStateId !== 6){
    sliceStatuses.push({ id: 8, label: "Error de Stock (stock_error)" },)
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {initialOrder?.id
              ? isOperador
                ? `Gestión Logística - Orden #${initialOrder.id}`
                : isVendedor && isAdvancedOrder
                ? `Detalles de Orden #${initialOrder.id} (Solo Lectura)`
                : `Editar Órden #${initialOrder.id}`
              : "Nueva Órden"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {initialOrder?.id
              ? isOperador
                ? "Actualiza el estado logístico, punto geográfico y datos de despacho."
                : isVendedor && isAdvancedOrder
                ? "La orden está en proceso logístico. Podés consultar la información pero no modificarla."
                : "Modifica los datos necesarios de la orden existente."
                : "Ingresá los datos necesarios para registrar una nueva orden."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
        >
          ← Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col gap-6 shadow-sm">
        
        {/* Sección de Gestión Logística: Muestra todos los estados sin restricciones visuales */}
        {(isOperador || isSupervisor || isAdmin) && initialOrder?.id && (
          <div className="rounded-xl bg-blue-50/50 p-4 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
              Actualización de Estado Logístico y Tracking
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Estado Logístico
                </label>
                <select
                  value={formData.currentStateId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currentStateId: Number(e.target.value) }))}
                  className={inputClass}
                >
                  {sliceStatuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Número de Seguimiento (Tracking)
                </label>
                <input
                  type="text"
                  value={formData.trackingNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                  placeholder="Ej. TRK-98234123"
                  className={inputClass}
                  required={isOperador && formData.currentStateId >= 4}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Ubicación Física Actual (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Ej. Depósito Central Corrientes"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Observaciones / Novedad (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ej. Paquete embalado y listo para transporte"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* Desplegables de Cliente y Dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="relative w-full">
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Cliente
            </label>
            <input
              type="text"
              disabled={isReadOnlyDetails}
              className={`${inputClass} ${isReadOnlyDetails ? "cursor-not-allowed opacity-60 bg-gray-100 dark:bg-zinc-800" : ""}`}
              placeholder="Buscar cliente por nombre o DNI..."
              value={searchTermClients}
              onChange={(e) => setSearchTermClients(e.target.value)}
              onFocus={() => !isReadOnlyDetails && setIsOpenClients(true)}
              onBlur={() => setTimeout(() => setIsOpenClients(false), 200)}
            />
            {isOpenClients && !isReadOnlyDetails && (
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
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Dirección de Envío
            </label>
            <input
              type="text"
              disabled={isReadOnlyDetails || formData.clientId <= 0}
              className={`${inputClass} ${(isReadOnlyDetails || formData.clientId <= 0) ? "cursor-not-allowed opacity-60 bg-gray-100 dark:bg-zinc-800" : ""}`}
              placeholder={formData.clientId > 0 ? "Buscar dirección..." : "Selecciona un cliente primero"}
              value={searchTermAddress}
              onChange={(e) => setSearchTermAddress(e.target.value)}
              onFocus={() => !isReadOnlyDetails && formData.clientId > 0 && setIsOpenAddress(true)}
              onBlur={() => setTimeout(() => setIsOpenAddress(false), 200)}
            />
            {isOpenAddress && !isReadOnlyDetails && formData.clientId > 0 && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white">
                {addresses.length > 0 ? (
                  addresses.map((ubic) => (
                    <li key={String(ubic.id)}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAddressSelect(ubic)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
                      >
                        <span>{`${ubic.street} ${ubic.number}`}</span>
                        <span className="text-xs text-gray-400">#{String(ubic.id)}</span>
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

        {/* Tabla de Productos */}
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Items de la Orden</h2>
            {!isReadOnlyDetails && (
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                + Agregar Ítem
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="w-28 px-4 py-3">Cantidad</th>
                  <th className="w-36 px-4 py-3">Precio Unit.</th>
                  <th className="w-32 px-4 py-3 text-right">Subtotal</th>
                  <th className="w-12 px-4 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {items.map((item) => (
                  <ItemOrder
                    key={item.id}
                    item={item}
                    disabled={isReadOnlyDetails}
                    isOnlyItem={items.length === 1 || isReadOnlyDetails}
                    selectedProductIds={items
                      .map((i) => i.productId)
                      .filter((id) => id > 0)}
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

        {/* Historial de Seguimiento / Ubicaciones (Timeline) */}
        {statusHistoryList.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Historial de Seguimiento Logístico
            </h2>
            <div className="relative border-l-2 border-blue-500 ml-3 flex flex-col gap-6 pl-6 py-2">
              {statusHistoryList.map((event: any) => (
                <div key={String(event.id)} className="relative">
                  <span className="absolute -left-[31px] top-1.5 h-4 w-4 rounded-full bg-blue-600 ring-4 ring-white dark:ring-zinc-900" />
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatStateLabel(event.stateName, Number(event.stateId))}
                    </span>
                    <span className="text-xs text-gray-400">
                      {event.createdAt ? new Date(event.createdAt).toLocaleString('es-AR') : ''}
                    </span>
                  </div>

                  {event.notes && (
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">
                      {event.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end gap-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {isVendedor && isAdvancedOrder ? "Volver a la Lista" : "Cancelar"}
          </button>

          {!(isVendedor && isAdvancedOrder) && (
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              {initialOrder?.id && (isOperador || isSupervisor || isAdmin)
                ? "Actualizar Estado Logístico"
                : initialOrder?.id
                ? "Actualizar Orden"
                : "Guardar Orden"}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}