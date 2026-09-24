import { useEffect, useState } from 'react'
import { useAppDispatch } from '../../store/hooks'
import { setCurrentTab } from '../../store/slices/appSlice'
import OrderSuccess from '../SuccessCreateOrder'
import { useSeletedAddressOnOrder } from '../../hooks/useSeletedAddressOnOrder'
import useSeletedUserOnOrder from '../../hooks/useSeletedUserOnOrder'
import { ItemOrder } from '../ItemOrder'

// Tipado local para los ítems del formulario si no vienen guardados aún en la BD
export interface FormOrderItem {
  id: string
  productId: number
  description: string
  quantity: number
  unitPrice: number
}


export default function OrderForm() {
  const [success, setSuccess] = useState(false)
  const dispatch = useAppDispatch()

  const [formData, setFormData] = useState({
    clientId: -1,
    shippingAddressId: -1,
  })

  // Inicializado con un ítem por defecto para evitar crash por `undefined` al iterar
  const [items, setItems] = useState<FormOrderItem[]>([])

  // Clientes y Direcciones (Hooks)
  const { clients, searchTermClients, setSearchTermClients, isOpenClients, setIsOpenClients } = useSeletedUserOnOrder()
  const { addresses, searchTermAddress, setSearchTermAddress, isOpenAddress, setIsOpenAddress } = useSeletedAddressOnOrder(formData)

  const handleAddItem = () => {
    if(!formData.shippingAddressId){
      return alert("Debe de seleccionar una direccion para el envio")
    }

    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), productId: 0, description: '', quantity: 1, unitPrice: 0 }
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

  // Cómputo del Total
  const totalAmount = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)

  const [errors, setErrors] = useState({
    clientId: "",
    shippingAddressId: "",
    items: ""
  })

  function checkErrors(): boolean {
    const currentErrors = {
      clientId: '',
      shippingAddressId: '',
      items: '',
    }

    let hasErrors = false

    if (items.length === 0) {
      currentErrors.items = 'Debe agregar al menos un item'
      hasErrors = true
    }

    if (formData.clientId === -1) {
      currentErrors.clientId = 'Debe seleccionar un cliente'
      hasErrors = true
    }

    if (formData.shippingAddressId === -1) {
      currentErrors.shippingAddressId = 'Debe seleccionar una dirección'
      hasErrors = true
    }

    setErrors(currentErrors)
    return hasErrors
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if(!checkErrors()){
      setSuccess(true)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

  function onReset() {
    setFormData({ clientId: 0, shippingAddressId: 0 })
    setItems([{ id: crypto.randomUUID(), productId: 0, description: '', quantity: 1, unitPrice: 0 }])
    setSearchTermClients('')
    setSearchTermAddress('')
    setSuccess(false)
  }

  function onNavigateBack() {
    dispatch(setCurrentTab('orders'))
  }

  function handleClientSelect(client: (typeof clients)[number]) {
    setFormData((prev) => ({ ...prev, clientId: Number(client.id), shippingAddressId: -1 }))
    setSearchTermClients(`${client.name} ${client.lastname}`)
    setSearchTermAddress('')
    setIsOpenClients(false)
  }

  if (success) {
    return <OrderSuccess onReset={onReset} clientName={''} orderId={11} onNavigateBack={onNavigateBack} />
  }

  return (
    <div className="mx-auto max-w-4xl p-6 w-full">
      {/* Encabezado */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Nueva Órden</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ingresá los datos necesarios para registrar o modificar la orden.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          onClick={onNavigateBack}
        >
          ← Volver
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-zinc-900"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Selector de Cliente */}
          <div className="relative w-full">
            <label htmlFor="clientSearch" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Cliente
            </label>
            <div className="relative">
             <input
                id="clientSearch"
                type="text"
                className={inputClass}
                placeholder="Buscar cliente por nombre o DNI..."
                value={searchTermClients}
                onChange={(e) => setSearchTermClients(e.target.value)}
                onFocus={() => setIsOpenClients(true)}
                onBlur={() => {
                  // Retrasamos el cierre para permitir el evento click de la lista
                  setTimeout(() => setIsOpenClients(false), 200)
                }}
              />
              {errors.clientId && <p className="text-rose-600 dark:text-rose-300">{errors.clientId}</p>}
            </div>
            {isOpenClients && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-slate-900 dark:text-white">
                {clients.length > 0 ? (
                  clients.map((client) => (
                    <li
                      key={String(client.id)}
                    >
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleClientSelect(client)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-zinc-800"
                      >
                        <span>{`${client.name} ${client.lastname}`}</span>
                        <span className="text-xs text-slate-400">#{String(client.id)}</span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">No se encontraron clientes</li>
                )}
              </ul>
            )}
          </div>

          {/* Selector de Dirección */}
          <div className="relative w-full">
            <label htmlFor="addressSearch" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Dirección de Envío
            </label>
            <div className="relative">
              <input
                id="addressSearch"
                type="text"
                disabled={!formData.clientId}
                className={`${inputClass} ${!formData.clientId ? 'cursor-not-allowed opacity-60' : ''}`}
                placeholder={formData.clientId ? 'Buscar dirección...' : 'Selecciona un cliente primero'}
                value={searchTermAddress}
                onChange={(e) => setSearchTermAddress(e.target.value)}
                onFocus={() => formData.clientId && setIsOpenAddress(true)}
                onBlur={() => {
                  // Retrasamos el cierre para permitir el evento click de la lista
                  setTimeout(() => setIsOpenAddress(false), 200)
                }}
              />
              {errors.shippingAddressId && <p className="text-rose-600 dark:text-rose-300">{errors.shippingAddressId}</p>}
            </div>
            {isOpenAddress && formData.clientId > 0 && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-slate-900 dark:text-white">
                {addresses.length > 0 ? (
                  addresses.map((ubic) => (
                    <li
                      key={String(ubic.id)}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, shippingAddressId: Number(ubic.id) }))
                        setSearchTermAddress(`${ubic.street} ${ubic.number}${ubic.city?.name ? `, ${ubic.city.name}` : ''}`)
                        setIsOpenAddress(false)
                      }}
                      className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-zinc-800"
                    >
                      <span>{`${ubic.street} ${ubic.number}`}</span>
                      <span className="text-xs text-slate-400">#{String(ubic.id)}</span>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                    No se encontraron direcciones para este cliente
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* --- Tabla / Detalle de Productos --- */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Items de la Orden</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              + Agregar Ítem
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              {errors.items && (
                <div className="bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
                  {errors.items}
                </div>
              )}
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-white/[0.02] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="w-28 px-4 py-3">Cantidad</th>
                  <th className="w-36 px-4 py-3">Precio Unit.</th>
                  <th className="w-32 px-4 py-3 text-right">Subtotal</th>
                  <th className="w-12 px-4 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {items.length > 0 &&
                  items.map((item) => (
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

          {/* Resumen de Total */}
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-4 text-base font-bold text-slate-900 dark:text-white">
              <span>Total:</span>
              <span className="text-xl text-blue-600 dark:text-blue-400">
                ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Botones de formulario */}
        <div className="flex justify-end gap-4 border-t border-slate-200 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={onNavigateBack}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  )
}