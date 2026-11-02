import { ipcMain } from 'electron';
import { rolesService } from '../../services/roles.servicies';

export function registerRoleIPC(): void {
    ipcMain.handle('roles:getRoles', async (_event) => {
        try {
            const rawData = await rolesService.getOrders()
            
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