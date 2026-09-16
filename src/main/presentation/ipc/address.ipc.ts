import { ipcMain } from 'electron';
import { addressService } from '../../services/address.service';
import { SearchParams } from '../../domain/types/electron-env';

export function registerAddressIPC(): void {
  ipcMain.handle(
    'address:getAddresses',
    async (_event, clientId?: number, searchParams?: SearchParams) => {
      try {
        const rawData = await addressService.getAddresses(clientId, searchParams);

        // Convierte BigInt, Decimal y Date a objetos/primitivos serializables por Electron IPC
        const data = JSON.parse(
          JSON.stringify(rawData, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )
        );

        return data;
      } catch (error) {
        console.error('Failed to fetch addresses:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }
  );
}