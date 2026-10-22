import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../../infrastructure/db/prisma';

import { canViewInvoice, getRole } from '../../domain/orderStateRules'
// Adaptá este import a lo que ya usa tu handler "getSession" para leer la sesión activa
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
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #666; }
    .block { margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; }
    .right { text-align: right; }
    .total { margin-top: 16px; text-align: right; font-size: 18px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Comprobante de orden</h1>
  <div class="muted">N.º ${number} · ${new Date().toLocaleDateString('es-AR')}</div>

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

  <div class="total">Total: ${money(order.total)}</div>
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

      // Misma regla que usa el formulario, pero acá se valida de verdad
      if (!canViewInvoice(Number(order.currentStateId), role)) {
        return { success: false, message: 'La factura no está disponible para esta orden.' }
      }

      // Un seller solo ve las facturas de sus propias órdenes
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