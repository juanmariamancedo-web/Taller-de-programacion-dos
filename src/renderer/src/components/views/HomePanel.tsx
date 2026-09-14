import { setCurrentTab } from "./../../store/slices/appSlice"
import { useAppDispatch } from "./../../store/hooks"
import { useEffect, useState } from "react"
import { OrderWithState, TopProduct } from "../../../../main/domain/types/electron-env";
import { Product } from "../../../../main/infrastructure/db/generated/client/client";

export default function HomePanel(){
    const dispatch = useAppDispatch()
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [averageTicket, setAverageTicket] = useState(0)
    const [totalClients, setTotalClients] = useState(0)
    const [totalPedidosPendientes, setTotalPedidosPendientes] = useState(0)
    const [totalPedidosEntregados, setTotalPedidosEntregados] = useState(0)
    const [lastOrders, setLastOrders] = useState<OrderWithState[]>()
    const [topProducts, setTopProducts] = useState<TopProduct[]>([])


    useEffect(()=>{
        const fetchUsers = async () => {
        try {
            setIsLoading(true);
            const response = await window.electronAPI?.getDashboardData();
            
            if (response?.success && response.data) {
                setAverageTicket(response.data.averageTicket)
                setTotalClients(response.data.registeredClients)
                setTotalPedidosPendientes(response.data.pendingOrders)
                setTotalPedidosEntregados(response.data.deliveredOrders)
                setLastOrders(response.data.lastOrders)
                setTopProducts(response.data.topProducts)
            } else {
                setError(response?.message || "");
            }
        } catch (err) {
            setError('Error de comunicación con Electron');
        } finally {
            setIsLoading(false);
        }
    };

    fetchUsers();
    }, [])

    return(
        <div className="flex flex-col items-center">
            <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-bold flex flex-row gap-x-4 pb-6 lg:pb-10">
                Dashboard
            </h1>
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white">
                        <header>
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Pedidos pendientes
                            </h2>
                            <span className="font-bold">
                                {totalPedidosPendientes}
                            </span>
                        </header>

                    </section>

                    <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white">
                        <header>
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Ticket medio
                            </h2>
                            <span className="font-bold">
                                ${averageTicket}
                            </span>
                        </header>
                        
                    </section>
                    <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white">
                        <header>
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Clientes registrados
                            </h2>
                            <span className="font-bold">
                                {totalClients}
                            </span>
                        </header>
                        
                    </section>

                    <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white">
                        <header>
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Pedidos entregados
                            </h2>
                            <span className="font-bold">
                                {totalPedidosEntregados}
                            </span>
                        </header>
                        
                    </section>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <section className="col-span-1 sm:col-span-2 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Últimos pedidos
                            </h2>
                            <button
                                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                                onClick={()=>dispatch(setCurrentTab("orders"))}>
                                Ver todos
                            </button>
                        </div>
                        <table className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white border border-gray-200 dark:border-white/10 overflow-hidden">
                            <thead className="bg-gray-100 dark:bg-white/10">
                                <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                                    <th className="px-4 py-3">Pedido</th>
                                    <th className="px-4 py-3">Cliente</th>
                                    <th className="px-4 py-3">Total</th>
                                    <th className="px-4 py-3">Estado</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-sm">
                                {lastOrders?.length ? (
                                    lastOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                #{order.id}
                                            </td>

                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                {`${order.client.name ?? 'Sin'} ${order.client.lastname ?? 'cliente'}`}
                                            </td>

                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                ${Number(order.total)}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                        order.currentState.name === "completed"
                                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                            : order.currentState.name === "pending"
                                                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                    }`}
                                                >
                                                    {order.currentState.name}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-6 text-gray-500">
                                            No hay órdenes
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                    <section className="col-span-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Top productos
                            </h2>
                        </div>
                        <table className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white border border-gray-200 dark:border-white/10 overflow-hidden">
                            <thead className="bg-gray-100 dark:bg-white/10">
                                <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                                    <th className="px-4 py-3">Posición</th>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-sm">
                                {topProducts.length > 0?
                                    (
                                        topProducts.map((product, index)=>{
                                            return(
                                                <tr>
                                                    <td>
                                                        #{index}
                                                    </td>
                                                    <td>
                                                        {product.name}
                                                    </td>
                                                    <td>
                                                        ${product.totalSold}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) 
                                
                                    :
                                    (
                                        <tr>
                                            <td colSpan={4} className="text-center py-6 text-gray-500">
                                                No hay órdenes
                                            </td>
                                        </tr>
                                    )
                                }
                            </tbody>
                        </table>
                    </section>
                </ div>
            </ div>
        </div>
    )
}