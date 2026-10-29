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

  buildInvoiceHtml(order: NonNullable<Awaited<ReturnType<InvoiceService['findOrder']>>>, forceInvoice = false): string {
    const number = String(order.id).padStart(8, '0')
    const address = order.shippingAddress
    const addressText = address
      ? `${address.street} ${address.number}${address.city?.name ? `, ${address.city.name}` : ''}`
      : '-'

    const rawInvoiceType = (order.invoiceType ?? 'B').toUpperCase()
    const isInvoiceA = rawInvoiceType === 'A'
    const isExempt = rawInvoiceType === 'EXENTO'

    // Definición estricta de la condición fiscal según el comprobante solicitado
    let clientTaxCondition = 'CONSUMIDOR_FINAL'
    if (isInvoiceA) {
      clientTaxCondition = 'RESPONSABLE_INSCRIPTO'
    } else if (isExempt) {
      clientTaxCondition = 'EXENTO'
    } else {
      clientTaxCondition = (order.client as any)?.taxCondition ?? 'CONSUMIDOR_FINAL'
    }

    const clientCuil = order.client?.cuil ? escapeHtml(order.client.cuil) : '30-XXXXXXXX-X'

    const currentStateId = Number(order.currentStateId)
    const isCancelledOrRejected = !forceInvoice && (currentStateId === OrderState.Rejected || currentStateId === OrderState.Cancelled)

    // Definición del título del comprobante según el tipo
    let documentTitle = `FACTURA B`
    let badgeLabel = 'B'
    if (isInvoiceA) {
      documentTitle = `FACTURA A`
      badgeLabel = 'A'
    } else if (isExempt) {
      documentTitle = `FACTURA EXENTO`
      badgeLabel = 'B'
    }

    if (isCancelledOrRejected && order.invoiceType) {
      documentTitle = `NOTA DE CRÉDITO ${badgeLabel}`
    }

    const total = Number(order.total)

    // Cálculos fiscales:
    const netAmount = Number((total / 1.21).toFixed(2))
    const vatAmount = Number((total - netAmount).toFixed(2))
    
    const finalTotal = isExempt ? netAmount : total

    const rows = order.itemOrders
      .map((item) => {
        const itemUnitPrice = Number(item.unitPrice)
        const itemSubtotal = itemUnitPrice * Number(item.amount)
        return `
          <tr>
            <td>${escapeHtml(item.product?.name)}</td>
            <td class="right">${item.amount}</td>
            <td class="right">${money(itemUnitPrice)}</td>
            <td class="right">${money(itemSubtotal)}</td>
          </tr>`
      })
      .join('')

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111; padding: 32px; font-size: 12px; line-height: 1.4; }
    .company-header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 15px; margin-bottom: 15px; position: relative; }
    .company-info h2 { font-size: 16px; margin: 0 0 4px; font-weight: bold; }
    .company-info p { margin: 2px 0; color: #444; font-size: 11px; }
    
    /* Letra central tipo A/B de AFIP */
    .invoice-type-box { position: absolute; left: 50%; transform: translateX(-50%); top: 0; width: 50px; border: 2px solid #111; text-align: center; background: #fff; }
    .invoice-type-letter { font-size: 24px; font-weight: bold; display: block; line-height: 1; padding: 4px 0; border-bottom: 1px solid #111; }
    .invoice-type-code { font-size: 10px; font-weight: bold; padding: 2px 0; }

    .invoice-meta { text-align: right; }
    .invoice-meta h1 { font-size: 16px; margin: 0 0 4px; }
    .invoice-meta p { margin: 2px 0; font-size: 11px; color: #444; }

    .client-box { border: 1px solid #ccc; padding: 10px; margin-bottom: 15px; background: #fafafa; font-size: 12px; }
    .client-box table { width: 100%; border: none; margin: 0; }
    .client-box td { border: none; padding: 3px 0; }

    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th { background: #f0f0f0; border-bottom: 1px solid #111; border-top: 1px solid #111; font-weight: bold; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
    .right { text-align: right; }

    .totals-container { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .cae-box { font-size: 11px; color: #333; }
    .totals-box { width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
    .totals-row.final { font-size: 16px; font-weight: bold; border-top: 2px solid #111; margin-top: 5px; padding-top: 5px; }
    .transparency-notice { font-size: 10px; color: #555; margin-top: 4px; font-style: italic; text-align: right; }
    .alert-banner { font-weight: bold; color: #dc2626; margin-bottom: 8px; }
    .exemption-banner { font-weight: bold; color: #2563eb; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="company-header">
    <div class="company-info">
      <h2>FlowTech SAS</h2>
      <p>Av. Corrientes 1500</p>
      <p>(3400) Corrientes - Corrientes</p>
      <p>Tel.: 0379 448-9900</p>
      <p>Email: contacto@flowtech.com.ar</p>
      <p><strong>IVA RESPONSABLE INSCRIPTO</strong></p>
    </div>

    <div class="invoice-type-box">
      <span class="invoice-type-letter">${badgeLabel}</span>
      <span class="invoice-type-code">COD. 01</span>
    </div>

    <div class="invoice-meta">
      <h1>${documentTitle}</h1>
      <p><strong>N.º ${number}</strong></p>
      <p>Fecha: ${new Date().toLocaleDateString('es-AR')}</p>
      <p>CUIT: 30-71458923-4</p>
      <p>Ingresos Brutos: 905-884123-1</p>
      <p>Inicio de Actividades: 01/2024</p>
    </div>
  </div>

  ${isCancelledOrRejected ? '<div class="alert-banner">COMPROBANTE DE ANULACIÓN (NOTA DE CRÉDITO)</div>' : ''}
  ${isExempt ? '<div class="exemption-banner">OPERACIÓN EXENTA - LEY DE TRANSPARENCIA FISCAL</div>' : ''}

  <div class="client-box">
    <table>
      <tr>
        <td><strong>Señor(es):</strong> ${escapeHtml(order.client?.name)} ${escapeHtml(order.client?.lastname)}</td>
        <td><strong>CUIT / CUIL:</strong> ${clientCuil}</td>
      </tr>
      <tr>
        <td><strong>Domicilio:</strong> ${escapeHtml(addressText)}</td>
        <td><strong>Condición IVA:</strong> ${escapeHtml(clientTaxCondition)}</td>
      </tr>
      <tr>
        <td colspan="2"><strong>Condición de pago:</strong> ${escapeHtml(order.paymentMethod || 'Contado')}</td>
      </tr>
    </table>
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto / Detalle</th>
        <th class="right">Cant.</th>
        <th class="right">Precio unit.</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals-container">
    <div class="cae-box">
      <p><strong>C.A.E.:</strong> 74589123456789</p>
      <p><strong>Vencimiento C.A.E.:</strong> ${new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('es-AR')}</p>
      <p style="margin-top: 10px; font-style: italic; color: #666;">Impreso por el sistema - FlowTech Management</p>
    </div>

    <div class="totals-box">
      ${
        isCancelledOrRejected
          ? `
        <div class="totals-row"><span>Neto Anulado:</span> <span>${money(-netAmount)}</span></div>
        <div class="totals-row"><span>IVA (21%):</span> <span>${money(-vatAmount)}</span></div>
        <div class="transparency-notice">${isExempt ? 'Sujeto Exento - IVA no alcanzado' : 'Ley 27.743 - Transparencia Fiscal al Consumidor'}</div>
        <div class="totals-row final"><span>Total Reintegrado:</span> <span>${money(-finalTotal)}</span></div>
      `
          : `
        <div class="totals-row"><span>Neto Gravado:</span> <span>${money(netAmount)}</span></div>
        <div class="totals-row"><span>IVA (21%):</span> <span>${money(vatAmount)}</span></div>
        <div class="transparency-notice">${isExempt ? 'Sujeto Exento (IVA no gravado)' : 'Ley 27.743 - Transparencia Fiscal al Consumidor'}</div>
        <div class="totals-row final"><span>Total:</span> <span>${money(finalTotal)}</span></div>
      `
      }
    </div>
  </div>
</body>
</html>`
  }

  async savePdf(orderId: bigint, prefix: string, pdf: Buffer): Promise<string> {
    const folder = path.join(app.getPath('userData'), 'invoices')
    await mkdir(folder, { recursive: true })

    const filePath = path.join(folder, `${prefix}-${orderId}.pdf`)
    await writeFile(filePath, pdf)
    return filePath
  }
}

export const invoiceService = new InvoiceService()