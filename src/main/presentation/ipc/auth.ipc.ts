import { ipcMain } from 'electron';
import { authService } from '../../services/auth.service';
import { Credentials } from '../../domain/types/electron-env';

export function registerAuthIPC(): void {
  ipcMain.handle('auth:login', async (_event, credentials: Credentials) => {
    return await authService.login(credentials);
  });

  ipcMain.handle('auth:get-session', async () => {
    return await authService.getActiveSession();
  });

  ipcMain.handle('auth:logout', async () => {
    return await authService.logout();
  });
}