import Search from "../Search"
import Paginacion from "../Pagination"
import { Sort } from "../Sort"
import { useEffect, useState } from "react"
import { OrderWithState } from "../../../../main/domain/types/electron-env"
import { useAppDispatch, useAppSelector } from "../../store/hooks"
import { setCurrentTab, setOrderToEdit } from "../../store/slices/appSlice"

export default function OrdersPage() {
    const [orders, setOrders] = useState<OrderWithState[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pages, setPages] = useState(1);

    const dispatch = useAppDispatch();

    const sort = useAppSelector((store) => store.app.sort);
    const search = useAppSelector((store) => store.app.search);
    const page = useAppSelector((store) => store.app.page);
    const session = useAppSelector((store) => store.app.session);

    // Normalizar roles de usuario
    const roleName = session?.roleName?.toLowerCase() || '';
    const isVendedor = roleName === 'seller' || session?.roleId === 3;
    const isOperador = roleName === 'operator' || session?.roleId === 4;
    const isSupervisor = roleName === 'supervisor' || session?.roleId === 2;
    const isAdmin = roleName === 'admin' || session?.roleId === 1;

    // Permisos por módulo
    const canCreateOrder = isVendedor || isAdmin;
    const canManageOrders = isOperador || isSupervisor || isAdmin || isVendedor;

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await window.electronAPI?.getOrders({ page, sort, search });
                
                if (response?.success && response.data) {
                    setPages(response.totalPages ?? 1);
                    setOrders(response.data);
                } else {
                    setError(response?.message || "No se pudieron obtener las órdenes");
                }
            } catch (err) {
                setError('Error de comunicación con Electron');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrders();
    }, [search, sort, page]);

    const handleEdit = (order: OrderWithState) => {
        dispatch(setOrderToEdit(order));
        dispatch(setCurrentTab("order-create"));
    };

    const handleCreateNew = () => {
        dispatch(setOrderToEdit(null));
        dispatch(setCurrentTab("order-create"));
    };

    // Permite abrir el panel a Vendedor, Operador, Supervisor y Admin
    const canEditSpecificOrder = (_order: OrderWithState) => {
        if (isAdmin || isSupervisor || isOperador || isVendedor) return true;
        return false;
    };

    return (
        <div className="flex flex-col items-center gap-3 w-full">
            <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 pb-6 lg:pb-8">
                <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-bold">
                    {isVendedor ? "Mis Órdenes" : isOperador ? "Despacho y Logística" : "Órdenes"}
                </h1>

                {canCreateOrder && (
                    <button
                        type="button"
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 shadow-sm"
                    >
                        <span className="text-xl leading-none">+</span>
                        Agregar Orden
                    </button>
                )}
            </div>

            <Search />

            {error && <p className="text-rose-600 dark:text-rose-300 font-medium py-2">{error}</p>}
            {isLoading && <p className="text-gray-500 py-4">Cargando órdenes...</p>}

            <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <table className="w-full min-w-[640px] bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white">
                    <thead className="bg-gray-100 dark:bg-white/10 border-b border-gray-200 dark:border-white/10">
                        <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                            <th className="px-4 py-3">
                                <Sort className="" name="ID" serverArg="id" />
                            </th>
                            <th className="px-4 py-3">
                                <Sort className="" name="Cliente" serverArg="client" />
                            </th>
                            <th className="px-4 py-3">
                                <Sort className="" name="Total" serverArg="total" />
                            </th>
                            <th className="px-4 py-3">
                                <Sort className="" name="Estado" serverArg="state" />
                            </th>
                            {canManageOrders && (
                                <th className="px-4 py-3 text-center">Acciones</th>
                            )}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-sm">
                        {orders.length > 0 ? (
                            orders.map((order) => {
                                const isEditable = canEditSpecificOrder(order);
                                const isInitialState = Number(order.currentState?.id ?? 1) === 1;

                                return (
                                    <tr
                                        key={String(order.id)}
                                        className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                    >
                                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                                            #{String(order.id)}
                                        </td>

                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                                            {order.client ? `${order.client.name} ${order.client.lastname}` : 'Cliente Desconocido'}
                                        </td>

                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-semibold">
                                            ${Number(order.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    order.currentState?.name === "delivered" || Number(order.currentState?.id) === 5
                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                        : order.currentState?.name === "dispatched" || order.currentState?.name === "in_transit" || Number(order.currentState?.id) === 3 || Number(order.currentState?.id) === 4
                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                        : order.currentState?.name === "paid" || order.currentState?.name === "created" || Number(order.currentState?.id) === 1 || Number(order.currentState?.id) === 2
                                                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                }`}>
                                                    {order.currentState?.name ?? 'Sin estado'}
                                                </span>
                                                {order.trackingNumber && (
                                                    <span className="text-[11px] font-mono text-gray-400">
                                                        TRK: {order.trackingNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {canManageOrders && (
                                            <td className="px-4 py-3 text-center">
                                                {isEditable ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(order)}
                                                        title={`Ver u ordenar #${String(order.id)}`}
                                                        className="rounded-lg bg-blue-100 px-3 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300"
                                                    >
                                                        {isOperador 
                                                            ? "Gestionar Envío" 
                                                            : isVendedor 
                                                            ? isInitialState ? "Editar" : "Ver Detalles" 
                                                            : "Gestionar"}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">
                                                        Bloqueada
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })
                        ) : (
                            !isLoading && (
                                <tr>
                                    <td colSpan={canManageOrders ? 5 : 4} className="text-center py-6 text-gray-500">
                                        No se encontraron órdenes
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>

            <Paginacion paginas={pages} />
        </div>
    );
}