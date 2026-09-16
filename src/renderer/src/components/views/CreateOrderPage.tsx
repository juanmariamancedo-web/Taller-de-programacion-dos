import { useEffect, useState } from 'react'
import { useAppDispatch } from '../../store/hooks'
import { setCurrentTab } from '../../store/slices/appSlice'
import UserSuccess from '../UserSucces'
import { Prisma } from '../../../../main/infrastructure/db/generated/client/client'
import type { ClientListItem } from '../../../../main/domain/types/electron-env'

export default function OrderForm() {
    const [success, setSuccess] = useState(false)
    const dispatch = useAppDispatch()

    const [formData, setFormData] = useState({
        clientId: 0,
        shippingAddressId: 0,
    })

    const [roles, setRoles] = useState<Prisma.UserRoleGetPayload<{}>[]>([])
    
    const [clients, setClients] = useState<ClientListItem[]>([])
    const [searchTermClients, setSearchTermClients] = useState("")
    const [isOpenClients, setIsOpenClients] = useState(false)

    const [shippingAddress, setShippingAddress] = useState<Prisma.AddressGetPayload<{}>[]>([])
    const [searchTermAddress, setSearchTermAddress] = useState("")
    const [isOpenAddress, setIsOpenAddress] = useState(false)

    useEffect(()=>{
        async function fetchClients() {
            try {
                const response = await window.electronAPI?.getClients({page: 1, search: searchTermClients, sort: "nameDesc"})
                if (response?.success) {
                    setClients(response.data ?? [])
                }
            } catch (error) {
                console.error('Error al cargar los usuarios:', error)
            }
        }

        fetchClients()
    }, [searchTermAddress])

    useEffect(() => {
        async function fetchRoles() {
            try {
                const response = await window.electronAPI?.getRoles()
                if (response?.success) {
                    setRoles(response.data)
                }
            } catch (error) {
                console.error('Error al cargar los roles:', error)
            }
        }

        fetchRoles()
    }, [])

    useEffect(()=>{
        async function fetchClients() {
            try {
                const response = await window.electronAPI?.getClients({page: 1, search: searchTermClients, sort: "nameDesc"})
                if (response?.success) {
                    setClients(response.data ?? [])
                }
            } catch (error) {
                console.error('Error al cargar los usuarios:', error)
            }
        }

        fetchClients()
    }, [searchTermClients])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value

        setFormData((prev) => ({
        ...prev,
        [name]: name === 'roleId' ? Number(val) : name === 'username' ? val.toString().trim() : val
        }))
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        setSuccess(true)
    }

    const inputClass =
        'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

    function onReset(){
        setFormData({
            clientId: 0,
            shippingAddressId: 0,
        })

        setSuccess(false)
    }

    function onNavigateBack(){
        dispatch(setCurrentTab("orders"))
    }

    if(success){
        return <UserSuccess onReset={onReset} username={"Juancito"} onNavigateBack={onNavigateBack} />
    }

    return (
        <div className="mx-auto max-w-4xl p-6 w-full">
            {/* Encabezado */}
            <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Usuario</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Ingresá los datos necesarios para registrar o modificar la orden.
                    </p>
                </div>
                <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                    onClick={() => dispatch(setCurrentTab("orders"))}
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
                    <div className="relative w-full">
                        <label htmlFor="clientSearch" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Cliente
                        </label>

                        <div className="relative">
                            {/* Input Buscador */}
                            <input
                            id="clientSearch"
                            type="text"
                            className={inputClass}
                            placeholder="Buscar cliente por nombre o DNI..."
                            value={searchTermClients}
                            onChange={(e) => setSearchTermClients(e.target.value)}
                            onFocus={() => setIsOpenClients(true)}
                            />

                            {/* Ícono de Flecha / Lupa */}
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                            </div>
                        </div>

                        {/* Menú Desplegable Flotante */}
                        {isOpenClients && (
                            <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-slate-900 dark:text-white">
                                {clients.length > 0 ? (
                                    clients.map((client) => {
                                        const isSelected = Number(formData.clientId) === Number(client.id);
                                        return (
                                            <li
                                                key={String(client.id)}
                                                onClick={() => {
                                                    setFormData(
                                                        (prev) => ({ ...prev, clientId: Number(client.id) })
                                                    );
                                                    setSearchTermClients(`${client.name} ${client.lastname}`)
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
                    {/* Rol */}
                    <div>
                        <label htmlFor="roleId" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Rol
                        </label>
                        <select
                            id="clientId"
                            name="roleId"
                            value={formData.shippingAddressId}
                            onChange={handleChange}
                            className={inputClass}
                            >
                            {roles.length > 0 &&
                                roles.map((rol) => (
                                    <option
                                        key={String(rol.id)}
                                        value={Number(rol.id)}
                                        className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-white"
                                    >
                                        {rol.name}
                                    </option>
                                ))
                            }
                        </select>
                    </div>
                    {/* Rol */}
                    <div>
                        <label htmlFor="roleId" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Rol
                        </label>
                        <select
                            id="clientId"
                            name="roleId"
                            value={formData.clientId}
                            onChange={handleChange}
                            className={inputClass}
                            >
                            {roles.length > 0 &&
                                roles.map((rol) => (
                                    <option
                                        key={String(rol.id)}
                                        value={Number(rol.id)}
                                        className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-white"
                                    >
                                        {rol.name}
                                    </option>
                                ))
                            }
                        </select>
                    </div>
                </div>
                {/* Botones */}
                <div className="flex justify-end gap-4 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        type="button"
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