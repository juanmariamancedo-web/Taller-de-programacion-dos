import { ipcMain } from 'electron';
import { dashboardService } from '../../services/dashboard.service';

export function registerDashboardIPC(): void {
    ipcMain.handle('dashboard:getData', async (_events) => {
        try {
            const rawData = await dashboardService.getDashboardData();

            // Convierte Decimal, BigInt y Date a tipos primitivos JSON planos (string/number)
            const data = JSON.parse(
                JSON.stringify(rawData.data, (_key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                )
            );

            return { success: true, data };
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    });
}