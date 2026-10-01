import { useEffect, useState } from "react"
import { useAppDispatch, useAppSelector } from "../../store/hooks"
import { setCurrentTab, setOrderToEdit } from "../../store/slices/appSlice"
import { OrderWithState } from "../../../../main/domain/types/electron-env"

interface OrderItemState {
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
  
  // Obtener la sesión para extraer sellerId
  const session = useAppSelector((state) => state.app.session)

  // Estado local del formulario
  const [formData, setFormData] = useState({
    clientId: initialOrder?.client?.id != null ? Number(initialOrder.client.id) : -1,
    shippingAddressId: initialOrder?.shippingAddressId != null ? Number(initialOrder.shippingAddressId) : -1,
  })

  // Inputs de búsqueda
  const [searchTermClients, setSearchTermClients] = useState("")
  const [searchTermAddress, setSearchTermAddress] = useState("")

  // Ítems de la orden
  const [items, setItems] = useState<OrderItemState[]>([
    { id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 }
  ])

  // Sincronizar el formulario cuando cambie `initialOrder`
  useEffect(() => {
    if (initialOrder?.id) {
      // 1. IDs principales
      setFormData({
        clientId: initialOrder.client?.id != null ? Number(initialOrder.client.id) : -1,
        shippingAddressId: initialOrder.shippingAddressId != null ? Number(initialOrder.shippingAddressId) : -1,
      })

      // 2. Nombre del cliente
      if (initialOrder.client) {
        setSearchTermClients(`${initialOrder.client.name} ${initialOrder.client.lastname}`)
      }

      // 3. Dirección de envío (si existe)
      const addr = (initialOrder as any).shippingAddress
      if (addr) {
        setSearchTermAddress(`${addr.street ?? ""} ${addr.number ?? ""}`.trim())
      }

      // 4. Cargar ítems de la orden existente
      const orderItems = (initialOrder as any).items
      if (orderItems && orderItems.length > 0) {
        setItems(
          orderItems.map((item: any) => ({
            id: item.id ? String(item.id) : crypto.randomUUID(),
            productId: Number(item.productId ?? item.product?.id ?? 0),
            description: item.description ?? item.product?.name ?? "",
            quantity: Number(item.quantity ?? 1),
            unitPrice: Number(item.unitPrice ?? item.price ?? 0),
          }))
        )
      }
    } else {
      // Modo creación / Limpieza
      setFormData({ clientId: -1, shippingAddressId: -1 })
      setSearchTermClients("")
      setSearchTermAddress("")
      setItems([{ id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 }])
    }
  }, [initialOrder])

  // Handlers para la lista de ítems
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), productId: 0, description: "", quantity: 1, unitPrice: 0 }
    ])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleItemChange = (id: string, field: keyof OrderItemState, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  // Cálculo del total
  const total = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)

  // Cancelar y volver a la vista de órdenes
  const handleCancel = () => {
    dispatch(setOrderToEdit(null))
    dispatch(setCurrentTab("orders"))
  }

  // Enviar / Guardar Orden
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
        // Modo Edición: Se convierte id a BigInt y se completa el DTO esperado
        await window.electronAPI?.updateOrder?.({
          id: BigInt(initialOrder.id),
          ...payload,
        } as any)
      } else {
        // Modo Creación
        await window.electronAPI?.createOrder?.(payload as any)
      }

      dispatch(setOrderToEdit(null))
      dispatch(setCurrentTab("orders"))
    } catch (err) {
      console.error("Error al guardar la orden:", err)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {initialOrder?.id ? `Editar Órden #${initialOrder.id}` : "Nueva Órden"}
          </h1>
          <p className="text-gray-500 text-sm">
            {initialOrder?.id
              ? "Modifica los datos de la orden seleccionada."
              : "Ingresá los datos necesarios para registrar una nueva orden."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
        >
          ← Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col gap-6">
        {/* Fila Cliente / Dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
            <input
              type="text"
              value={searchTermClients}
              onChange={(e) => setSearchTermClients(e.target.value)}
              placeholder="Buscar cliente por nombre o DNI..."
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Dirección de Envío</label>
            <input
              type="text"
              value={searchTermAddress}
              onChange={(e) => setSearchTermAddress(e.target.value)}
              placeholder={formData.clientId === -1 ? "Selecciona un cliente primero" : "Buscar dirección..."}
              disabled={formData.clientId === -1}
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Tabla de Ítems */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Ítems de la Orden</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              + Agregar Ítem
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
            <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-100 dark:bg-white/10 text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2">Producto</th>
                  <th className="px-4 py-2 w-24">Cantidad</th>
                  <th className="px-4 py-2 w-32">Precio Unit.</th>
                  <th className="px-4 py-2 w-32">Subtotal</th>
                  <th className="px-4 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                        placeholder="Buscar producto..."
                        className="w-full rounded-md border border-gray-300 dark:border-white/10 bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, "quantity", Number(e.target.value))}
                        className="w-full rounded-md border border-gray-300 dark:border-white/10 bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, "unitPrice", Number(e.target.value))}
                        className="w-full rounded-md border border-gray-300 dark:border-white/10 bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length === 1}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30"
                      >
                        🗑️️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total y Acciones */}
        <div className="flex flex-col items-end gap-4 border-t border-gray-200 dark:border-white/10 pt-4">
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            Total: <span className="text-blue-600 dark:text-blue-400">${total.toFixed(2)}</span>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {initialOrder?.id ? "Actualizar Órden" : "Guardar Órden"}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}