import { ipcMain } from 'electron'
import { backupService } from '../../services/backup.service'

export function registerBackupIPC(): void {
  ipcMain.handle('backup:generate', async () => {
    try {
      return { success: true, ...await backupService.generate() }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'No se pudo generar el backup.' }
    }
  })

  ipcMain.handle('backup:download', async (_event, sourcePath: string) => {
    try {
      await backupService.saveAs(sourcePath)
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'No se pudo descargar el backup.' }
    }
  })

  ipcMain.handle('backup:choose-file', async () => {
    try {
      const selected = await backupService.chooseFile()
      return selected ? { success: true, path: selected } : { success: false, message: 'Selección cancelada.' }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'No se pudo seleccionar el archivo.' }
    }
  })

  ipcMain.handle('backup:restore', async (_event, sourcePath: string) => {
    try {
      await backupService.restore(sourcePath)
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'No se pudo restaurar la base de datos.' }
    }
  })
}
