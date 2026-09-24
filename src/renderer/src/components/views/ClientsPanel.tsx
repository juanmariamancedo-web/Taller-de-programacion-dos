import { useEffect, useState } from 'react'
import Paginacion from '../Pagination'
import Search from '../Search'
import { Sort } from '../Sort'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setClientToEdit, setCurrentTab } from '../../store/slices/appSlice'
import type { ClientListItem } from '../../../../main/domain/types/electron-env'

export default function ClientsPanel() {
  const dispatch = useAppDispatch()
  const { page, search, sort } = useAppSelector((state) => state.app)
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const session = useAppSelector(store => store.app.session)
  
  useEffect(() => {
    const loadClients = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electronAPI?.getClients({ search, page, sort })
        if (!response?.success) throw new Error(response?.error ?? 'No se pudieron cargar los clientes.')
        setClients(response.data ?? [])
        setTotal(response.total ?? 0)
      } catch (loadError) {
        console.error('Error al cargar clientes:', loadError)
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los clientes.')
      } finally {
        setLoading(false)
      }
    }

    loadClients()
  }, [page, search, sort])

  const handleSetClientStatus = async (client: ClientListItem, isActive: boolean) => {
    const actionText = isActive ? 'dar de alta' : 'dar de baja'
    const confirmationMessage = isActive
      ? `¿Deseás dar de alta al cliente ${client.name} ${client.lastname}?`
      : `¿Deseás dar de baja al cliente ${client.name} ${client.lastname}?`

    if (!window.confirm(confirmationMessage)) return

    try {
      const response = await window.electronAPI?.setClientStatus({ id: client.id, isActive })
      if (!response?.success) throw new Error(response?.error ?? `No se pudo ${actionText} al cliente.`)
      setClients((currentClients) => currentClients.map((currentClient) =>
        currentClient.id === client.id ? { ...currentClient, isActive } : currentClient
      ))
    } catch (statusError) {
      console.error(`Error al ${actionText} al cliente:`, statusError)
      setError(statusError instanceof Error ? statusError.message : `No se pudo ${actionText} al cliente.`)
    }
  }

  const handleEdit = (client: ClientListItem) => {
    dispatch(setClientToEdit(client))
    dispatch(setCurrentTab('clients-create'))
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 pb-6 lg:pb-8">
        <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-bold">Clientes</h1>
        {session && (session.roleId == 1 || session.roleId == 3) && (
          <button
            type="button"
            onClick={() => {
              dispatch(setClientToEdit(null))
              dispatch(setCurrentTab('clients-create'))
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
          >
            <span className="text-xl leading-none">+</span>
            Agregar cliente
          </button>
        )}
      </div>

      <div className="min-w-full"><Search /></div>
      {error && <div role="alert" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[820px] bg-black/5 text-sm text-gray-900 dark:bg-white/5 dark:text-white">
          <thead className="bg-gray-100 dark:bg-white/10">
            <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
              <th className="px-4 py-3"><Sort className="" serverArg="id" name="ID" /></th>
              <th className="px-4 py-3"><Sort className="" serverArg="name" name="Nombre" /></th>
              <th className="px-4 py-3">CUIT/CUIL</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Provincia</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Código postal</th>
              <th className="px-4 py-3">Estado</th>
                {session && session.roleId == 1 && //los vendedores no pueden editar las ordenes, una vez emetidas                
                  <>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Editar</th>
                  </>
                }
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {loading ? (
              <tr><td colSpan={10} className="py-6 text-center text-gray-500">Cargando clientes...</td></tr>
            ) : clients.length ? clients.map((client) => (
              <tr key={client.id} className="transition hover:bg-gray-50 dark:hover:bg-white/5">
                <td className="px-4 py-3 font-medium">#{client.id}</td>
                <td className="px-4 py-3">{client.name} {client.lastname}</td>
                <td className="px-4 py-3">{client.cuil}</td>
                <td className="px-4 py-3">{client.email}</td>
                <td className="px-4 py-3">{client.address?.province ?? 'Sin dirección'}</td>
                <td className="px-4 py-3">{client.address?.city ?? 'Sin dirección'}</td>
                <td className="px-4 py-3">{client.address?.postalCode ?? '-'}</td>
                <td className={`px-4 py-3 font-semibold ${client.isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {client.isActive ? 'Activo' : 'Inactivo'}
                </td>
                <td className="px-4 py-3">
                {session && session.roleId == 1 && //los vendedores no pueden editar las ordenes, una vez emetidas                
                  <div className="flex items-center gap-2">
                    {client.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleSetClientStatus(client, false)}
                        title="Dar de baja"
                        className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                      >
                        Baja
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetClientStatus(client, true)}
                        title="Dar de alta"
                        className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200"
                      >
                        Alta
                      </button>
                    )}
                  </div>
                }
                </td>
                {session && session.roleId == 1 && //los vendedores no pueden editar las ordenes, una vez emetidas                
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(client)}
                      title={`Editar a ${client.name} ${client.lastname}`}
                      aria-label={`Editar a ${client.name} ${client.lastname}`}
                      className="rounded-lg bg-blue-100 px-3 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300"
                    >
                      Editar
                    </button>
                  </td>
                }
              </tr>
            )) : (
              <tr><td colSpan={10} className="py-6 text-center text-gray-500">No hay clientes encontrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginacion paginas={Math.ceil(total / 5)} />
    </div>
  )
}
