import { ipcMain } from 'electron'
import { prisma } from '../../infrastructure/db/prisma'

export function registerProvinceIPC(): void {
  ipcMain.handle('provinces:get-all', async () => {
    const provinces = await prisma.province.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    return provinces.map((province) => ({
      id: province.id.toString(),
      name: province.name
    }))
  })
}
