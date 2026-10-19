import { useCallback, useEffect, useState } from 'react'
import type {
  ClientReportData,
  OrdersReportData,
  ProductReportData
} from '../../../../main/domain/types/electron-env'

type ReportTableRow = string[]
type ChartItem = { label: string; value: number }
type Metric = { label: string; value: string }
type ReportKind = 'products' | 'clients' | 'orders'
type PdfSection = { title: string; columns: string[]; rows: ReportTableRow[] }

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
const numberFormat = new Intl.NumberFormat('es-AR')

function formatReportDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('es-AR') : 'Sin fecha'
}

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

function buildPrintableReport(
  title: string,
  period: string,
  metrics: Metric[],
  columns: string[],
  rows: ReportTableRow[],
  chart: ChartItem[],
  sections: PdfSection[]
): string {
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
  const visibleRows = rows.slice(0, 5)
  const tableRows = visibleRows.length
    ? visibleRows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('')
    : `<tr><td colspan="${columns.length}">Sin datos para el período seleccionado.</td></tr>`
  const extraSections = sections
    .map((section) => {
      const sectionHead = section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')
      const visibleSectionRows = section.rows.slice(0, 5)
      const sectionRows = visibleSectionRows.length
        ? visibleSectionRows
            .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
            .join('')
        : `<tr><td colspan="${section.columns.length}">Sin datos detallados para mostrar.</td></tr>`
      return `<section class="detail-section"><h2>${escapeHtml(section.title)} (hasta 5 registros)</h2>
        <table><thead><tr>${sectionHead}</tr></thead><tbody>${sectionRows}</tbody></table></section>`
    })
    .join('')

  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)}</title>
        <style>
          body{font:12px Arial,sans-serif;color:#172033;margin:32px}
          h1{margin:0 0 6px;font-size:26px} .period{color:#596579;margin:0 0 24px}
          .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}
          .metric{border:1px solid #dbe2ee;border-radius:8px;padding:14px}
          .metric span{display:block;color:#596579;font-size:12px;margin-bottom:8px}
          .metric strong{font-size:18px}.chart{margin:24px 0}.chart svg{width:100%;height:auto}
          table{width:100%;border-collapse:collapse;margin-top:12px;table-layout:auto}
          th,td{text-align:left;padding:6px;border-bottom:1px solid #dbe2ee;overflow-wrap:anywhere}
          th{background:#f1f5f9}.detail-section{margin-top:26px;break-inside:auto}
          .detail-section h2{break-after:avoid}thead{display:table-header-group}
          tr{break-inside:avoid}
          @media print{body{margin:0}}
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1><p class="period">${escapeHtml(period)} · Generado ${escapeHtml(new Date().toLocaleString('es-AR'))}</p>
        <section class="metrics">${metricCards}</section>
        <h2>Resumen visual</h2><div class="chart">${chartSvg}</div>
        <h2>Detalle (hasta 5 registros)</h2><table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table>
        ${extraSections}
      </body>
    </html>`
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
  pdfSections,
  recordCount,
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
  pdfSections: PdfSection[]
  recordCount: number
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
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const generatePdf = async (): Promise<void> => {
    setGeneratingPdf(true)
    setPdfError(null)
    try {
      const response = await window.electronAPI?.exportReportPdf({
        title,
        html: buildPrintableReport(title, period, metrics, columns, rows, chart, pdfSections)
      })
      if (!response?.success) {
        throw new Error(response?.message ?? 'No se pudo generar el PDF.')
      }
    } catch (exportError) {
      setPdfError(exportError instanceof Error ? exportError.message : 'No se pudo generar el PDF.')
    } finally {
      setGeneratingPdf(false)
    }
  }

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
          disabled={loading || Boolean(error) || generatingPdf}
          onClick={() => {
            void generatePdf()
          }}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generatingPdf ? 'Generando PDF...' : 'Generar PDF'}
        </button>
      </div>

      {pdfError && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {pdfError}
        </p>
      )}
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
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {period} · Mostrando {Math.min(rows.length, 5)} de {recordCount} registros
          </p>
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
                rows.slice(0, 5).map((row, index) => (
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

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electronAPI?.getProductsReport()
      if (!response?.success || !response.data)
        throw new Error(response?.message ?? 'No se pudo cargar el reporte de productos.')
      setData(response.data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No se pudo cargar el reporte de productos.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const refresh = (): void => {
      if (active) void load()
    }
    queueMicrotask(() => {
      refresh()
    })
    const unsubscribe = window.electronAPI?.onReportsUpdated(refresh)
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [load])

  const rows = (data?.rows ?? []).map((row) => [
    row.sellerName,
    numberFormat.format(row.ordersCount),
    currency.format(row.salesTotal)
  ])
  const detailRows = (data?.details ?? []).flatMap((order) =>
    order.items.map((item) => [
      order.sellerName,
      `#${order.orderId}`,
      formatReportDate(order.orderDate),
      order.clientName,
      order.orderState,
      item.productName,
      numberFormat.format(item.quantity),
      currency.format(item.unitPrice),
      currency.format(item.lineTotal),
      currency.format(order.orderTotal)
    ])
  )
  const chart = (data?.rows ?? [])
    .slice(0, 5)
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
      recordCount={rows.length}
      pdfSections={[
        {
          title: 'Productos vendidos por vendedor — detalle de órdenes',
          columns: [
            'Vendedor',
            'Orden',
            'Fecha',
            'Cliente',
            'Estado',
            'Producto',
            'Unidades',
            'Precio unitario',
            'Subtotal',
            'Total de orden'
          ],
          rows: detailRows
        }
      ]}
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

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electronAPI?.getClientsReport()
      if (!response?.success || !response.data)
        throw new Error(response?.message ?? 'No se pudo cargar el reporte de clientes.')
      setData(response.data)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'No se pudo cargar el reporte de clientes.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const refresh = (): void => {
      if (active) void load()
    }
    queueMicrotask(() => {
      refresh()
    })
    const unsubscribe = window.electronAPI?.onReportsUpdated(refresh)
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [load])

  const rows = (data?.rows ?? []).map((row) => [
    row.clientName,
    numberFormat.format(row.purchases),
    currency.format(row.amountSpent)
  ])
  const detailRows = (data?.details ?? []).flatMap((order) =>
    order.items.map((item) => [
      order.clientName,
      `#${order.orderId}`,
      formatReportDate(order.orderDate),
      order.sellerName,
      order.orderState,
      item.productName,
      numberFormat.format(item.quantity),
      currency.format(item.unitPrice),
      currency.format(item.lineTotal),
      currency.format(order.orderTotal)
    ])
  )
  const chart = (data?.rows ?? [])
    .slice(0, 5)
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
      recordCount={rows.length}
      pdfSections={[
        {
          title: 'Compras por cliente — detalle de productos y precios',
          columns: [
            'Cliente',
            'Orden',
            'Fecha',
            'Vendedor',
            'Estado',
            'Producto',
            'Unidades',
            'Precio unitario',
            'Subtotal',
            'Total de orden'
          ],
          rows: detailRows
        }
      ]}
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

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electronAPI?.getOrdersReport(appliedFilters)
      if (!response?.success || !response.data)
        throw new Error(response?.message ?? 'No se pudo cargar el reporte de órdenes.')
      setData(response.data)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'No se pudo cargar el reporte de órdenes.'
      )
    } finally {
      setLoading(false)
    }
  }, [appliedFilters])

  useEffect(() => {
    let active = true
    const refresh = (): void => {
      if (active) void load()
    }
    queueMicrotask(() => {
      refresh()
    })
    const unsubscribe = window.electronAPI?.onReportsUpdated(refresh)
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [load])

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
    numberFormat.format(row.orderCount),
    numberFormat.format(row.quantitySold),
    currency.format(row.salesTotal)
  ])
  const detailRows = (data?.details ?? []).map((detail) => [
    `#${detail.orderId}`,
    formatReportDate(detail.orderDate),
    detail.sellerName,
    detail.clientName,
    detail.productName,
    numberFormat.format(detail.quantity),
    currency.format(detail.unitPrice),
    currency.format(detail.lineTotal),
    currency.format(detail.orderTotal)
  ])
  const chart = (data?.rows ?? [])
    .slice(0, 5)
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
      description="Productos vendidos en órdenes pagadas, despachadas o entregadas dentro del rango de fechas seleccionado."
      period={period}
      metrics={metrics}
      columns={['Producto', 'Órdenes', 'Unidades vendidas', 'Ventas totales']}
      rows={rows}
      chart={chart}
      recordCount={rows.length}
      pdfSections={[
        {
          title: 'Detalle de productos por orden',
          columns: [
            'Orden',
            'Fecha',
            'Vendedor',
            'Cliente',
            'Producto',
            'Unidades',
            'Precio unitario',
            'Subtotal',
            'Total de orden'
          ],
          rows: detailRows
        }
      ]}
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
