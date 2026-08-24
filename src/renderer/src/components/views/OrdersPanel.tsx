
export default function({ ordenes , paginas, pagina, sort}: { ordenes: Order[], paginas: number, pagina: number, sort: string }){

    return(
        <>
            <div className="flex flex-col items-center gap-3">
                <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-bold flex flex-row gap-x-4 pb-6 lg:pb-10">
                    Ordenes
                </h1>
                <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                    <table className="w-full min-w-[640px] bg-black/5 dark:bg-white/5 text-sm text-gray-900 dark:text-white">

                        <thead className="bg-gray-100 dark:bg-white/10">
                            <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                                <th className="px-4 py-3">
                                    <Sort 
                                        sort={sort} dir="/ordenes"
                                        name="Pedido"
                                        serverArg="pedido"
                                        className=""
                                        search=""
                                    />
                                </th>
                                <th className="px-4 py-3">
                                    <Sort 
                                        sort={sort} dir="/ordenes"
                                        name="Total"
                                        serverArg="total"
                                        className=""
                                        search=""
                                    />
                                </th>
                                <th className="px-4 py-3">
                                    <Sort 
                                        sort={sort} dir="/ordenes"
                                        name="Estado"
                                        serverArg="state"
                                        className=""
                                        search=""
                                    />
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-sm">
                            {ordenes?.length ? (
                                ordenes.map((order) => {   
                                    const total = order.item_orders.reduce(
                                        (acc, item) => acc + item.unit_price * item.amount, 0
                                    ) 
                                    
                                    return (
                                                <tr
                                                key={order.id}
                                                className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                                >
                                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                        <Link href={`/ordenes/${order.id}`} className="font-bold">
                                                            #{order.id}
                                                        </Link>
                                                    </td>

                                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                        ${total}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                            order.state === "delivered"
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : order.state === "paid"
                                                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                        }`}>
                                                            {order.state}
                                                        </span>
                                                    </td>
                                                </tr>
                                        )
                                    }
                                )
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
                <Paginacion dir="/admin/ordenes"  pagina={pagina} paginas={paginas} />
            </ div>
        </>
    )
}