import { ipcMain } from 'electron'
import { CreateClientInput } from '../../domain/types/electron-env'
import { clientsService } from '../../services/clients.service'

export function registerClientIPC(): void {
  ipcMain.handle('clients:create', async (_event, input: CreateClientInput) => {
    try {
      const data = await clientsService.createClient(input)
      return { success: true, data }
    } catch (error) {
      console.error('Failed to create client:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo guardar el cliente.'
      }
    }
  })
}
