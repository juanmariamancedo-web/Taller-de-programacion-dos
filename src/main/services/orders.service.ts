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
import {
  OrderState,
  canChangeState,
  canEditOrderDetails,
  getRole,
  getStateLabel,
  requiresReason,
  requiresTracking,
  type Role,
} from '../domain/orderStateRules';

export interface UserSessionContext {
  userId?: number | bigint;
  id?: number | bigint;
  roleId?: number | bigint;
  roleName: 'admin' | 'supervisor' | 'operator' | 'seller' | string;
}

type Tx = Prisma.TransactionClient;

/** Estados que cierran la orden sin entregarla: el stock vuelve al inventario. */
const releasesStock = (stateId: number) =>
  stateId === OrderState.Rejected || stateId === OrderState.Cancelled;

export class OrdersService {
  // ─── Helpers ────────────────────────────────────────────────────────────

  private async resolveSession(sessionContext?: UserSessionContext | null) {
    return (sessionContext || (await authService.getActiveSession?.())) as UserSessionContext | null | undefined;
  }

  private getSessionUserId(session: UserSessionContext | null | undefined): number | undefined {
    if (!session) return undefined;
    const rawId = session.userId ?? session.id;
    return rawId !== undefined ? Number(rawId) : undefined;
  }

  private getSessionRole(session: UserSessionContext | null | undefined): Role | null {
    const roleId = session?.roleId !== undefined ? Number(session.roleId) : undefined;
    return getRole(roleId, session?.roleName);
  }

  /** Un seller solo puede operar sobre sus propias órdenes. */
  private assertSellerOwnsOrder(role: Role | null, orderSellerId: bigint, userId?: number) {
    if (role === 'seller' && Number(orderSellerId) !== userId) {
      throw new Error('No tenés permisos para modificar órdenes de otros vendedores.');
    }
  }

