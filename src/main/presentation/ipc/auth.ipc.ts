import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { authService } from "../../services/auth.service"
import { Credentials, AuthResponse } from '../../domain/types/electron-env';

export function registerAuthIPC(): void {
  ipcMain.handle(
    'auth:login',
    async (_event: IpcMainInvokeEvent, credentials: Credentials): Promise<AuthResponse> => {
      return await authService.login(credentials);
    }
  );
}