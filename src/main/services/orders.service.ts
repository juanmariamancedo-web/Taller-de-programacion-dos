import { prisma } from '../infrastructure/db/prisma';
import { SearchParams, CreateOrderPayload, CreateOrderResponse, UpdateOrderPayload, OrderMutationResponse } from '../domain/types/electron-env';
import { Prisma } from '../infrastructure/db/generated/client/client';

export interface UserSessionContext {
  userId: number;
  roleName: 'admin' | 'supervisor' | 'operador' | 'vendedor' | string;
}

export class OrdersService {
  async getOrders(searchParams?: SearchParams, sessionContext?: UserSessionContext) {
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
    const roleName = sessionContext?.roleName?.toLowerCase();
    const currentUserId = sessionContext?.userId ? Number(sessionContext.userId) : undefined;

    const where: Prisma.OrderWhereInput = {
      ...(search && {
        client: {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
      }),
    };

    // 1. Filtro por Rol: Vendedor solo ve sus propias órdenes ("Mis Órdenes")
    if (roleName === 'vendedor' && currentUserId) {
      where.sellerId = currentUserId;
    }

    // 2. Filtro por Rol: Operador solo ve órdenes pendientes de preparación/despacho
    if (roleName === 'operador') {
      where.currentStateId = { in: [1, 2] }; // Ej: created, paid
    }

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
        quantity: Number(item.amount),
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

  async createOrder(payload: CreateOrderPayload, sessionContext?: UserSessionContext): Promise<CreateOrderResponse> {
    try {
      const roleName = sessionContext?.roleName?.toLowerCase();

      // Operadores y Supervisores no generan órdenes directamente
      if (roleName === 'operador' || roleName === 'supervisor') {
        return {
          success: false,
          message: 'Tu rol no tiene permisos para emitir nuevas órdenes de compra',
        };
      }

      const clientId = Number(payload.clientId);
      // Asignar automáticamente el ID del vendedor autenticado si es un perfil comercial
      const sellerId = roleName === 'vendedor' ? Number(sessionContext?.userId) : Number(payload.sellerId);
      const { items, total } = payload;

      if (!clientId || !sellerId || !items || items.length === 0) {
        return {
          success: false,
          message: 'Datos de la orden incompletos (cliente, vendedor e ítems son obligatorios)',
        };
      }

      const newOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            clientId,
            sellerId,
            total: Number(total),
            currentStateId: 1, // Estado inicial (creado)
            itemOrders: {
              create: items.map((item) => ({
                productId: Number(item.productId),
                amount: Number(item.quantity),
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

  async updateOrder(payload: UpdateOrderPayload, sessionContext?: UserSessionContext): Promise<OrderMutationResponse> {
    try {
      const { id, clientId, sellerId, items, total, currentStateId } = payload;
      const roleName = sessionContext?.roleName?.toLowerCase();
      const orderId = Number(id);

      // Obtener el estado actual de la orden
      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        select: { currentStateId: true, sellerId: true },
      });

      if (!existingOrder) {
        return { success: false, message: 'La orden no existe' };
      }

      // Restricciones por Rol al actualizar
      if (roleName === 'vendedor') {
        // Un vendedor solo puede editar sus propias órdenes
        if (Number(existingOrder.sellerId) !== Number(sessionContext?.userId)) {
          return { success: false, message: 'No tenés permisos para modificar órdenes de otros vendedores' };
        }
      }

      if (roleName === 'operador') {
        // El operador solo puede actualizar el estado logístico
        if (currentStateId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { currentStateId: Number(currentStateId) },
          });
          return { success: true, orderId, message: 'Estado logístico actualizado correctamente' };
        }
        return { success: false, message: 'Los operadores solo pueden modificar el estado logístico de la orden' };
      }

      // Restricción de Cancelación / Rechazo: Requiere permisos de Supervisor o Administrador
      const REJECTED_STATE_ID = 5; // ID correspondiente a estado Cancelado/Rechazado
      if (currentStateId === REJECTED_STATE_ID && roleName !== 'admin' && roleName !== 'supervisor') {
        return {
          success: false,
          message: 'Se requieren permisos de Supervisor o Administrador para rechazar o cancelar una orden',
        };
      }

      const parsedClientId = Number(clientId);
      const parsedSellerId = Number(sellerId);
      const parsedTotal = Number(total);

      const updatedOrder = await prisma.$transaction(async (tx) => {
        await tx.itemOrder.deleteMany({
          where: { orderId },
        });

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
                amount: Number(item.quantity),
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