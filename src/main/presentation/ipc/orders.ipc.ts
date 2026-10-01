import { ipcMain } from 'electron';
import { ordersService } from '../../services/orders.service';
import { CreateOrderPayload, UpdateOrderPayload } from '../../domain/types/electron-env';

export function registerOrderIPC(): void {
    ipcMain.handle('orders:getOrders', async (event, searchParams, userId) => {
        try {
            const rawData = await ordersService.getOrders(searchParams, userId);
            
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
    ipcMain.handle('orders:create', async (_event, payload: CreateOrderPayload) => {
        return await ordersService.createOrder(payload);
    });
    ipcMain.handle('orders:update', async (_event, payload: UpdateOrderPayload) => {
        return await ordersService.updateOrder(payload);
    });
}