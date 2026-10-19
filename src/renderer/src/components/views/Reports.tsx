import { useEffect, useState } from 'react'
import type {
  ClientReportData,
  OrdersReportData,
  ProductReportData
} from '../../../../main/domain/types/electron-env'

type ReportTableRow = string[]
type ChartItem = { label: string; value: number }
type Metric = { label: string; value: string }
type ReportKind = 'products' | 'clients' | 'orders'

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
const numberFormat = new Intl.NumberFormat('es-AR')

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character] ?? character
  )
}

function openPrintableReport(
  title: string,
  period: string,
  metrics: Metric[],
  columns: string[],
  rows: ReportTableRow[],
  chart: ChartItem[]
): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    window.alert('No se pudo abrir el informe. Permití las ventanas emergentes e intentá de nuevo.')
    return
  }

  const maxValue = Math.max(...chart.map((item) => item.value), 0)
  const chartHeight = Math.max(chart.length * 36 + 18, 60)
  const chartSvg = chart.length
    ? `<svg role="img" aria-label="Gráfico de ${escapeHtml(title)}" viewBox="0 0 760 ${chartHeight}" xmlns="http://www.w3.org/2000/svg">
        ${chart
          .map((item, index) => {
            const y = index * 36 + 8
            const barWidth = maxValue > 0 ? Math.max((item.value / maxValue) * 420, 2) : 2
            return `<text x="0" y="${y + 15}" font-size="12">${escapeHtml(item.label.slice(0, 24))}</text>
            <rect x="210" y="${y}" width="${barWidth}" height="22" rx="5" fill="#2563eb"/>
            <text x="645" y="${y + 15}" font-size="12">${escapeHtml(numberFormat.format(item.value))}</text>`
          })
          .join('')}
      </svg>`
    : '<p>No hay datos suficientes para mostrar el gráfico.</p>'
  const metricCards = metrics
    .map(
      (metric) =>
        `<div class="metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>`
    )
    .join('')
  const tableHead = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')
  const tableRows = rows.length
    ? rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('')
    : `<tr><td colspan="${columns.length}">Sin datos para el período seleccionado.</td></tr>`

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)}</title>
        <style>
          body{font:14px Arial,sans-serif;color:#172033;margin:32px}
          h1{margin:0 0 6px;font-size:26px} .period{color:#596579;margin:0 0 24px}
          .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}
          .metric{border:1px solid #dbe2ee;border-radius:8px;padding:14px}
          .metric span{display:block;color:#596579;font-size:12px;margin-bottom:8px}
          .metric strong{font-size:18px}.chart{margin:24px 0}.chart svg{width:100%;height:auto}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          th,td{text-align:left;padding:9px;border-bottom:1px solid #dbe2ee}
          th{background:#f1f5f9} .print{padding:9px 14px;border:0;border-radius:6px;background:#2563eb;color:white;font-weight:bold}
          @media print{body{margin:0}.print{display:none}}
        </style>
      </head>
      <body>
        <button class="print" onclick="window.print()">Imprimir / Guardar como PDF</button>
        <h1>${escapeHtml(title)}</h1><p class="period">${escapeHtml(period)} · Generado ${escapeHtml(new Date().toLocaleString('es-AR'))}</p>
        <section class="metrics">${metricCards}</section>
        <h2>Resumen visual</h2><div class="chart">${chartSvg}</div>
        <h2>Detalle</h2><table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table>
      </body>
    </html>`)
  printWindow.document.close()
  window.setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 250)
}

function ReportChart({ items }: { items: ChartItem[] }): React.JSX.Element {
  const maxValue = Math.max(...items.map((item) => item.value), 0)
  const chartHeight = Math.max(items.length * 38 + 16, 64)

  if (!items.length) {
    return <p className="py-6 text-center text-sm text-gray-500">No hay datos para graficar.</p>
  }

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Gráfico de barras del reporte"
        viewBox={`0 0 760 ${chartHeight}`}
        className="min-w-[640px] w-full"
      >
        {items.map((item, index) => {
          const y = index * 38 + 8
          const width = maxValue > 0 ? Math.max((item.value / maxValue) * 410, 2) : 2
          return (
            <g key={`${item.label}-${index}`}>
              <text x="0" y={y + 16} className="fill-gray-700 dark:fill-gray-200" fontSize="12">
                {item.label.length > 24 ? `${item.label.slice(0, 22)}…` : item.label}
              </text>
              <rect x="215" y={y} width={width} height="23" rx="5" className="fill-blue-600" />
              <text x="645" y={y + 16} className="fill-gray-700 dark:fill-gray-200" fontSize="12">
                {numberFormat.format(item.value)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ReportView({
  kind,
  title,
  description,
  period,
  metrics,
  columns,
  rows,
  chart,
  loading,
  error,
  onBack,
  dateFilters
}: {
  kind: ReportKind
  title: string
  description: string
  period: string
  metrics: Metric[]
  columns: string[]
  rows: ReportTableRow[]
  chart: ChartItem[]
  loading: boolean
  error: string | null
  onBack: () => void
  dateFilters?: {
    from: string
    to: string
    onFromChange: (value: string) => void
    onToChange: (value: string) => void
    onSearch: () => void
  }
}): React.JSX.Element {
  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
          >
            ← Volver al panel
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>
        </div>
        <button
          type="button"
          disabled={loading || Boolean(error)}
          onClick={() => openPrintableReport(title, period, metrics, columns, rows, chart)}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Generar PDF
        </button>
      </div>

      {dateFilters && (
        <form
          className="flex flex-col items-end gap-3 rounded-xl border border-gray-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            dateFilters.onSearch()
          }}
        >
          <label className="w-full text-sm font-medium text-gray-700 dark:text-gray-200">
            Desde
            <input
              type="date"
              value={dateFilters.from}
              onChange={(event) => dateFilters.onFromChange(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-white/15 dark:bg-gray-900 dark:text-white sm:w-auto"
            />
          </label>
          <label className="w-full text-sm font-medium text-gray-700 dark:text-gray-200">
            Hasta
            <input
              type="date"
              value={dateFilters.to}
              onChange={(event) => dateFilters.onToChange(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-white/15 dark:bg-gray-900 dark:text-white sm:w-auto"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500"
          >
            Buscar
          </button>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Gráfico de barras
        </h2>
        <ReportChart items={chart} />
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-white/10">
          <h2 className="font-semibold text-gray-900 dark:text-white">Detalle del informe</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{period}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] bg-white/80 text-left text-sm text-gray-900 dark:bg-white/5 dark:text-white">
            <thead className="bg-gray-100 dark:bg-white/10">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                    Cargando reporte...
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((row, index) => (
                  <tr key={`${kind}-${index}`} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    {row.map((cell, cellIndex) => (
                      <td key={`${cellIndex}-${cell}`} className="px-4 py-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                    No hay datos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

export function ProductsReport({ onBack }: { onBack: () => void }): React.JSX.Element {
  const [data, setData] = useState<ProductReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electronAPI?.getProductsReport()
        if (!response?.success || !response.data)
          throw new Error(response?.message ?? 'No se pudo cargar el reporte de productos.')
        if (!cancelled) setData(response.data)
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudo cargar el reporte de productos.'
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = (data?.rows ?? []).map((row) => [
    row.sellerName,
    numberFormat.format(row.ordersCount),
    currency.format(row.salesTotal)
  ])
  const chart = (data?.rows ?? [])
    .slice(0, 8)
    .map((row) => ({ label: row.sellerName, value: row.ordersCount }))
  const metrics = [
    { label: 'Órdenes registradas', value: numberFormat.format(data?.totalOrders ?? 0) },
    { label: 'Ventas acumuladas', value: currency.format(data?.totalSales ?? 0) },
    { label: 'Vendedores activos en ventas', value: numberFormat.format(data?.sellerCount ?? 0) }
  ]

  return (
    <ReportView
      kind="products"
      title="Reporte de Productos"
      description="Vendedores con mayor cantidad de órdenes registradas y el total vendido."
      period="Período: histórico completo"
      metrics={metrics}
      columns={['Vendedor', 'Órdenes registradas', 'Ventas totales']}
      rows={rows}
      chart={chart}
      loading={loading}
      error={error}
      onBack={onBack}
    />
  )
}

export function ClientsReport({ onBack }: { onBack: () => void }): React.JSX.Element {
  const [data, setData] = useState<ClientReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electronAPI?.getClientsReport()
        if (!response?.success || !response.data)
          throw new Error(response?.message ?? 'No se pudo cargar el reporte de clientes.')
        if (!cancelled) setData(response.data)
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudo cargar el reporte de clientes.'
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = (data?.rows ?? []).map((row) => [
    row.clientName,
    numberFormat.format(row.purchases),
    currency.format(row.amountSpent)
  ])
  const chart = (data?.rows ?? [])
    .slice(0, 8)
    .map((row) => ({ label: row.clientName, value: row.amountSpent }))
  const metrics = [
    { label: 'Compras registradas', value: numberFormat.format(data?.totalPurchases ?? 0) },
    { label: 'Monto total facturado', value: currency.format(data?.totalSpent ?? 0) },
    { label: 'Clientes con compras', value: numberFormat.format(data?.clientCount ?? 0) }
  ]

  return (
    <ReportView
      kind="clients"
      title="Reporte de Clientes"
      description="Clientes con mayor número de compras y el monto total gastado."
      period="Período: histórico completo"
      metrics={metrics}
      columns={['Cliente', 'Compras', 'Monto total gastado']}
      rows={rows}
      chart={chart}
      loading={loading}
      error={error}
      onBack={onBack}
    />
  )
}

export function OrdersReport({ onBack }: { onBack: () => void }): React.JSX.Element {
  const [data, setData] = useState<OrdersReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ from: '', to: '' })

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electronAPI?.getOrdersReport(appliedFilters)
        if (!response?.success || !response.data)
          throw new Error(response?.message ?? 'No se pudo cargar el reporte de órdenes.')
        if (!cancelled) setData(response.data)
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudo cargar el reporte de órdenes.'
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [appliedFilters])

  const applyFilters = (): void => {
    if (from && to && from > to) {
      setError('La fecha "Desde" no puede ser posterior a "Hasta".')
      return
    }
    setAppliedFilters({ from, to })
  }
  const period =
    appliedFilters.from && appliedFilters.to
      ? `Período: ${appliedFilters.from} al ${appliedFilters.to}`
      : appliedFilters.from
        ? `Período: desde ${appliedFilters.from}`
        : appliedFilters.to
          ? `Período: hasta ${appliedFilters.to}`
          : 'Período: histórico completo'
  const rows = (data?.rows ?? []).map((row) => [
    row.productName,
    numberFormat.format(row.quantitySold),
    numberFormat.format(row.orderCount),
    currency.format(row.salesTotal)
  ])
  const chart = (data?.rows ?? [])
    .slice(0, 8)
    .map((row) => ({ label: row.productName, value: row.quantitySold }))
  const metrics = [
    { label: 'Unidades vendidas', value: numberFormat.format(data?.totalUnits ?? 0) },
    { label: 'Ventas del período', value: currency.format(data?.totalSales ?? 0) },
    { label: 'Órdenes del período', value: numberFormat.format(data?.totalOrders ?? 0) }
  ]

  return (
    <ReportView
      kind="orders"
      title="Reporte de Órdenes"
      description="Productos más vendidos dentro del rango de fechas seleccionado."
      period={period}
      metrics={metrics}
      columns={['Producto', 'Unidades vendidas', 'Órdenes', 'Ventas totales']}
      rows={rows}
      chart={chart}
      loading={loading}
      error={error}
      onBack={onBack}
      dateFilters={{
        from,
        to,
        onFromChange: setFrom,
        onToChange: setTo,
        onSearch: applyFilters
      }}
    />
  )
}
