import { DashboardDataResponse } from '../domain/types/electron-env';
import { prisma } from '../infrastructure/db/prisma';
import { authService } from './auth.service';

export class DashboardService {
  async getDashboardData(sessionContext?: { id?: number | bigint; roleName?: string } | null): Promise<DashboardDataResponse> {
    const activeSession = sessionContext || (await authService.getActiveSession?.());
    const roleName = activeSession?.roleName?.toLowerCase();
    const rawUserId = (activeSession as any)?.userId ?? activeSession?.id;
    const currentUserId = rawUserId !== undefined ? BigInt(rawUserId) : undefined;

    // Filtros base de órdenes según el rol
    const orderWhereClause: any = {};

    if (roleName === 'vendedor' && currentUserId) {
      orderWhereClause.sellerId = currentUserId;
    }

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
          ...orderWhereClause,
          currentState: {
            name: 'pending',
          },
        },
      }),

      prisma.order.count({
        where: {
          ...orderWhereClause,
          currentState: {
            name: 'delivered',
          },
        },
      }),

      prisma.order.count({
        where: orderWhereClause,
      }),

      prisma.order.findMany({
        where: orderWhereClause,
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          currentState: true,
          client: true,
        },
      }),

      prisma.order.aggregate({
        where: orderWhereClause,
        _sum: {
          total: true,
        },
      }),

      prisma.itemOrder.groupBy({
        by: ['productId'],
        ...(roleName === 'vendedor' && currentUserId && {
          where: {
            order: {
              sellerId: currentUserId,
            },
          },
        }),
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
        totalSold: Number(item._sum.amount ?? 0),
      };
    });

    const formattedLastOrders = lastOrders.map((order) => ({
      ...order,
      id: Number(order.id),
      clientId: Number(order.clientId),
      sellerId: Number(order.sellerId),
      currentStateId: Number(order.currentStateId),
      shippingAddressId: order.shippingAddressId ? Number(order.shippingAddressId) : null,
      total: Number(order.total),
    }));

    const totalRevenue = Number(ordersTotalAggregate._sum.total ?? 0);
    const averageTicket = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

    return {
      success: true,
      data: {
        registeredClients,
        pendingOrders,
        deliveredOrders,
        averageTicket,
        lastOrders: formattedLastOrders as any,
        topProducts,
      },
    };
  }
}

export const dashboardService = new DashboardService();