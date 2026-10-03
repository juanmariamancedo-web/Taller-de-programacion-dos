import { prisma } from '../infrastructure/db/prisma';
import {
  SearchParams,
  CreateOrderPayload,
  CreateOrderResponse,
  UpdateOrderPayload,
  OrderMutationResponse,
  UpdateOrderStatePayload,
} from '../domain/types/electron-env';
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

    // 1. Vendedor: Solo ve sus propias órdenes ("Mis Órdenes")
    if (roleName === 'vendedor' && currentUserId) {
      where.sellerId = BigInt(currentUserId);
    }

    // 2. Operador: Solo ve órdenes en flujo logístico activo
    if (roleName === 'operador') {
      where.currentStateId = { in: [BigInt(1), BigInt(2), BigInt(3), BigInt(4)] };
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
      id: Number(order.id),
      clientId: Number(order.clientId),
      sellerId: Number(order.sellerId),
      currentStateId: Number(order.currentStateId),
      shippingAddressId: order.shippingAddressId ? Number(order.shippingAddressId) : null,
      items: order.itemOrders.map((item) => ({
        id: Number(item.id),
        productId: Number(item.productId),
        description: item.product?.name ?? '',
        quantity: Number(item.amount),
        unitPrice: Number(item.unitPrice),
      })),
    }));

    return {
      success: true,
      data: formattedOrders,
      totalPages: Math.ceil(totalOrders / limit),
    };
  }

  async createOrder(payload: CreateOrderPayload, sessionContext?: UserSessionContext): Promise<CreateOrderResponse> {
    try {
      const roleName = sessionContext?.roleName?.toLowerCase();

      if (roleName === 'operador' || roleName === 'supervisor') {
        return {
          success: false,
          message: 'Tu rol no tiene permisos para emitir nuevas órdenes de compra',
        };
      }

      const clientId = Number(payload.clientId);
      const shippingAddressId = payload.shippingAddressId ? Number(payload.shippingAddressId) : null;
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
            clientId: BigInt(clientId),
            sellerId: BigInt(sellerId),
            total: Number(total),
            currentStateId: BigInt(1), // Estado borrador/creado
            ...(shippingAddressId && { shippingAddressId: BigInt(shippingAddressId) }),
            itemOrders: {
              create: items.map((item) => ({
                productId: BigInt(item.productId),
                amount: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
              })),
            },
          },
        });

        // Registro de auditoría inicial si existe dirección de envío
        if (shippingAddressId) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              stateId: BigInt(1),
              addressId: BigInt(shippingAddressId),
              notes: 'Creación de la orden de compra',
            },
          });
        }

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
      const { id, clientId, sellerId, shippingAddressId, items, total, currentStateId, trackingNumber } = payload;
      const roleName = sessionContext?.roleName?.toLowerCase();
      const orderId = BigInt(id);

      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!existingOrder) {
        return { success: false, message: 'La orden no existe' };
      }

      // Vendedor: Solo puede editar sus propias órdenes y únicamente en estado borrador (1)
      if (roleName === 'vendedor') {
        if (Number(existingOrder.sellerId) !== Number(sessionContext?.userId)) {
          return { success: false, message: 'No tenés permisos para modificar órdenes de otros vendedores' };
        }
        if (Number(existingOrder.currentStateId) !== 1) {
          return { success: false, message: 'No podés editar una orden que ya inició procesamiento logístico' };
        }
      }

      // Operador: Redirige o limita la actualización al estado logístico
      if (roleName === 'operador') {
        if (currentStateId) {
          return this.updateOrderState(
            { id, currentStateId: Number(currentStateId), trackingNumber },
            sessionContext
          );
        }
        return { success: false, message: 'Los operadores solo pueden modificar el estado logístico de la orden' };
      }

      // Cancelación / Rechazo (ID 6): Requiere Supervisor o Administrador
      const REJECTED_STATE_ID = 6;
      if (currentStateId && Number(currentStateId) === REJECTED_STATE_ID && roleName !== 'admin' && roleName !== 'supervisor') {
        return {
          success: false,
          message: 'Se requieren permisos de Supervisor o Administrador para rechazar o cancelar una orden',
        };
      }

      const parsedClientId = clientId ? BigInt(clientId) : existingOrder.clientId;
      const parsedSellerId = sellerId ? BigInt(sellerId) : existingOrder.sellerId;
      const parsedAddressId = shippingAddressId ? BigInt(shippingAddressId) : existingOrder.shippingAddressId;
      const parsedTotal = total !== undefined ? Number(total) : Number(existingOrder.total);

      const updatedOrder = await prisma.$transaction(async (tx) => {
        if (items && items.length > 0) {
          await tx.itemOrder.deleteMany({
            where: { orderId },
          });
        }

        const order = await tx.order.update({
          where: { id: orderId },
          data: {
            clientId: parsedClientId,
            sellerId: parsedSellerId,
            shippingAddressId: parsedAddressId,
            total: parsedTotal,
            ...(currentStateId && { currentStateId: BigInt(currentStateId) }),
            ...(trackingNumber && { trackingNumber }),
            ...(items && items.length > 0 && {
              itemOrders: {
                create: items.map((item) => ({
                  productId: BigInt(item.productId),
                  amount: Number(item.quantity),
                  unitPrice: Number(item.unitPrice),
                })),
              },
            }),
          },
        });

        if (currentStateId && parsedAddressId) {
          await tx.orderStatusHistory.create({
            data: {
              orderId,
              stateId: BigInt(currentStateId),
              addressId: parsedAddressId,
              notes: payload.notes || `Modificación integral de orden por ${roleName}`,
            },
          });
        }

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

  async updateOrderState(
    payload: UpdateOrderStatePayload,
    sessionContext?: UserSessionContext
  ): Promise<OrderMutationResponse> {
    try {
      const { id, currentStateId, trackingNumber, notes } = payload;
      const roleName = sessionContext?.roleName?.toLowerCase();
      const orderId = BigInt(id);

      if (roleName === 'vendedor') {
        return {
          success: false,
          message: 'Los vendedores no tienen permisos para modificar el estado logístico.',
        };
      }

      const REJECTED_STATE_ID = 6;
      if (Number(currentStateId) === REJECTED_STATE_ID && roleName !== 'admin' && roleName !== 'supervisor') {
        return {
          success: false,
          message: 'Se requieren permisos de Supervisor o Administrador para rechazar o cancelar una orden.',
        };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          throw new Error('La orden especificada no existe.');
        }

        if (Number(currentStateId) >= 3 && !trackingNumber && !order.trackingNumber) {
          throw new Error('El número de seguimiento (tracking number) es obligatorio al despachar el paquete.');
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            currentStateId: BigInt(currentStateId),
            ...(trackingNumber && { trackingNumber }),
          },
        });

        if (order.shippingAddressId) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              stateId: BigInt(currentStateId),
              addressId: order.shippingAddressId,
              notes: notes || `Estado actualizado a ID ${currentStateId} por ${roleName}`,
            },
          });
        }

        return updated;
      });

      return {
        success: true,
        orderId: Number(updatedOrder.id),
        message: 'Estado logístico e historial actualizados correctamente.',
      };
    } catch (err: any) {
      console.error('Error en updateOrderState:', err);
      return {
        success: false,
        message: err.message || 'Error al actualizar el estado logístico de la orden.',
      };
    }
  }
}

export const ordersService = new OrdersService();