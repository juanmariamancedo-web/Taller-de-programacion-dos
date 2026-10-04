import { ipcMain } from 'electron';
import { ordersService } from '../../services/orders.service';
import { authService } from '../../services/auth.service'; // Tu servicio de auth/sesión
import { SearchParams, CreateOrderPayload, UpdateOrderPayload } from '../../domain/types/electron-env';

export function registerOrderIPC(): void {
  // Obtener órdenes según rol
  ipcMain.handle('orders:getOrders', async (_event, searchParams: SearchParams) => {
    try {
      const session = await authService.getActiveSession();
      
      const sessionContext = session ? {
        userId: Number(session.id),
        roleName: session.roleName,
      } : undefined;

      const rawData = await ordersService.getOrders(searchParams, sessionContext);

      return JSON.parse(
        JSON.stringify(rawData, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al obtener órdenes',
      };
    }
  });

  // Crear orden validando rol
  ipcMain.handle('orders:create', async (_event, payload: CreateOrderPayload) => {
    try {
      const session = await authService.getActiveSession();

      const sessionContext = session ? {
        userId: Number(session.id),
        roleName: session.roleName,
      } : undefined;

      return await ordersService.createOrder(payload, sessionContext);
    } catch (error) {
      console.error('Failed to create order:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al crear la orden',
      };
    }
  });

  // Actualizar orden / estado logístico según rol
  ipcMain.handle('orders:update', async (_event, payload: UpdateOrderPayload) => {
    try {
      const session = await authService.getActiveSession();

      const sessionContext = session ? {
        userId: Number(session.id),
        roleName: session.roleName,
      } : undefined;

      return await ordersService.updateOrder(payload, sessionContext);
    } catch (error) {
      console.error('Failed to update order:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al actualizar la orden',
      };
    }
  });
    ipcMain.handle('orders:updateState', async (_event, payload: { id: number | string; currentStateId: number; trackingNumber?: string; notes?: string }) => {
        try {
            const session = await authService.getActiveSession()

            const sessionContext = session ? {
            userId: Number(session.id),
            roleName: session.roleName,
            } : undefined

            return await ordersService.updateOrderState(payload, sessionContext)
        } catch (error) {
            console.error('Failed to update order state:', error)
            return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al cambiar el estado logístico',
            }
        }
    })
}