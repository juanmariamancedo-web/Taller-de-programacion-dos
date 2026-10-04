import { useEffect, useState } from "react"
import { useAppDispatch, useAppSelector } from "../../store/hooks"
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
  const session = useAppSelector((state) => state.app.session)

  // Identificación de rol de usuario
  const roleName = session?.roleName?.toLowerCase() || ''
  const isVendedor = roleName === 'vendedor' || session?.roleId === 3
  const isOperador = roleName === 'operador' || session?.roleId === 2
  const isSupervisor = roleName === 'supervisor' || session?.roleId === 4
  const isAdmin = roleName === 'admin' || session?.roleId === 1

  // Determinar si la orden iniciada ya no está en borrador (Estado ID 1)
  const isAdvancedOrder = Boolean(initialOrder?.id) && Number(initialOrder?.currentState?.id ?? 1) !== 1

  // MODO SOLO LECTURA:
  // 1. Operador viendo detalles generales de la orden.
  // 2. Vendedor consultando una orden que ya avanzó en el flujo logístico.
  const isReadOnlyDetails = Boolean(initialOrder?.id) && (isOperador || (isVendedor && isAdvancedOrder))

  // 1. Estado local de IDs, Estado Logístico y Tracking
  const [formData, setFormData] = useState({
    clientId: initialOrder?.client?.id != null ? Number(initialOrder.client.id) : -1,
    shippingAddressId: initialOrder?.shippingAddressId != null ? Number(initialOrder.shippingAddressId) : -1,
    currentStateId: initialOrder?.currentState?.id != null ? Number(initialOrder.currentState.id) : 1,
    trackingNumber: initialOrder?.trackingNumber || '',
  })

  // 2. Hooks de búsqueda de Clientes y Direcciones
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

  // 3. Ítems de la orden
  const [items, setItems] = useState<FormOrderItem[]>([
    { id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 },
  ])

  // 4. Sincronización al montar/cambiar la orden a editar
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
      setFormData({ clientId: -1, shippingAddressId: -1, currentStateId: 1, trackingNumber: '' })
      setSearchTermClients("")
      setSearchTermAddress("")
      setItems([{ id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 }])
    }
  }, [initialOrder])

  // Handlers para ítems
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

    // Bloqueo directo para Vendedor intentando guardar en solo lectura
    if (isVendedor && isAdvancedOrder) {
      return alert("Esta orden ya fue procesada y se encuentra en modo de solo lectura.")
    }

    // 1. Operador gestionando estado logístico
    if (isOperador && initialOrder?.id) {
      if (formData.currentStateId >= 3 && !formData.trackingNumber.trim()) {
        return alert("El número de seguimiento (tracking) es obligatorio para despachar la orden.")
      }

      try {
        const response = await window.electronAPI?.updateOrderState?.({
          id: String(initialOrder.id),
          currentStateId: formData.currentStateId,
          trackingNumber: formData.trackingNumber,
        })

        if (!response?.success) {
          return alert(response?.message || "Error al actualizar el estado logístico.")
        }

        dispatch(setOrderToEdit(null))
        dispatch(setCurrentTab("orders"))
      } catch (err) {
        console.error("Error al actualizar estado logístico:", err)
        alert("Ocurrió un error inesperado al actualizar el estado de la orden.")
      }
      return
    }

    // 2. Creación / Edición estándar (Vendedor en estado 1, Admin, Supervisor)
    if (formData.clientId <= 0) return alert("Debe seleccionar un cliente")
    if (formData.shippingAddressId <= 0) return alert("Debe seleccionar una dirección")
    if (items.some((i) => i.productId <= 0)) return alert("Todos los ítems deben tener un producto seleccionado")

    const sellerId = isVendedor ? Number(session?.id) : Number(initialOrder?.sellerId || session?.id || 0)

    const payload = {
      clientId: formData.clientId,
      shippingAddressId: formData.shippingAddressId,
      sellerId: sellerId,
      currentStateId: formData.currentStateId,
      trackingNumber: formData.trackingNumber,
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
      dispatch(setCurrentTab("orders"))
    } catch (err) {
      console.error("Error al guardar la orden:", err)
      alert("Error de comunicación con el proceso principal de Electron.")
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"

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
                ? "Actualiza el estado logístico y datos de despacho."
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
        
        {/* Sección de Gestión Logística (Exclusivo para Operador, Supervisor y Admin al editar) */}
        {(isOperador || isSupervisor || isAdmin) && initialOrder?.id && (
          <div className="rounded-xl bg-blue-50/50 p-4 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Estado Logístico
              </label>
              <select
                value={formData.currentStateId}
                onChange={(e) => setFormData((prev) => ({ ...prev, currentStateId: Number(e.target.value) }))}
                className={inputClass}
              >
                <option value={1}>Creada / Pendiente</option>
                <option value={2}>Pagada (Paid)</option>
                <option value={3}>Despachado (Dispatched)</option>
                <option value={4}>En Camino (In Transit)</option>
                <option value={5}>Entregado (Delivered)</option>
                {(isSupervisor || isAdmin) && <option value={6}>Rechazado / Cancelado</option>}
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
                required={isOperador && formData.currentStateId >= 3}
              />
            </div>
          </div>
        )}

        {/* Desplegables de Cliente y Dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Selector de Cliente */}
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

          {/* Selector de Dirección */}
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

        {/* Botones de acción */}
        <div className="flex justify-end gap-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {isVendedor && isAdvancedOrder ? "Volver a la Lista" : "Cancelar"}
          </button>

          {/* Ocultar el botón de submit si el vendedor consulta una orden en solo lectura */}
          {!(isVendedor && isAdvancedOrder) && (
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              {isOperador
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