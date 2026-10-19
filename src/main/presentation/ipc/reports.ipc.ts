import { BrowserWindow, ipcMain, shell } from 'electron'
import { randomUUID } from 'crypto'
import { createServer } from 'http'
import type { Server } from 'http'
import type { OrdersReportFilters, ReportPdfInput } from '../../domain/types/electron-env'
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

  ipcMain.handle('reports:export-pdf', async (event, input: ReportPdfInput) => {
    let pdfWindow: BrowserWindow | undefined
    let pdfServer: Server | undefined
    let serverTimeout: NodeJS.Timeout | undefined
    let browserOpened = false
    try {
      if (
        !input ||
        typeof input.title !== 'string' ||
        typeof input.html !== 'string' ||
        input.html.length === 0 ||
        input.html.length > 15_000_000
      ) {
        throw new Error('El contenido del informe no es válido o supera el tamaño permitido.')
      }

      const safeTitle =
        input.title
          .replace(/[<>:"/\\|?*]/g, '_')
          .trim()
          .replace(/[. ]+$/g, '') || 'Reporte'
      const resourcePath = `/report-${randomUUID()}.pdf`
      pdfWindow = new BrowserWindow({
        show: false,
        width: 1280,
        height: 900,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      })
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(input.html)}`)
      await pdfWindow.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
      const pdf = await pdfWindow.webContents.printToPDF({
        pageSize: 'A4',
        landscape: true,
        printBackground: true,
        margins: { top: 0.5, bottom: 0.5, left: 0.45, right: 0.45 }
      })

      pdfServer = createServer((request, response) => {
        if (
          request.url !== resourcePath ||
          (request.method !== 'GET' && request.method !== 'HEAD')
        ) {
          response.writeHead(404).end()
          return
        }

        const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/)
        if (request.headers.range && !range) {
          response.writeHead(416, { 'Content-Range': `bytes */${pdf.length}` }).end()
          return
        }

        let start = 0
        let end = pdf.length - 1
        if (range) {
          start = range[1] ? Number(range[1]) : Math.max(pdf.length - Number(range[2]), 0)
          end = range[2] && range[1] ? Math.min(Number(range[2]), end) : end
          if (start > end || start >= pdf.length) {
            response.writeHead(416, { 'Content-Range': `bytes */${pdf.length}` }).end()
            return
          }
        }

        const headers = {
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
          'Content-Disposition': `inline; filename="${safeTitle}.pdf"`,
          'Content-Length': end - start + 1,
          'Content-Type': 'application/pdf'
        }
        if (range) {
          response.writeHead(206, {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${pdf.length}`
          })
        } else {
          response.writeHead(200, headers)
        }
        response.end(request.method === 'HEAD' ? undefined : pdf.subarray(start, end + 1))
      })

      await new Promise<void>((resolve, reject) => {
        pdfServer?.once('error', reject)
        pdfServer?.listen(0, '127.0.0.1', resolve)
      })
      const address = pdfServer.address()
      if (!address || typeof address === 'string') {
        throw new Error('No se pudo iniciar el visor temporal del PDF.')
      }

      serverTimeout = setTimeout(() => pdfServer?.close(), 10 * 60 * 1000)
      serverTimeout.unref()
      pdfServer.unref()
      await shell.openExternal(`http://127.0.0.1:${address.port}${resourcePath}`)
      browserOpened = true

      return { success: true }
    } catch (error) {
      console.error('Failed to export report PDF:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'No se pudo generar el PDF.'
      }
    } finally {
      if (pdfWindow && !pdfWindow.isDestroyed()) pdfWindow.close()
      if (!browserOpened) pdfServer?.close()
      if (!browserOpened && serverTimeout) clearTimeout(serverTimeout)
    }
  })
}
