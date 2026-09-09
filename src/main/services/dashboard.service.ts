import { DashboardDataResponse } from '../domain/types/electron-env';
import { prisma } from '../infrastructure/db/prisma';

export class DashboardService {
  async getDashboardData(): Promise<DashboardDataResponse> {
    // 1. Ejecutamos todas las consultas independientes en paralelo
    const [
      registeredClients,
      pendingOrders,
      deliveredOrders,
      totalOrdersCount,
      itemOrders,
    ] = await Promise.all([
      prisma.client.count(),

      prisma.order.count({
        where: {
          currentState: {
            name: 'pending',
          },
        },
      }),

      prisma.order.count({
        where: {
          currentState: {
            name: 'delivered',
          },
        },
      }),

      prisma.order.count(),

      prisma.itemOrder.findMany({
        select: {
          amount: true,
          unitPrice: true,
        },
      }),
    ]);

    const totalRevenue = itemOrders.reduce((acc, item) => {
      return acc + item.amount * Number(item.unitPrice);
    }, 0);

    const averageTicket = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

    return {
      success: true,
      data: {
        registeredClients,
        pendingOrders,
        deliveredOrders,
        averageTicket,
      },
    };
  }
}

export const dashboardService = new DashboardService();