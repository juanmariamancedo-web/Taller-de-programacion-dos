import { DashboardDataResponse } from '../domain/types/electron-env';
import { prisma } from '../infrastructure/db/prisma';

export class DashboardService {
  async getDashboardData(): Promise<DashboardDataResponse> {
    const [
      registeredClients,
      pendingOrders,
      deliveredOrders,
      totalOrdersCount,
      lastOrders,
      ordersTotalAggregate,
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

      // Solución al error de TypeScript: Incluimos 'currentState'
      prisma.order.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          currentState: true,
        },
      }),

      // Dado que Order tiene el campo `total`, agregamos directo desde la DB
      prisma.order.aggregate({
        _sum: {
          total: true,
        },
      }),
    ]);

    const totalRevenue = Number(ordersTotalAggregate._sum.total ?? 0);
    const averageTicket = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

    return {
      success: true,
      data: {
        registeredClients,
        pendingOrders,
        deliveredOrders,
        averageTicket,
        lastOrders,
      },
    };
  }
}

export const dashboardService = new DashboardService();