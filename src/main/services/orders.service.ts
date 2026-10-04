import { prisma } from '../infrastructure/db/prisma';
import { authService } from './auth.service';
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
  userId?: number | bigint;
  id?: number | bigint;
  roleName: 'admin' | 'supervisor' | 'operator' | 'seller' | string;
}

export class OrdersService {
  /**
   * Define las transiciones de estado permitidas en el sistema logístico.
   * Evita retrocesos o saltos inconsistentes (ej. pasar de 'delivered' a 'dispatched').
   */
  private static readonly ALLOWED_TRANSITIONS: Record<number, number[]> = {
    1: [2, 3, 7, 8],    // 'created' -> 'pending', 'paid', 'rejected', 'stock_error'
    2: [3, 7, 8],       // 'pending' -> 'paid', 'rejected', 'stock_error'
    3: [4, 7, 8],       // 'paid'    -> 'dispatched', 'rejected', 'stock_error'
    4: [5, 6, 7],       // 'dispatched' -> 'in_transit', 'delivered', 'rejected'
    5: [6, 7],          // 'in_transit' -> 'delivered', 'rejected'
    6: [],              // 'delivered' es estado terminal (no permite más cambios)
    7: [],              // 'rejected' es estado terminal
    8: [1, 2, 7],       // 'stock_error' -> reacondicionar o rechazar
  };

  private getSessionUserId(session: UserSessionContext | null | undefined): number | undefined {
    if (!session) return undefined;
    const rawId = session.userId ?? session.id;
    return rawId !== undefined ? Number(rawId) : undefined;
  }

  async getOrders(searchParams?: SearchParams, sessionContext?: UserSessionContext | null) {
    const activeSession = sessionContext || (await authService.getActiveSession?.());
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
    const roleName = activeSession?.roleName?.toLowerCase();
    const currentUserId = this.getSessionUserId(activeSession);

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

    if (roleName === 'seller' && currentUserId) {
      where.sellerId = BigInt(currentUserId);
    }

    if (roleName === 'operator') {
      where.currentStateId = { in: [BigInt(1), BigInt(2), BigInt(3), BigInt(4), BigInt(5)] };
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
          orderStatusHistory: {
            orderBy: { id: 'asc' },
            include: {
              state: { select: { id: true, name: true } },
              address: { include: { city: true } },
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
      statusHistory: order.orderStatusHistory.map((history) => ({
        id: Number(history.id),
        orderId: Number(history.orderId),
        stateId: Number(history.stateId),
        addressId: history.addressId ? Number(history.addressId) : null,
        stateName: history.state?.name ?? '',
        location: (history as any).location ?? null,
        notes: history.notes ?? '',
        createdAt: history.createdAt,
      })),
    }));

    return {
      success: true,
      data: formattedOrders,
      totalPages: Math.ceil(totalOrders / limit),
    };
  }

