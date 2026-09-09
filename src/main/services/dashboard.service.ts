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
      topProductsGrouped,
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

      prisma.order.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          currentState: true,
          client: true, // Incluimos client por si renderizas su nombre
        },
      }),

      prisma.order.aggregate({
        _sum: {
          total: true,
        },
      }),

      // Agrupamos en 'itemOrder' por productId y sumamos 'amount'
      prisma.itemOrder.groupBy({
        by: ['productId'],
        _sum: {
          amount: true,
        },
        orderBy: {
          _sum: {
            amount: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    // Mapeamos los IDs obtenidos para buscar sus detalles
    const productIds = topProductsGrouped.map((item) => item.productId);

    const productsDetails = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
    });

    // Combinamos la información del agrupamiento con los datos del producto
    const topProducts = topProductsGrouped.map((item) => {
      const product = productsDetails.find((p) => p.id === item.productId);
      return {
        id: item.productId,
        name: product?.name ?? 'Producto no encontrado',
        totalSold: item._sum.amount ?? 0,
      };
    });

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
        topProducts,
      },
    };
  }
}

export const dashboardService = new DashboardService();