import { useEffect, useState } from 'react'
import type { SellerSalesData } from '../../../../main/domain/types/electron-env'

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export default function MySales(): React.JSX.Element {
  const [data, setData] = useState<SellerSalesData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void window.electronAPI?.getSellerSales().then((response) => {
      if (response?.success && response.data) setData(response.data)
      else setError(response?.message ?? 'No se pudieron cargar tus ventas.')
    }).finally(() => setLoading(false))
  }, [])

  return (
    <section className="flex w-full flex-col gap-6">
      <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mis ventas</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Historial y métricas de tus órdenes.</p></div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Total vendido este mes', currency.format(data?.totalSoldMonth ?? 0)],
          ['Órdenes realizadas', String(data?.ordersCount ?? 0)],
          ['Promedio por venta', currency.format(data?.averageSale ?? 0)]
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-gray-100 dark:bg-white/10"><tr>{['Orden', 'Fecha', 'Cliente', 'Estado', 'Total'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center">Cargando...</td></tr> : data?.orders.length ? data.orders.map((order) => <tr key={order.id}><td className="px-4 py-3">#{order.id}</td><td className="px-4 py-3">{order.createdAt ? new Date(order.createdAt).toLocaleString('es-AR') : 'Sin fecha'}</td><td className="px-4 py-3">{order.clientName}</td><td className="px-4 py-3">{order.state}</td><td className="px-4 py-3 font-semibold">{currency.format(order.total)}</td></tr>) : <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No tienes órdenes registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
