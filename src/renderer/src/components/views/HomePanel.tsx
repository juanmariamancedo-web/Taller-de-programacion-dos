import { setCurrentTab } from "./../../store/slices/appSlice"
import { useAppDispatch } from "./../../store/hooks"
import { useEffect, useState } from "react"
import { DashboardData } from "../../../../main/domain/types/electron-env"

export default function HomePanel(){
    const dispatch = useAppDispatch()
    const [dashboardData, setDashboardData] = useState<DashboardData>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    

    useEffect(() => {
        const fetchHomePanel = async () => {
            try {
                setIsLoading(true);
                const response = await window.electronAPI?.getDashboardData();
                
                if (response && response.success) {
                    // Si la data viene dentro de response.data:
                    setDashboardData(response.data);
                } else {
                    setError(response?.message || "No se pudieron cargar los datos");
                }
            } catch (err) {
                setError("Error de comunicación con Electron");
            } finally {
                setIsLoading(false);
            }
        };

        fetchHomePanel();
    }, []);


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
                                {dashboardData?.pendingOrders}
                            </span>
                        </header>

                    </section>

                    <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white">
                        <header>
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Ticket medio
                            </h2>
                            <span className="font-bold">
                                ${dashboardData?.averageTicket ?? (dashboardData as any)?.averageticket}
                            </span>
                        </header>
                        
                    </section>
                    <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white">
                        <header>
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Clientes registrados
                            </h2>
                            <span className="font-bold">
                                {dashboardData?.registeredClients}
                            </span>
                        </header>
                        
                    </section>

                    <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white">
                        <header>
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Pedidos entregados
                            </h2>
                            <span className="font-bold">
                                {dashboardData?.deliveredOrders}
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
                                {dashboardData?.lastOrders && dashboardData.lastOrders.length > 0 ? (
                                    dashboardData.lastOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                        >
                                            {/* 1. ID del Pedido */}
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                #{order.id}
                                            </td>

                                            {/* 2. Cliente */}
                                            {/* <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                {order.user ? `${order.user.name ?? ''} ${order.user.lastname ?? ''}` : 'Sin cliente'}
                                            </td> */}

                                            {/* 3. Total */}
                                            {/* <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                ${order.total ?? 0}
                                            </td> */}

                                            {/* 4. Estado */}
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-gray-200">
                                                    {order.currentState?.name ?? 'Sin estado'}
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
                    {dashboardData?.topProducts?.length && (
                        <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white col-span-1 flex flex-col gap-3">
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Top 5 productos vendidos
                            </h2>
                            <div className="flex gap-2 flex-col">
                                {dashboardData.topProducts.map((product, index)=>{
                                    return(
                                        
                                        // <Link href={`\\catalogo\\${product.name}`}>
                                            <article>
                                                <h3 className="font-mono">
                                                    {product.name}
                                                </h3>
                                                <span className="font-bold">
                                                    Ranking #{index + 1}
                                                </span>
                                            </article>
                                        // </Link>
                                    )
                                })}
                            </div>
                        </section>
                    )}
                </ div>
            </ div>
        </div>
    )
}