  async createOrder(payload: CreateOrderPayload, sessionContext?: UserSessionContext | null): Promise<CreateOrderResponse> {
    try {
      const activeSession = sessionContext || (await authService.getActiveSession?.());
      const roleName = activeSession?.roleName?.toLowerCase();

      if (roleName === 'operator' || roleName === 'supervisor') {
        return {
          success: false,
          message: 'Tu rol no tiene permisos para emitir nuevas órdenes de compra',
        };
      }

      const clientId = Number(payload.clientId);
      const shippingAddressId = payload.shippingAddressId ? Number(payload.shippingAddressId) : null;
      const currentUserId = this.getSessionUserId(activeSession);
      const sellerId = roleName === 'seller' ? currentUserId : Number(payload.sellerId);
      const { items, total } = payload;

      if (!clientId || !sellerId || !items || items.length === 0) {
        return {
          success: false,
          message: 'Datos de la orden incompletos (cliente, seller e ítems son obligatorios)',
        };
      }

      const newOrder = await prisma.$transaction(async (tx) => {
        // 1. Verificar stock y restar por cada ítem
        for (const item of items) {
          const productId = BigInt(item.productId);
          const requestedQuantity = Number(item.quantity);

          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, stock: true },
          });

          if (!product) {
            throw new Error(`El producto con ID ${item.productId} no existe.`);
          }

          if (product.stock < requestedQuantity) {
            throw new Error(`Stock insuficiente para el producto "${product.name}". Disponible: ${product.stock}, solicitado: ${requestedQuantity}.`);
          }

          // Descontar stock del producto
          await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: requestedQuantity } },
          });
        }

        // 2. Crear la orden de compra
        const order = await tx.order.create({
          data: {
            clientId: BigInt(clientId),
            sellerId: BigInt(sellerId),
            total: Number(total),
            currentStateId: BigInt(1), // 'created'
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

        if (shippingAddressId) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              stateId: BigInt(1),
              addressId: BigInt(shippingAddressId),
              notes: 'Creación de la orden de compra y descuento de stock',
            },
          });
        }

        return order;
      });

      return {
        success: true,
        orderId: Number(newOrder.id),
        message: 'Orden creada exitosamente y stock actualizado.',
      };
    } catch (err: any) {
      console.error('Error al crear orden en Prisma:', err);
      return {
        success: false,
        message: err.message || 'Error al guardar la orden en la base de datos',
      };
    }
  }

  async updateOrder(payload: UpdateOrderPayload, sessionContext?: UserSessionContext | null): Promise<OrderMutationResponse> {
    try {
      const activeSession = sessionContext || (await authService.getActiveSession?.());
      const { id, clientId, sellerId, shippingAddressId, items, total, currentStateId, trackingNumber } = payload;
      const roleName = activeSession?.roleName?.toLowerCase();
      const currentUserId = this.getSessionUserId(activeSession);
      const orderId = BigInt(id);

      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!existingOrder) {
        return { success: false, message: 'La orden no existe' };
      }

      if (roleName === 'seller') {
        if (currentUserId && Number(existingOrder.sellerId) !== currentUserId) {
          return { success: false, message: 'No tenés permisos para modificar órdenes de otros selleres' };
        }
        if (Number(existingOrder.currentStateId) !== 1) {
          return { success: false, message: 'No podés editar una orden que ya inició procesamiento logístico' };
        }
      }

      if (roleName === 'operator') {
        if (currentStateId) {
          return this.updateOrderState(
            { id, currentStateId: Number(currentStateId), trackingNumber, location: (payload as any).location, notes: payload.notes },
            activeSession
          );
        }
        return { success: false, message: 'Los operatores solo pueden modificar el estado logístico de la orden' };
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
    payload: UpdateOrderStatePayload & { location?: string },
    sessionContext?: UserSessionContext | null
  ): Promise<OrderMutationResponse> {
    try {
      const activeSession = sessionContext || (await authService.getActiveSession?.());
      const { id, currentStateId, trackingNumber, notes, location } = payload;
      const roleName = activeSession?.roleName?.toLowerCase();
      const orderId = BigInt(id);
      const targetStateId = Number(currentStateId);

      if (roleName === 'operator') {
        return {
          success: false,
          message: 'Los selleres no tienen permisos para modificar el estado logístico.',
        };
      }

      // Restricción evaluada en backend: operatores no pueden marcar órdenes como rechazadas o canceladas (ID 7)
      if (roleName === 'operator' && targetStateId === 7) {
        return {
          success: false,
          message: 'Acción denegada: Los operatores no tienen permisos para marcar órdenes como rechazadas o canceladas.',
        };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const existingOrder = await tx.order.findUnique({
          where: { id: orderId },
          include: { itemOrders: true },
        });

        if (!existingOrder) {
          throw new Error('La orden especificada no existe.');
        }

        const currentStateInDb = Number(existingOrder.currentStateId);

        // 1. REGLA ANTI-DUPLICADOS
        if (currentStateInDb === targetStateId) {
          throw new Error('La orden ya se encuentra en este estado.');
        }

        // 2. REGLA DE SECUENCIA ILÓGICA
        const allowedNextStates = OrdersService.ALLOWED_TRANSITIONS[currentStateInDb] || [];
        if (!allowedNextStates.includes(targetStateId)) {
          throw new Error(
            `Transición ilógica no permitida: no se puede pasar del estado ID ${currentStateInDb} al estado ID ${targetStateId}.`
          );
        }

        // 3. Validación de Tracking
        if (targetStateId >= 4 && !trackingNumber && !existingOrder.trackingNumber) {
          throw new Error('El número de seguimiento (tracking number) es obligatorio al despachar el paquete.');
        }

        // 4. LIBERAR / DEVOLVER STOCK SI LA ORDEN ES RECHAZADA (ID 7) O DA ERROR DE STOCK (ID 8)
        if ((targetStateId === 7 || targetStateId === 8) && currentStateInDb !== 7 && currentStateInDb !== 8) {
          for (const item of existingOrder.itemOrders) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: Number(item.amount) } },
            });
          }
        }

        // 5. Actualizar la orden principal
        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            currentStateId: BigInt(targetStateId),
            ...(trackingNumber && { trackingNumber }),
          },
        });

        // 6. Registrar el hito en el historial
        if (updated.shippingAddressId) {
          let statusSuffix = '';
          if (targetStateId === 7) statusSuffix = ' (Stock devuelto por rechazo)';
          if (targetStateId === 8) statusSuffix = ' (Stock devuelto por error de stock)';

          const historyNote = location?.trim()
            ? `Ubicación: ${location.trim()}.${notes?.trim() ? ` ${notes.trim()}` : ''}${statusSuffix}`
            : notes?.trim() 
              ? `${notes.trim()}${statusSuffix}`
              : `Estado actualizado a ID ${targetStateId} por ${roleName}${statusSuffix}`;

          await tx.orderStatusHistory.create({
            data: {
              orderId: updated.id,
              stateId: BigInt(targetStateId),
              addressId: updated.shippingAddressId,
              notes: historyNote,
            },
          });
        }

        return updated;
      });

      let successMessage = 'Estado logístico e historial actualizados correctamente.';
      if (targetStateId === 7) successMessage = 'Orden rechazada y stock devuelto exitosamente.';
      if (targetStateId === 8) successMessage = 'Estado marcado como Error de Stock y stock devuelto al inventario.';

      return {
        success: true,
        orderId: Number(updatedOrder.id),
        message: successMessage,
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