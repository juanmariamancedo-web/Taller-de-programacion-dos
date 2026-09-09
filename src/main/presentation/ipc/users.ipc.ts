import { ipcMain } from 'electron';
import { usersService } from '../../services/users.service';
import { SearchParams } from '../../domain/types/electron-env';

export function registerUserIPC(): void {
    ipcMain.handle('users:getUsers', async (_event, searchParams: SearchParams) => {
        try {
            const rawData = await usersService.getUsers(searchParams);
            
            // Convierte Decimal, BigInt y Date a tipos primitivos JSON planos (string/number)
            const data = JSON.parse(
            JSON.stringify(rawData, (_key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            )
            );

            return data;
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    });
}