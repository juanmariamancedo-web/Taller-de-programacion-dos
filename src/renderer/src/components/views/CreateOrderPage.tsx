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

  // 1. Estado local de IDs
  const [formData, setFormData] = useState({
    clientId: initialOrder?.client?.id != null ? Number(initialOrder.client.id) : -1,
    shippingAddressId: initialOrder?.shippingAddressId != null ? Number(initialOrder.shippingAddressId) : -1,
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

      setFormData({ clientId, shippingAddressId })

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
      setFormData({ clientId: -1, shippingAddressId: -1 })
      setSearchTermClients("")
      setSearchTermAddress("")
      setItems([{ id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 }])
    }
  }, [initialOrder])

  // Handlers para ítems
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 },
    ])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateItem = (id: string, updatedFields: Partial<FormOrderItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    )
  }

  // Selección de cliente desde la lista desplegable
  const handleClientSelect = (client: (typeof clients)[number]) => {
    setFormData((prev) => ({ ...prev, clientId: Number(client.id), shippingAddressId: -1 }))
    setSearchTermClients(`${client.name} ${client.lastname}`)
    setSearchTermAddress("")
    setIsOpenClients(false)
  }

  // Selección de dirección desde la lista desplegable
  const handleAddressSelect = (ubic: (typeof addresses)[number]) => {
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

    if (formData.clientId <= 0) return alert("Debe seleccionar un cliente")
    if (formData.shippingAddressId <= 0) return alert("Debe seleccionar una dirección")
    if (items.some((i) => i.productId <= 0)) return alert("Todos los ítems deben tener un producto seleccionado")

    const sellerId = session?.id ? Number(session.id) : 0

    const payload = {
      clientId: formData.clientId,
      shippingAddressId: formData.shippingAddressId,
      sellerId: sellerId,
      total: total,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    }

    try {
      if (initialOrder?.id) {
        await window.electronAPI?.updateOrder?.({
          id: BigInt(initialOrder.id),
          ...payload,
        } as any)
      } else {
        await window.electronAPI?.createOrder?.(payload as any)
      }

      dispatch(setOrderToEdit(null))
      dispatch(setCurrentTab("orders"))
    } catch (err) {
      console.error("Error al guardar la orden:", err)
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {initialOrder?.id ? `Editar Órden #${initialOrder.id}` : "Nueva Órden"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {initialOrder?.id
              ? "Modifica los datos necesarios de la orden existente."
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
        {/* Desplegables de Cliente y Dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Selector de Cliente */}
          <div className="relative w-full">
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Cliente
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="Buscar cliente por nombre o DNI..."
              value={searchTermClients}
              onChange={(e) => setSearchTermClients(e.target.value)}
              onFocus={() => setIsOpenClients(true)}
              onBlur={() => setTimeout(() => setIsOpenClients(false), 200)}
            />
            {isOpenClients && (
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
              disabled={formData.clientId <= 0}
              className={`${inputClass} ${formData.clientId <= 0 ? "cursor-not-allowed opacity-60" : ""}`}
              placeholder={formData.clientId > 0 ? "Buscar dirección..." : "Selecciona un cliente primero"}
              value={searchTermAddress}
              onChange={(e) => setSearchTermAddress(e.target.value)}
              onFocus={() => formData.clientId > 0 && setIsOpenAddress(true)}
              onBlur={() => setTimeout(() => setIsOpenAddress(false), 200)}
            />
            {isOpenAddress && formData.clientId > 0 && (
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

        {/* Tabla de Productos utilizando el componente ItemOrder con su buscador interno */}
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Items de la Orden</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
            >
              + Agregar Ítem
            </button>
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
                    isOnlyItem={items.length === 1}
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
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            {initialOrder?.id ? "Actualizar Orden" : "Guardar Orden"}
          </button>
        </div>
      </form>
    </div>
  )
}