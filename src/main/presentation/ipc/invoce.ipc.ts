import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../../infrastructure/db/prisma';

import { canViewInvoice, getRole } from '../../domain/orderStateRules'
import { authService } from '../../services/auth.service'

const OPEN_INVOICE_CHANNEL = 'orders:open-invoice'

// ─── Helpers de formato ───────────────────────────────────────────────────

const money = (value: unknown) =>
  Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

const escapeHtml = (text: unknown) =>
  String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// ─── Datos ────────────────────────────────────────────────────────────────

const findOrder = (orderId: string) =>
  prisma.order.findUnique({
    where: { id: BigInt(orderId) },
    include: {
      client: true,
      shippingAddress: { include: { city: true } },
      itemOrders: { include: { product: true } },
    },
  })

type InvoiceOrder = NonNullable<Awaited<ReturnType<typeof findOrder>>>

// ─── Generación del PDF ───────────────────────────────────────────────────

function buildInvoiceHtml(order: InvoiceOrder): string {
  const number = String(order.id).padStart(8, '0')
  const address = order.shippingAddress
  const addressText = address
    ? `${address.street} ${address.number}${address.city?.name ? `, ${address.city.name}` : ''}`
    : '-'

  const invoiceType = (order.invoiceType ?? 'B').toUpperCase()
  const isInvoiceA = invoiceType === 'A'

  const total = Number(order.total)
  const netAmount = isInvoiceA ? total / 1.21 : total
  const vatAmount = isInvoiceA ? total - netAmount : 0

  const rows = order.itemOrders
    .map((item) => {
      const subtotal = Number(item.unitPrice) * Number(item.amount)
      return `
        <tr>
          <td>${escapeHtml(item.product?.name)}</td>
          <td class="right">${item.amount}</td>
          <td class="right">${money(item.unitPrice)}</td>
          <td class="right">${money(subtotal)}</td>
        </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111; padding: 32px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .invoice-badge { font-size: 24px; font-weight: bold; border: 2px solid #333; padding: 4px 12px; text-align: center; }
    .muted { color: #666; }
    .block { margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; }
    .right { text-align: right; }
    .totals-box { margin-top: 20px; float: right; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
    .totals-row.final { font-size: 18px; font-weight: bold; border-top: 2px solid #333; margin-top: 6px; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Comprobante de Orden</h1>
      <div class="muted">N.º ${number} · Fecha: ${new Date().toLocaleDateString('es-AR')}</div>
    </div>
    <div class="invoice-badge">
      FACTURA ${invoiceType}
    </div>
  </div>

  <div class="block">
    <strong>Cliente:</strong> ${escapeHtml(order.client?.name)} ${escapeHtml(order.client?.lastname)}<br />
    <strong>CUIL:</strong> ${escapeHtml(order.client?.cuil)}<br />
    <strong>Dirección de envío:</strong> ${escapeHtml(addressText)}
  </div>

  <table>
    <thead>
      <tr><th>Producto</th><th class="right">Cant.</th><th class="right">Precio unit.</th><th class="right">Subtotal</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals-box">
    ${isInvoiceA ? `
      <div class="totals-row"><span>Neto Gravado:</span> <span>${money(netAmount)}</span></div>
      <div class="totals-row"><span>IVA (21%):</span> <span>${money(vatAmount)}</span></div>
    ` : ''}
    <div class="totals-row final"><span>Total:</span> <span>${money(total)}</span></div>
  </div>
</body>
</html>`
}

async function renderPdf(html: string): Promise<Buffer> {
  const window = new BrowserWindow({ show: false })
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await window.webContents.printToPDF({ pageSize: 'A4' })
  } finally {
    window.destroy()
  }
}

async function savePdf(orderId: bigint, pdf: Buffer): Promise<string> {
  const folder = path.join(app.getPath('userData'), 'invoices')
  await mkdir(folder, { recursive: true })

  const filePath = path.join(folder, `orden-${orderId}.pdf`)
  await writeFile(filePath, pdf)
  return filePath
}

// ─── Handler IPC ──────────────────────────────────────────────────────────

export function registerOrderInvoiceHandler() {
  ipcMain.handle(OPEN_INVOICE_CHANNEL, async (_event, orderId: string) => {
    try {
      const session = await authService.getActiveSession()
      const role = getRole(Number(session?.roleId), session?.roleName)

      const order = await findOrder(orderId)
      if (!order) return { success: false, message: 'Orden no encontrada.' }

      if (!canViewInvoice(Number(order.currentStateId), role)) {
        return { success: false, message: 'La factura no está disponible para esta orden.' }
      }

      if (role === 'seller' && Number(order.sellerId) !== Number(session?.id)) {
        return { success: false, message: 'No tenés permiso para ver esta factura.' }
      }

      const pdf = await renderPdf(buildInvoiceHtml(order))
      const filePath = await savePdf(order.id, pdf)

      const openError = await shell.openPath(filePath)
      return openError ? { success: false, message: openError } : { success: true }
    } catch (err) {
      console.error('Error al generar la factura:', err)
      return { success: false, message: 'No se pudo generar la factura.' }
    }
  })
}