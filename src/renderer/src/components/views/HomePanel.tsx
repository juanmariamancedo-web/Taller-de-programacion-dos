import { setCurrentTab } from "./../../store/slices/appSlice"
import { useAppDispatch } from "./../../store/hooks"
import { useEffect, useState } from "react"
import { OrderWithState, TopProduct } from "../../../../main/domain/types/electron-env"

export default function HomePanel() {
    const dispatch = useAppDispatch()
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Estado de sesión
    const [session, setSession] = useState<{ id?: number; roleId?: number; roleName?: string } | null>(null)

    // Métricas del Dashboard
    const [averageTicket, setAverageTicket] = useState(0)
    const [totalClients, setTotalClients] = useState(0)
    const [totalPedidosPendientes, setTotalPedidosPendientes] = useState(0)
    const [totalPedidosEntregados, setTotalPedidosEntregados] = useState(0)
    const [lastOrders, setLastOrders] = useState<OrderWithState[]>([])
    const [topProducts, setTopProducts] = useState<TopProduct[]>([])

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setIsLoading(true)

                // 1. Obtener sesión activa para saber el rol
                const sessionData = await window.electronAPI?.getSession?.()
                if (sessionData) {
                    setSession({
                        ...sessionData,
                        id: Number(sessionData.id),
                        roleId: Number(sessionData.roleId),
                    })
                }

                // 2. Obtener datos del dashboard
                const response = await window.electronAPI?.getDashboardData()
                
                if (response?.success && response.data) {
                    setAverageTicket(response.data.averageTicket)
                    setTotalClients(response.data.registeredClients)
                    setTotalPedidosPendientes(response.data.pendingOrders)
                    setTotalPedidosEntregados(response.data.deliveredOrders)
                    setLastOrders(response.data.lastOrders)
                    setTopProducts(response.data.topProducts)
                } else {
                    setError(response?.message || "Error al obtener datos")
                }
            } catch (err) {
                setError('Error de comunicación con Electron')
            } finally {
                setIsLoading(false)
            }
        }

        fetchDashboardData()
    }, [])

    const roleName = session?.roleName?.toLowerCase() || ''
    const roleId = Number(session?.roleId)

    const isAdmin = roleName === 'admin' || roleId === 1
    const isSupervisor = roleName === 'supervisor' || roleId === 2
    const isVendedor = roleName === 'seller' || roleName === 'vendedor' || roleId === 3
    const isOperador = roleName === 'operator' || roleName === 'operador' || roleId === 4

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <p className="text-sm text-gray-500">Cargando panel principal...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-96 items-center justify-center">
                <p className="text-sm text-red-500">{error}</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4">
            {/* Cabecera personalizada por Rol */}
            <div className="w-full flex justify-between items-center pb-6 lg:pb-10">
                <h1 className="text-gray-900 dark:text-white text-2xl md:text-3xl lg:text-4xl font-bold">
                    {isAdmin && "Dashboard General (Administrador)"}
                    {isSupervisor && "Dashboard de Supervisión"}
                    {isVendedor && "Panel de Ventas"}
                    {isOperador && "Panel de Operaciones y Logística"}
                </h1>
                <span className="text-xs uppercase px-3 py-1 rounded-full font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Rol: {session?.roleName || 'Usuario'}
                </span>
            </div>

            <div className="flex flex-col gap-6 w-full">
                {/* Tarjetas de Métricas (Varían según el rol) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Tarjeta 1: Pedidos Pendientes (Visible para todos) */}
                    <section className="flex flex-col justify-between rounded-xl bg-black/5 p-5 text-gray-900 dark:bg-white/5 dark:text-white border border-gray-200 dark:border-white/10 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Pedidos Pendientes
                        </h2>
                        <span className="font-bold text-3xl mt-4 text-blue-600 dark:text-blue-400">
                            {totalPedidosPendientes}
                        </span>
                    </section>

                    {/* Tarjeta 2: Ticket Medio (Oculto para Operadores) */}
                    {!isOperador && (
                        <section className="flex flex-col justify-between rounded-xl bg-black/5 p-5 text-gray-900 dark:bg-white/5 dark:text-white border border-gray-200 dark:border-white/10 shadow-sm">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Ticket Medio
                            </h2>
                            <span className="font-bold text-3xl mt-4 text-emerald-600 dark:text-emerald-400">
                                ${averageTicket.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                        </section>
                    )}

                    {/* Tarjeta 3: Clientes Registrados */}
                    <section className="flex flex-col justify-between rounded-xl bg-black/5 p-5 text-gray-900 dark:bg-white/5 dark:text-white border border-gray-200 dark:border-white/10 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Clientes Registrados
                        </h2>
                        <span className="font-bold text-3xl mt-4 text-purple-600 dark:text-purple-400">
                            {totalClients}
                        </span>
                    </section>

                    {/* Tarjeta 4: Pedidos Entregados */}
                    <section className="flex flex-col justify-between rounded-xl bg-black/5 p-5 text-gray-900 dark:bg-white/5 dark:text-white border border-gray-200 dark:border-white/10 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Pedidos Entregados
                        </h2>
                        <span className="font-bold text-3xl mt-4 text-sky-600 dark:text-sky-400">
                            {totalPedidosEntregados}
                        </span>
                    </section>
                </div>

                {/* Secciones Inferiores */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sección Últimos Pedidos */}
                    <section className="lg:col-span-2 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-white/10 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {isOperador ? "Gestión de Envíos y Logística Reciente" : "Últimos Pedidos"}
                            </h2>
                            <button
                                className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                                onClick={() => dispatch(setCurrentTab("orders"))}
                            >
                                Ver todos →
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                <thead className="bg-gray-50 dark:bg-white/[0.02] text-xs uppercase text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">Pedido</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        {!isOperador && <th className="px-4 py-3">Total</th>}
                                        <th className="px-4 py-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                                    {lastOrders?.length ? (
                                        lastOrders.map((order) => (
                                            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                    #{order.id}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                    {`${order.client?.name ?? 'Sin'} ${order.client?.lastname ?? 'cliente'}`}
                                                </td>
                                                {!isOperador && (
                                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                        ${Number(order.total).toLocaleString('es-AR')}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                        order.currentState?.name === "delivered" || order.currentState?.name === "completed"
                                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                            : order.currentState?.name === "pending"
                                                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                    }`}>
                                                        {order.currentState?.name ?? 'Desconocido'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={isOperador ? 3 : 4} className="text-center py-6 text-gray-500">
                                                No hay órdenes registradas
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Sección Top Productos (Oculto o adaptado para operadores si se prefiere) */}
                    <section className="flex flex-col bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-white/10 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Top Productos
                            </h2>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                <thead className="bg-gray-50 dark:bg-white/[0.02] text-xs uppercase text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">Pos</th>
                                        <th className="px-4 py-3">Nombre</th>
                                        <th className="px-4 py-3">Vendidos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                                    {topProducts.length > 0 ? (
                                        topProducts.map((product, index) => (
                                            <tr key={product.id ?? index} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                    #{index + 1}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                                                    {product.name}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-semibold">
                                                    {product.totalSold} u.
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="text-center py-6 text-gray-500">
                                                Sin datos de ventas
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}