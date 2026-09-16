import { useEffect, useState } from 'react'
import { useAppDispatch } from '../../store/hooks'
import { setCurrentTab } from '../../store/slices/appSlice'
import type { ClientListItem } from '../../../../main/domain/types/electron-env'
import OrderSuccess from '../SuccessCreateOrder'
import { useSeletedAddressOnOrder } from '../../hooks/useSeletedAddressOnOrder'
import useSeletedUserOnOrder from '../../hooks/useSeletedUserOnOrder'

export default function OrderForm() {
  const [success, setSuccess] = useState(false)
  const dispatch = useAppDispatch()

  const [formData, setFormData] = useState({
    clientId: 0,
    shippingAddressId: 0,
  })

  // Clientes
  const {clients, searchTermClients, setSearchTermClients, isOpenClients, setIsOpenClients} = useSeletedUserOnOrder()

  // Direcciones
  const {addresses, searchTermAddress, setSearchTermAddress, isOpenAddress, setIsOpenAddress} = useSeletedAddressOnOrder(formData);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccess(true)
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

  function onReset() {
    setFormData({
      clientId: 0,
      shippingAddressId: 0,
    })
    setSearchTermClients("")
    setSearchTermAddress("")
    setSuccess(false)
  }

  function onNavigateBack() {
    dispatch(setCurrentTab("orders"))
  }

  if (success) {
    return <OrderSuccess onReset={onReset} clientName={""} orderId={11} onNavigateBack={onNavigateBack} />
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

      {/* Formulario */}
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
              />

              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>

            {isOpenClients && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-slate-900 dark:text-white">
                {clients.length > 0 ? (
                  clients.map((client) => {
                    const isSelected = Number(formData.clientId) === Number(client.id);
                    return (
                      <li
                        key={String(client.id)}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            clientId: Number(client.id),
                            shippingAddressId: 0 // Resetea la dirección al cambiar de cliente
                          }));
                          setSearchTermClients(`${client.name} ${client.lastname}`);
                          setSearchTermAddress(""); // Resetea el input de dirección
                          setIsOpenClients(false);
                        }}
                        className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 ${
                          isSelected ? 'bg-slate-50 font-semibold text-blue-600 dark:bg-zinc-800/60 dark:text-blue-400' : ''
                        }`}
                      >
                        <span>{`${client.name} ${client.lastname}`}</span>
                        <span className="text-xs text-slate-400">#{String(client.id)}</span>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                    No se encontraron clientes
                  </li>
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
                placeholder={formData.clientId ? "Buscar dirección..." : "Selecciona un cliente primero"}
                value={searchTermAddress}
                onChange={(e) => setSearchTermAddress(e.target.value)}
                onFocus={() => formData.clientId && setIsOpenAddress(true)}
              />

              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>

            {isOpenAddress && formData.clientId > 0 && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-slate-900 dark:text-white">
                {addresses.length > 0 ? (
                  addresses.map((ubic) => {
                    const isSelected = Number(formData.shippingAddressId) === Number(ubic.id);
                    const labelAddress = `${ubic.street} ${ubic.number}${ubic.city?.name ? `, ${ubic.city.name}` : ''}`;

                    return (
                      <li
                        key={String(ubic.id)}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            shippingAddressId: Number(ubic.id)
                          }));
                          setSearchTermAddress(labelAddress);
                          setIsOpenAddress(false);
                        }}
                        className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 ${
                          isSelected ? 'bg-slate-50 font-semibold text-blue-600 dark:bg-zinc-800/60 dark:text-blue-400' : ''
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{`${ubic.street} ${ubic.number}`}</span>
                          {ubic.city?.name && (
                            <span className="text-xs text-slate-400 dark:text-zinc-400">
                              {ubic.city.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">#{String(ubic.id)}</span>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                    No se encontraron direcciones para este cliente
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Botones */}
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