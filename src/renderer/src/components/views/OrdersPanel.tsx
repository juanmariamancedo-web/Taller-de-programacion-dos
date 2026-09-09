import Search from "../Search"
import Paginacion from "../Pagination"
import { Sort } from "../Sort"
import { useEffect, useState } from "react"
import { OrderWithState } from "../../../../main/domain/types/electron-env"

export default function OrdersPage() {
    const [orders, setOrders] = useState<OrderWithState[]>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setIsLoading(true);
                const response = await window.electronAPI?.getOrders({ page: 1, sort: "", search: "" });
                
                if (response?.success && response) {
                    setOrders(response.data || undefined);
                } else {
                    setError(response?.message || "");
                }
            } catch (err) {
                setError('Error de comunicación con Electron');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrders();
    }, []);

    return (
        <>
            <div className="flex flex-col items-center gap-3">
                <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-bold flex flex-row gap-x-4 pb-6 lg:pb-10">
                    Ordenes
                </h1>
                <Search />
                <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                    <table className="w-full min-w-[640px] bg-black/5 dark:bg-white/5 text-sm text-gray-900 dark:text-white">

                        <thead className="bg-gray-100 dark:bg-white/10">
                            <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                                <th className="px-4 py-3">
                                    <Sort   
                                        name="Pedido"
                                        serverArg="pedido"
                                        className=""
                                    />
                                </th>
                                <th className="px-4 py-3">
                                    <Sort 
                                        name="Total"
                                        serverArg="total"
                                        className=""
                                    />
                                </th>
                                <th className="px-4 py-3">
                                    <Sort 
                                        name="Estado"
                                        serverArg="state"
                                        className=""
                                    />
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-sm">
                            {orders?.length ? (
                                orders.map((order) => {   
                                    return (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                #{order.id}
                                            </td>

                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                ${Number(order.total)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                    order.currentState.name === "delivered"
                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                        : order.currentState.name === "paid"
                                                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                }`}>
                                                    {order.currentState.name}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-6 text-gray-500">
                                        No hay órdenes encontradas
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Paginacion paginas={5} />
            </div>
        </>
    )
}