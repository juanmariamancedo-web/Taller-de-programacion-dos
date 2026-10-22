import { BrowserWindow, ipcMain, shell } from 'electron'
import { invoiceService } from '../../services/invoce.service'
import { canViewInvoice, getRole, OrderState } from '../../domain/orderStateRules'
import { authService } from '../../services/auth.service'

const OPEN_INVOICE_CHANNEL = 'orders:open-invoice'

async function renderPdf(html: string): Promise<Buffer> {
  const window = new BrowserWindow({ show: false })
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await window.webContents.printToPDF({ pageSize: 'A4' })
  } finally {
    window.destroy()
  }
}

export function registerOrderInvoiceHandler() {
  ipcMain.handle(OPEN_INVOICE_CHANNEL, async (_event, orderId: string, docType?: 'invoice' | 'credit-note') => {
    try {
      const session = await authService.getActiveSession()
      const role = getRole(Number(session?.roleId), session?.roleName)

      const order = await invoiceService.findOrder(orderId)
      if (!order) return { success: false, message: 'Orden no encontrada.' }

      // Si la orden nunca fue facturada/pagada, no tiene comprobante ni nota de crédito
      if (!order.invoiceType) {
        return { success: false, message: 'El comprobante no está disponible para esta orden.' }
      }

      const currentStateId = Number(order.currentStateId)

      if (!canViewInvoice(currentStateId, role)) {
        return { success: false, message: 'El comprobante no está disponible para esta orden.' }
      }

      if (role === 'seller' && Number(order.sellerId) !== Number(session?.id)) {
        return { success: false, message: 'No tenés permiso para ver este comprobante.' }
      }

      const forceInvoice = docType === 'invoice'
      const isCancelledOrRejected = currentStateId === OrderState.Rejected || currentStateId === OrderState.Cancelled
      const isNC = !forceInvoice && isCancelledOrRejected

      const html = invoiceService.buildInvoiceHtml(order, forceInvoice)
      const pdf = await renderPdf(html)
      
      const filePrefix = isNC ? 'nota-credito' : 'factura'
      const filePath = await invoiceService.savePdf(order.id, filePrefix, pdf)

      const openError = await shell.openPath(filePath)
      return openError ? { success: false, message: openError } : { success: true }
    } catch (err) {
      console.error('Error al generar el comprobante:', err)
      return { success: false, message: 'No se pudo generar el comprobante.' }
    }
  })
}