  /** Verifica el stock de cada ítem y lo descuenta. */
  private async reserveStock(
    tx: Tx,
    items: { productId: number | bigint | string; quantity: number | string }[]
  ) {
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
        throw new Error(
          `Stock insuficiente para el producto "${product.name}". Disponible: ${product.stock}, solicitado: ${requestedQuantity}.`
        );
      }

      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: requestedQuantity } },
      });
    }
  }

  /** Devuelve al inventario el stock de ítems ya guardados en la base. */
  private async releaseStock(tx: Tx, items: { productId: bigint; amount: number | bigint }[]) {
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: Number(item.amount) } },
      });
    }
  }

  // ─── Consultas ──────────────────────────────────────────────────────────

  async getOrders(searchParams?: SearchParams, sessionContext?: UserSessionContext | null) {
    const activeSession = await this.resolveSession(sessionContext);
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
    const role = this.getSessionRole(activeSession);
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

    if (role === 'seller' && currentUserId) {
      where.sellerId = BigInt(currentUserId);
    }

    // El operator solo ve las órdenes con las que puede trabajar: pagadas y en camino
    if (role === 'operator') {
      where.currentStateId = { in: [BigInt(OrderState.Paid), BigInt(OrderState.InTransit)] };
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

  // ─── Crear ──────────────────────────────────────────────────────────────

  async createOrder(payload: CreateOrderPayload, sessionContext?: UserSessionContext | null): Promise<CreateOrderResponse> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);

      if (role !== 'seller' && role !== 'admin') {
        return {
          success: false,
          message: 'Tu rol no tiene permisos para emitir nuevas órdenes de compra',
        };
      }

      const clientId = Number(payload.clientId);
      const shippingAddressId = payload.shippingAddressId ? Number(payload.shippingAddressId) : null;
      const currentUserId = this.getSessionUserId(activeSession);
      const sellerId = role === 'seller' ? currentUserId : Number(payload.sellerId);
      const { items, total } = payload;

      if (!clientId || !sellerId || !items || items.length === 0) {
        return {
          success: false,
          message: 'Datos de la orden incompletos (cliente, seller e ítems son obligatorios)',
        };
      }

      // Estado con el que nace la orden: borrador, pendiente de pago o pagada
      const initialStateId = Number(payload.initialStateId ?? OrderState.Created);
      const creatableStates: number[] = [OrderState.Created, OrderState.Pending, OrderState.Paid];
      const isAllowedInitialState =
        creatableStates.includes(initialStateId) &&
        (initialStateId === OrderState.Created || canChangeState(OrderState.Created, initialStateId, role));

      if (!isAllowedInitialState) {
        return {
          success: false,
          message: `Tu rol no puede crear órdenes en estado "${getStateLabel(initialStateId)}".`,
        };
      }

      const newOrder = await prisma.$transaction(async (tx) => {
        await this.reserveStock(tx, items);

        const order = await tx.order.create({
          data: {
            clientId: BigInt(clientId),
            sellerId: BigInt(sellerId),
            total: Number(total),
            currentStateId: BigInt(initialStateId),
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
              stateId: BigInt(initialStateId),
              addressId: BigInt(shippingAddressId),
              notes:
                initialStateId === OrderState.Created
                  ? 'Creación de la orden de compra y descuento de stock'
                  : `Creación de la orden en estado "${getStateLabel(initialStateId)}" y descuento de stock`,
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

  // ─── Editar datos (solo mientras es borrador) ───────────────────────────

  async updateOrder(payload: UpdateOrderPayload, sessionContext?: UserSessionContext | null): Promise<OrderMutationResponse> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);
      const { id, clientId, shippingAddressId, items, total } = payload;
      const orderId = BigInt(id);

      const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (!existingOrder) {
        return { success: false, message: 'La orden no existe' };
      }

      this.assertSellerOwnsOrder(role, existingOrder.sellerId, this.getSessionUserId(activeSession));

      if (!canEditOrderDetails(Number(existingOrder.currentStateId), role)) {
        return {
          success: false,
          message: 'La orden ya fue confirmada: solo se puede editar mientras es un borrador.',
        };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const hasNewItems = Boolean(items && items.length > 0);

        // Los ítems viejos devuelven su stock y los nuevos lo vuelven a descontar
        if (hasNewItems) {
          const previousItems = await tx.itemOrder.findMany({ where: { orderId } });
          await this.releaseStock(tx, previousItems);
          await tx.itemOrder.deleteMany({ where: { orderId } });
          await this.reserveStock(tx, items!);
        }

        // El estado y el tracking solo cambian por updateOrderState
        return tx.order.update({
          where: { id: orderId },
          data: {
            clientId: clientId ? BigInt(clientId) : existingOrder.clientId,
            shippingAddressId: shippingAddressId ? BigInt(shippingAddressId) : existingOrder.shippingAddressId,
            total: total !== undefined ? Number(total) : Number(existingOrder.total),
            ...(hasNewItems && {
              itemOrders: {
                create: items!.map((item) => ({
                  productId: BigInt(item.productId),
                  amount: Number(item.quantity),
                  unitPrice: Number(item.unitPrice),
                })),
              },
            }),
          },
        });
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

  // ─── Cambiar estado ─────────────────────────────────────────────────────

  async updateOrderState(
    payload: UpdateOrderStatePayload & { location?: string },
    sessionContext?: UserSessionContext | null
  ): Promise<OrderMutationResponse> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);
      const { id, currentStateId, trackingNumber, notes, location } = payload;
      const orderId = BigInt(id);
      const targetStateId = Number(currentStateId);

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const existingOrder = await tx.order.findUnique({
          where: { id: orderId },
          include: { itemOrders: true },
        });

        if (!existingOrder) {
          throw new Error('La orden especificada no existe.');
        }

        this.assertSellerOwnsOrder(role, existingOrder.sellerId, this.getSessionUserId(activeSession));

        // Una sola regla decide rol + transición (ver orderStateRules.ts)
        const currentState = Number(existingOrder.currentStateId);
        if (!canChangeState(currentState, targetStateId, role)) {
          throw new Error(
            `Tu rol no puede pasar la orden de "${getStateLabel(currentState)}" a "${getStateLabel(targetStateId)}".`
          );
        }

        if (requiresTracking(targetStateId) && !trackingNumber?.trim() && !existingOrder.trackingNumber) {
          throw new Error('El número de seguimiento (tracking) es obligatorio para poner la orden en camino.');
        }

        if (requiresReason(targetStateId) && !notes?.trim()) {
          throw new Error('Indicá el motivo del rechazo o la cancelación.');
        }

        // Si la orden se cierra sin entregarse, el stock vuelve al inventario
        if (releasesStock(targetStateId)) {
          await this.releaseStock(tx, existingOrder.itemOrders);
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            currentStateId: BigInt(targetStateId),
            ...(trackingNumber?.trim() && { trackingNumber: trackingNumber.trim() }),
          },
        });

        if (updated.shippingAddressId) {
          const noteParts = [
            location?.trim() && `Ubicación: ${location.trim()}.`,
            notes?.trim(),
            releasesStock(targetStateId) && '(Stock devuelto)',
          ].filter(Boolean);

          await tx.orderStatusHistory.create({
            data: {
              orderId: updated.id,
              stateId: BigInt(targetStateId),
              addressId: updated.shippingAddressId,
              notes: noteParts.length > 0 ? noteParts.join(' ') : `Estado actualizado a "${getStateLabel(targetStateId)}"`,
            },
          });
        }

        return updated;
      });

      return {
        success: true,
        orderId: Number(updatedOrder.id),
        message: releasesStock(targetStateId)
          ? 'Orden cerrada y stock devuelto al inventario.'
          : 'Estado de la orden actualizado correctamente.',
      };
    } catch (err: any) {
      console.error('Error en updateOrderState:', err);
      return {
        success: false,
        message: err.message || 'Error al actualizar el estado de la orden.',
      };
    }
  }
}

export const ordersService = new OrdersService();