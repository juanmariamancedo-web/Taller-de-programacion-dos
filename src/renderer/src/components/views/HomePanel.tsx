import { Tab } from "../../../../main/domain/types/Tab"

type Ordenes = {
    id: number,
    user : {
        name: string,
        lastname: string,
    },
    state: string,

    total: number
}

export default function HomePanel({
        totalClients,
        totalPedidosPendientes,
        totalPedidosEntregados,
        // topProductos,
        averageTicket,
        // ultimasOrdenes, 
        onSelectTab
    } 
    : 
    {
        totalClients : number,
        totalPedidosPendientes :  number, 
        totalPedidosEntregados : number, 
        // topProductos : Producto[], 
        averageTicket : number, 
        // ultimasOrdenes: Ordenes[],
        onSelectTab: React.Dispatch<React.SetStateAction<Tab>>
    }){
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
                                onClick={()=>onSelectTab('orders')}>
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
                                {/* {ultimasOrdenes?.length ? (
                                    ultimasOrdenes.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                #{order.id}
                                            </td>

                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                {`${order.user?.name ?? 'Sin'} ${order.user?.lastname ?? 'cliente'}`}
                                            </td>

                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                ${order.total}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                        order.state === "completed"
                                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                            : order.state === "pending"
                                                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                    }`}
                                                >
                                                    {order.state}
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
                                )} */}
                            </tbody>
                        </table>
                    </section>
                    {/* <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white col-span-1 sm:col-span-2">
                        <header className="flex justify-between items-center">
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Últimas órdenes
                            </h2>
                            <Link href="\admin\orders" className="text-sm text-indigo-600 hover:text-indigo-500">
                                Ver todos
                            </Link>
                        </header>
                        {ultimasOrdenes.length > 0 && ultimasOrdenes.map((order)=>{
                            return(
                                <article>
                                    {order.order_id}
                                    <h3>
                                        {`${order.user.name} ${order.user.lastname}`}
                                    </h3>
                                    {order.total}
                                    {order.state}
                                </article>
                            )
                        })}
                    </section> */}
                    {/* {topProductos.length > 0 && (
                        <section className="rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white col-span-1 flex flex-col gap-3">
                            <h2 className="text-xl lg:text-2xl text-balance text-black dark:text-white font-bold">
                                Top 5 productos vendidos
                            </h2>
                            <div className="flex gap-2 flex-col">
                                {topProductos.map((product, index)=>{
                                    return(
                                        <Link href={`\\catalogo\\${product.name}`}>
                                            <article>
                                                <h3 className="font-mono">
                                                    {product.name}
                                                </h3>
                                                <span className="font-bold">
                                                    Ranking #{index + 1}
                                                </span>
                                            </article>
                                        </Link>
                                    )
                                })}
                            </div>
                        </section>
                    )} */}
                </ div>
            </ div>
        </div>
    )
}