import { ipcMain } from 'electron'
import type { OrdersReportFilters } from '../../domain/types/electron-env'
import { reportsService } from '../../services/reports.service'

export function registerReportsIPC(): void {
  ipcMain.handle('reports:products', async () => {
    try {
      return { success: true, data: await reportsService.getProductsReport() }
    } catch (error) {
      console.error('Failed to generate products report:', error)
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'No se pudo generar el reporte de productos.'
      }
    }
  })

  ipcMain.handle('reports:clients', async () => {
    try {
      return { success: true, data: await reportsService.getClientsReport() }
    } catch (error) {
      console.error('Failed to generate clients report:', error)
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'No se pudo generar el reporte de clientes.'
      }
    }
  })

  ipcMain.handle('reports:orders', async (_event, filters: OrdersReportFilters) => {
    try {
      return { success: true, data: await reportsService.getOrdersReport(filters) }
    } catch (error) {
      console.error('Failed to generate orders report:', error)
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'No se pudo generar el reporte de órdenes.'
      }
    }
  })
}
