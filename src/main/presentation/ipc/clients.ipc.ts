import { ipcMain } from 'electron'
import { CreateClientInput, SearchParams, UpdateClientInput } from '../../domain/types/electron-env'
import { Prisma } from '../../infrastructure/db/generated/client/client'
import { clientsService } from '../../services/clients.service'

export function registerClientIPC(): void {
  ipcMain.handle('clients:update', async (_event, input: UpdateClientInput) => {
    try {
      const data = await clientsService.updateClient(input)
      return { success: true, data }
    } catch (error) {
      console.error('Failed to update client:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo actualizar el cliente.'
      }
    }
  })

  ipcMain.handle('clients:delete', async (_event, id: string) => {
    try {
      const data = await clientsService.deleteClient(id)
      return { success: true, data }
    } catch (error) {
      console.error('Failed to delete client:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo eliminar el cliente.'
      }
    }
  })

  ipcMain.handle('clients:get-all', async (_event, searchParams: SearchParams) => {
    try {
      const result = await clientsService.getClients(searchParams)
      return { success: true, ...result }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudieron cargar los clientes.'
      }
    }
  })

  ipcMain.handle('clients:create', async (_event, input: CreateClientInput) => {
    try {
      const data = await clientsService.createClient(input)
      return { success: true, data }
    } catch (error) {
      console.error('Failed to create client:', error)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const fields = Array.isArray(error.meta?.target) ? error.meta.target : []
        const message = fields.includes('cuil')
          ? 'Ya existe un cliente registrado con ese CUIL/CUIT.'
          : fields.includes('email')
            ? 'Ya existe un cliente registrado con ese email.'
            : 'El cliente ya está registrado.'

        return { success: false, error: message }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo guardar el cliente.'
      }
    }
  })
}
