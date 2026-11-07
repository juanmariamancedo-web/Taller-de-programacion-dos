import { BrowserWindow, ipcMain } from 'electron';
import { ordersService } from '../../services/orders.service';
import { authService } from '../../services/auth.service';
import { SearchParams, CreateOrderPayload, UpdateOrderPayload } from '../../domain/types/electron-env';

function notifyReportsUpdated(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('reports:updated');
  }
}

// NUEVO: Notificador global para cambios de stock en tiempo real
function notifyStockUpdated(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('products:stock-updated');
  }
}

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

      const response = await ordersService.createOrder(payload, sessionContext);
      if (response.success) {
        notifyReportsUpdated();
        notifyStockUpdated(); // <--- Notifica stock actualizado
      }
      return response;
    } catch (error) {
      console.error('Failed to create order:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al crear la orden',
      };
    }
  });

  // Actualizar orden / sincronizar stock reservado del borrador
  ipcMain.handle('orders:update', async (_event, payload: UpdateOrderPayload) => {
    try {
      const session = await authService.getActiveSession();

      const sessionContext = session ? {
        userId: Number(session.id),
        roleName: session.roleName,
      } : undefined;

      const response = await ordersService.updateOrder(payload, sessionContext);
      if (response.success) {
        notifyReportsUpdated();
        notifyStockUpdated(); // <--- Notifica stock actualizado
      }
      return response;
    } catch (error) {
      console.error('Failed to update order:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al actualizar la orden',
      };
    }
  });

  ipcMain.handle(
    'orders:updateState',
    async (
      _event,
      payload: {
        id: number | string;
        currentStateId: number;
        trackingNumber?: string;
        notes?: string;
        location?: string;
        invoiceType?: 'A' | 'B' | 'EXENTO';
        paymentMethod?: string;
      }
    ) => {
      try {
        const session = await authService.getActiveSession();

        const sessionContext = session ? {
          userId: Number(session.id),
          roleName: session.roleName,
        } : undefined;

        const response = await ordersService.updateOrderState(payload, sessionContext);
        if (response.success) {
          notifyReportsUpdated();
          notifyStockUpdated(); // <--- Notifica stock actualizado
        }
        return response;
      } catch (error) {
        console.error('Failed to update order state:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Error al cambiar el estado logístico',
        };
      }
    }
  );

  ipcMain.handle(
    'orders:reserve-stock',
    async (
      _event,
      payload: UpdateOrderPayload
    ) => {
      try {
        const session = await authService.getActiveSession();

        const sessionContext = session ? {
          userId: Number(session.id),
          roleName: session.roleName,
        } : undefined;

        const res = await ordersService.updateOrder(payload, sessionContext);
        if (res.success) notifyStockUpdated();
        return res;
      } catch (error) {
        console.error('Failed to reserve order stock:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Error al reservar el stock',
        };
      }
    }
  );

  ipcMain.handle('orders:release-reservation', async (_event, orderId: number | string) => {
    try {
      const session = await authService.getActiveSession();

      const sessionContext = session ? {
        userId: Number(session.id),
        roleName: session.roleName,
      } : undefined;

      const res = await ordersService.updateOrderState({
        id: orderId,
        currentStateId: 5,
        notes: 'Cancelado automáticamente al cerrar el formulario',
      }, sessionContext);

      if (res.success) notifyStockUpdated();
      return res;
    } catch (error) {
      console.error('Failed to release order reservation:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al liberar la reserva',
      };
    }
  });
}