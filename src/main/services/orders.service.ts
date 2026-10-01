import { prisma } from '../infrastructure/db/prisma';
import { SearchParams, CreateOrderPayload, CreateOrderResponse, UpdateOrderPayload, OrderMutationResponse } from '../domain/types/electron-env';
import { Prisma } from '../infrastructure/db/generated/client/client';

export class OrdersService {
  async getOrders(searchParams?: SearchParams, userId?: number) {
    const page = searchParams?.page ?? 1;
    const limit = 5;

    const sortMap: Record<string, Prisma.OrderOrderByWithRelationInput> = {
      idAsc: { id: 'asc' },
      idDesc: { id: 'desc' },
      clientAsc: { client: { name: 'asc' } },
      clientDesc: { client: { name: 'desc' } },
      totalAsc: { total: 'asc' },
      totalDesc: { total: 'desc' },
      stateAsc: { currentState: { name: 'asc' } },
      stateDesc: { currentState: { name: 'desc' } },
    };

    const orderBy =
      searchParams?.sort && sortMap[searchParams.sort]
        ? sortMap[searchParams.sort]
        : { createdAt: 'desc' as const };

    const search = searchParams?.search?.trim();
    const parsedUserId = userId !== undefined && userId !== null ? Number(userId) : undefined;

    const where: Prisma.OrderWhereInput = {
      ...(parsedUserId !== undefined && !Number.isNaN(parsedUserId) && { sellerId: parsedUserId }),
      ...(search && {
        client: {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
      }),
    };

    const [totalOrders, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          currentState: { select: { id: true, name: true } },
          client: true,
          shippingAddress: {
            include: { city: true },
          },
          itemOrders: {
            include: {
              product: true,
            },
          },
        },
      }),
    ]);

    const formattedOrders = orders.map((order) => ({
      ...order,
      items: order.itemOrders.map((item) => ({
        id: Number(item.id),
        productId: Number(item.productId),
        description: item.product?.name ?? '',
        quantity: Number(item.amount), // Mapeamos `amount` de Prisma como `quantity` para la vista
        unitPrice: Number(item.unitPrice),
      })),
    }));

    const totalPages = Math.ceil(totalOrders / limit);

    return {
      success: true,
      data: formattedOrders,
      totalPages,
    };
  }

  async createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
    try {
      const { clientId, sellerId, items, total } = payload;

      if (!clientId || !sellerId || !items || items.length === 0) {
        return {
          success: false,
          message: 'Datos de la orden incompletos (cliente, vendedor e ítems son obligatorios)',
        };
      }

      const newOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            clientId: Number(clientId),
            sellerId: Number(sellerId),
            total: Number(total),
            currentStateId: 1,
            itemOrders: {
              create: items.map((item) => ({
                productId: Number(item.productId),
                amount: Number(item.quantity), // Mapeo de `quantity` a `amount`
                unitPrice: Number(item.unitPrice),
              })),
            },
          },
        });

        return order;
      });

      return {
        success: true,
        orderId: Number(newOrder.id),
        message: 'Orden creada exitosamente',
      };
    } catch (err: any) {
      console.error('Error al crear orden en Prisma:', err);
      return {
        success: false,
        message: err.message || 'Error al guardar la orden en la base de datos',
      };
    }
  }

  async updateOrder(payload: UpdateOrderPayload): Promise<OrderMutationResponse> {
    try {
      const { id, clientId, sellerId, items, total, currentStateId } = payload;

      if (!id || !clientId || !sellerId || !items || items.length === 0) {
        return {
          success: false,
          message: 'Datos insuficientes para actualizar la orden (ID, cliente, vendedor e ítems obligatorios)',
        };
      }

      const orderId = Number(id);
      const parsedClientId = Number(clientId);
      const parsedSellerId = Number(sellerId);
      const parsedTotal = Number(total);

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 1. Eliminar los ítems anteriores de la orden
        await tx.itemOrder.deleteMany({
          where: { orderId: orderId },
        });

        // 2. Actualizar la cabecera de la orden y recrear sus ítems
        const order = await tx.order.update({
          where: { id: orderId },
          data: {
            clientId: parsedClientId,
            sellerId: parsedSellerId,
            total: parsedTotal,
            ...(currentStateId && { currentStateId: Number(currentStateId) }),
            itemOrders: {
              create: items.map((item) => ({
                productId: Number(item.productId),
                amount: Number(item.quantity), // Mapeo de `quantity` a `amount`
                unitPrice: Number(item.unitPrice),
              })),
            },
          },
        });

        return order;
      });

      return {
        success: true,
        orderId: Number(updatedOrder.id),
        message: 'Orden actualizada exitosamente',
      };
    } catch (err: any) {
      console.error('Error al actualizar orden en Prisma:', err);
      return {
        success: false,
        message: err.message || 'Error al actualizar la orden en la base de datos',
      };
    }
  }
}

export const ordersService = new OrdersService();