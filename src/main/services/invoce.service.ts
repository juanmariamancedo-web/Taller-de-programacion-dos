import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../infrastructure/db/prisma';
import { OrderState } from '../domain/orderStateRules';

const money = (value: unknown) =>
  Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

const escapeHtml = (text: unknown) =>
  String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export class InvoiceService {
  async findOrder(orderId: string) {
    return prisma.order.findUnique({
      where: { id: BigInt(orderId) },
      include: {
        client: true,
        shippingAddress: { include: { city: true } },
        itemOrders: { include: { product: true } },
        currentState: true,
      },
    })
  }

  buildInvoiceHtml(order: NonNullable<Awaited<ReturnType<InvoiceService['findOrder']>>>): string {
    const number = String(order.id).padStart(8, '0')
    const address = order.shippingAddress
    const addressText = address
      ? `${address.street} ${address.number}${address.city?.name ? `, ${address.city.name}` : ''}`
      : '-'

    const invoiceType = (order.invoiceType ?? 'B').toUpperCase()
    const isInvoiceA = invoiceType === 'A'

    const currentStateId = Number(order.currentStateId)
    const isCancelledOrRejected =
      currentStateId === OrderState.Rejected || currentStateId === OrderState.Cancelled

    const documentTitle =
      isCancelledOrRejected && order.invoiceType
        ? `NOTA DE CRÉDITO ${invoiceType}`
        : `FACTURA ${invoiceType}`

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
    .invoice-badge { font-size: 18px; font-weight: bold; border: 2px solid #333; padding: 6px 12px; text-align: center; background-color: ${isCancelledOrRejected ? '#fee2e2' : 'transparent'}; }
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
      <h1>Comprobante Fiscal</h1>
      <div class="muted">N.º ${number} · Fecha: ${new Date().toLocaleDateString('es-AR')}</div>
      ${isCancelledOrRejected ? '<div style="color: #dc2626; font-weight: bold; margin-top: 4px;">COMPROBANTE DE ANULACIÓN</div>' : ''}
    </div>
    <div class="invoice-badge">
      ${documentTitle}
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
    ${
      isCancelledOrRejected
        ? `
      ${isInvoiceA ? `
        <div class="totals-row"><span>Neto Anulado:</span> <span>-${money(netAmount)}</span></div>
        <div class="totals-row"><span>IVA (21%):</span> <span>-${money(vatAmount)}</span></div>
      ` : ''}
      <div class="totals-row final"><span>Total Reintegrado:</span> <span>-${money(total)}</span></div>
    `
        : `
      ${isInvoiceA ? `
        <div class="totals-row"><span>Neto Gravado:</span> <span>${money(netAmount)}</span></div>
        <div class="totals-row"><span>IVA (21%):</span> <span>${money(vatAmount)}</span></div>
      ` : ''}
      <div class="totals-row final"><span>Total:</span> <span>${money(total)}</span></div>
    `
    }
  </div>
</body>
</html>`
  }

  async savePdf(orderId: bigint, isNC: boolean, pdf: Buffer): Promise<string> {
    const folder = path.join(app.getPath('userData'), 'invoices')
    await mkdir(folder, { recursive: true })

    const prefix = isNC ? 'nota-credito' : 'orden'
    const filePath = path.join(folder, `${prefix}-${orderId}.pdf`)
    await writeFile(filePath, pdf)
    return filePath
  }
}

export const invoiceService = new InvoiceService()