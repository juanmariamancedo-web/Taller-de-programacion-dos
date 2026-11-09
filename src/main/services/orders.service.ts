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

/** Estados que cierran la orden liberando el stock. */
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

  private assertSellerOwnsOrder(role: Role | null, orderSellerId: bigint, userId?: number) {
    if (role === 'seller' && Number(orderSellerId) !== userId) {
      throw new Error('No tenés permisos para modificar órdenes de otros vendedores.');
    }
  }

  private async updateReservedStock(tx: Tx, productId: bigint, delta: number) {
    if (delta === 0) return;
    
    const product = await tx.product.findUnique({ where: { id: productId }, select: { stock: true, reservedStock: true, name: true } });
    if (!product) return;

    const newReserved = product.reservedStock + delta;
    
    if (newReserved > product.stock) {
      throw new Error(`Stock insuficiente para "${product.name}". Stock físico: ${product.stock}, ya reservado: ${product.reservedStock}, intentas reservar: ${delta}.`);
    }

    await tx.product.update({
      where: { id: productId },
      data: { reservedStock: Math.max(0, newReserved) }
    });
  }

  private async releaseReservedStock(tx: Tx, orderId: bigint) {
    const items = await tx.itemOrder.findMany({ where: { orderId } });

    for (const item of items) {
      await this.updateReservedStock(tx, item.productId, -Number(item.amount));
    }
  }

  private async finalizeStockDeduction(tx: Tx, items: { productId: bigint; amount: number | bigint }[]) {
    for (const item of items) {
      const qty = Number(item.amount);
      if (qty <= 0) continue;

      await tx.$executeRaw`
        SELECT sp_actualizar_stock_producto(${item.productId}::bigint, ${-qty}::integer)
      `;
    }
  }

  private async fetchAddressSnapshot(tx: Tx, shippingAddressId: number | bigint) {
    const dbAddress = await tx.address.findUnique({
      where: { id: BigInt(shippingAddressId) },
      include: { city: true },
    });

    if (!dbAddress) return null;

    return {
      shippingStreet: dbAddress.street,
      shippingNumber: dbAddress.number,
      shippingFloor: dbAddress.floor,
      shippingApartment: dbAddress.apartment,
      shippingPostalCode: dbAddress.postalCode,
      shippingCityName: dbAddress.city?.name ?? '',
    };
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
        client: { name: { contains: search, mode: 'insensitive' } },
      }),
    };

    if (role === 'seller' && currentUserId) {
      where.sellerId = BigInt(currentUserId);
    }

    if (role === 'operator') {
      where.currentStateId = { in: [BigInt(OrderState.Paid), BigInt(OrderState.InTransit)] };
    }

    if (searchParams?.stateFilter) {
      where.currentStateId = BigInt(searchParams.stateFilter);
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
          shippingAddress: { include: { city: true } },
          itemOrders: { include: { product: true } },
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

    const formattedOrders = orders.map((order) => {
      const isDraft = Number(order.currentStateId) === OrderState.Created;
      const liveAddr = order.shippingAddress;

      const street = isDraft && liveAddr ? liveAddr.street : (order.shippingStreet ?? (liveAddr?.street ?? ''));
      const number = isDraft && liveAddr ? liveAddr.number : (order.shippingNumber ?? (liveAddr?.number ?? 0));
      const floor = isDraft && liveAddr ? liveAddr.floor : (order.shippingFloor ?? (liveAddr?.floor ?? null));
      const apartment = isDraft && liveAddr ? liveAddr.apartment : (order.shippingApartment ?? (liveAddr?.apartment ?? null));
      const postalCode = isDraft && liveAddr ? liveAddr.postalCode : (order.shippingPostalCode ?? (liveAddr?.postalCode ?? ''));
      const cityName = isDraft && liveAddr ? (liveAddr.city?.name ?? '') : (order.shippingCityName ?? (liveAddr?.city?.name ?? ''));

      return {
        ...order,
        id: Number(order.id),
        clientId: order.clientId ? Number(order.clientId) : null,
        sellerId: Number(order.sellerId),
        currentStateId: Number(order.currentStateId),
        shippingAddressId: order.shippingAddressId ? Number(order.shippingAddressId) : null,
        invoiceType: order.invoiceType ?? null,
        paymentMethod: order.paymentMethod,
        
        shippingStreet: street,
        shippingNumber: number,
        shippingFloor: floor,
        shippingApartment: apartment,
        shippingPostalCode: postalCode,
        shippingCityName: cityName,

        shippingAddress: order.shippingAddressId ? {
          id: Number(order.shippingAddressId),
          street,
          number,
          floor,
          apartment,
          postalCode,
          city: { name: cityName },
        } : null,

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
      };
    });

    return {
      success: true,
      data: formattedOrders,
      totalPages: Math.ceil(totalOrders / limit),
    };
  }

  // ─── Crear / Borrador Inicial 

  async createOrder(
    payload: CreateOrderPayload & { invoiceType?: 'A' | 'B' | 'EXENTO'; paymentMethod?: string },
    sessionContext?: UserSessionContext | null
  ): Promise<CreateOrderResponse> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);

      if (role !== 'seller' && role !== 'admin') {
        return { success: false, message: 'Tu rol no tiene permisos para emitir nuevas órdenes de compra' };
      }

      const clientId = payload.clientId ? Number(payload.clientId) : null;
      const shippingAddressId = payload.shippingAddressId ? Number(payload.shippingAddressId) : null;
      
      const currentUserId = this.getSessionUserId(activeSession);
      const sellerId = role === 'seller' ? currentUserId : Number(payload.sellerId);
      const { items, total, invoiceType, paymentMethod } = payload;

      if (!sellerId) return { success: false, message: 'Identificador de vendedor no válido.' };

      const initialStateId = Number(payload.initialStateId ?? OrderState.Created);
      const creatableStates: number[] = [OrderState.Created, OrderState.Pending, OrderState.Paid];
      const isAllowedInitialState =
        creatableStates.includes(initialStateId) &&
        (initialStateId === OrderState.Created || canChangeState(OrderState.Created, initialStateId, role));

      if (!isAllowedInitialState) {
        return { success: false, message: `Tu rol no puede crear órdenes en estado "${getStateLabel(initialStateId)}".` };
      }

      const newOrder = await prisma.$transaction(async (tx) => {
        if (items && items.length > 0 && initialStateId !== OrderState.Paid) {
          for (const item of items) {
            await this.updateReservedStock(tx, BigInt(item.productId), Number(item.quantity));
          }
        }

        let addressSnapshot = {
          shippingStreet: '', shippingNumber: 0, shippingFloor: null as string | null,
          shippingApartment: null as string | null, shippingPostalCode: '', shippingCityName: '',
        };

        if (shippingAddressId) {
          const snapshot = await this.fetchAddressSnapshot(tx, shippingAddressId);
          if (snapshot) addressSnapshot = snapshot;
        }

        const normalizedInvoiceType = initialStateId === OrderState.Paid ? invoiceType?.toUpperCase() : null;

        const order = await tx.order.create({
          data: {
            sellerId: BigInt(sellerId),
            total: Number(total || 0),
            currentStateId: BigInt(initialStateId),
            invoiceType: normalizedInvoiceType,
            paymentMethod: paymentMethod || 'Efectivo',
            ...(clientId && { clientId: BigInt(clientId) }),
            ...(shippingAddressId && { shippingAddressId: BigInt(shippingAddressId) }),
            ...addressSnapshot,
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

        // Si se crea directamente como Pagada, descontamos stock y aplicamos la facturación (SP)
        if (initialStateId === OrderState.Paid && items && items.length > 0) {
          await this.finalizeStockDeduction(tx, items.map(i => ({ productId: BigInt(i.productId), amount: Number(i.quantity) })));
          
          // ⚡ Ejecutamos el SP para calcular y guardar el Neto en la BD
          await tx.$queryRaw`
            SELECT * FROM procesar_pago_orden(
              ${order.id}::bigint, 
              ${normalizedInvoiceType}::varchar, 
              ${BigInt(OrderState.Paid)}::bigint
            )
          `;
        }

        if (shippingAddressId) {
          let historyNotes = initialStateId === OrderState.Created
            ? 'Creación de borrador de orden y reserva inicial de stock'
            : `Creación de la orden en estado "${getStateLabel(initialStateId)}"`;

          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              stateId: BigInt(initialStateId),
              addressId: BigInt(shippingAddressId),
              notes: historyNotes,
            },
          });
        }

        return order;
      });

      return {
        success: true,
        orderId: Number(newOrder.id),
        message: 'Borrador de orden creado exitosamente y stock sincronizado.',
      };
    } catch (err: any) {
      console.error('Error en servicio de órdenes (createOrder):', err);
      return { success: false, message: err.message || 'Error en la operación de la base de datos' };
    }
  }

  // ─── Actualizar / Sincronizar Borrador 

  async updateOrder(
    payload: UpdateOrderPayload & { paymentMethod?: string },
    sessionContext?: UserSessionContext | null
  ): Promise<OrderMutationResponse> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);
      const { id, clientId, shippingAddressId, items, total, paymentMethod } = payload;
      const orderId = BigInt(id);

      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { itemOrders: true }
      });

      if (!existingOrder) return { success: false, message: 'La orden no existe' };

      this.assertSellerOwnsOrder(role, existingOrder.sellerId, this.getSessionUserId(activeSession));

      if (!canEditOrderDetails(Number(existingOrder.currentStateId), role)) {
        return { success: false, message: 'La orden ya fue confirmada: solo se puede editar mientras es un borrador.' };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const hasNewItems = items !== undefined && items !== null;
        const validItems = hasNewItems ? items.filter((i) => Number(i.quantity) > 0 && Number(i.productId) > 0) : [];

        if (Number(existingOrder.currentStateId) === OrderState.Created || Number(existingOrder.currentStateId) === OrderState.Pending) {
          for (const oldItem of existingOrder.itemOrders) {
            await this.updateReservedStock(tx, oldItem.productId, -Number(oldItem.amount));
          }
        }

        if (validItems.length > 0 && (Number(existingOrder.currentStateId) === OrderState.Created || Number(existingOrder.currentStateId) === OrderState.Pending)) {
          for (const newItem of validItems) {
            await this.updateReservedStock(tx, BigInt(newItem.productId), Number(newItem.quantity));
          }
        }

        await tx.itemOrder.deleteMany({ where: { orderId } });

        let addressSnapshotUpdates = {};
        if (shippingAddressId) {
          const snapshot = await this.fetchAddressSnapshot(tx, BigInt(shippingAddressId));
          if (snapshot) addressSnapshotUpdates = snapshot;
        }

        return tx.order.update({
          where: { id: orderId },
          data: {
            clientId: clientId ? BigInt(clientId) : existingOrder.clientId,
            shippingAddressId: shippingAddressId ? BigInt(shippingAddressId) : existingOrder.shippingAddressId,
            total: total !== undefined ? Number(total) : Number(existingOrder.total),
            paymentMethod: paymentMethod || existingOrder.paymentMethod,
            ...addressSnapshotUpdates,
            ...(validItems.length > 0 && {
              itemOrders: {
                create: validItems.map((item) => ({
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
        message: 'Orden actualizada y stock reservado sincronizado correctamente.',
      };
    } catch (err: any) {
      console.error('Error en servicio de órdenes (updateOrder):', err);
      return { success: false, message: err.message || 'Error en la operación de la base de datos' };
    }
  }

  // ─── Cambiar Estado (Usa Procedimientos Almacenados) 

  async updateOrderState(
    payload: UpdateOrderStatePayload & { location?: string; invoiceType?: 'A' | 'B' | 'EXENTO'; paymentMethod?: string },
    sessionContext?: UserSessionContext | null
  ): Promise<OrderMutationResponse> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);
      const { id, currentStateId, trackingNumber, notes, location, invoiceType, paymentMethod } = payload;
      const orderId = BigInt(id);
      const targetStateId = Number(currentStateId);

      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { itemOrders: true },
      });

      if (!existingOrder) throw new Error('La orden especificada no existe.');

      this.assertSellerOwnsOrder(role, existingOrder.sellerId, this.getSessionUserId(activeSession));

      const currentState = Number(existingOrder.currentStateId);
      if (!canChangeState(currentState, targetStateId, role)) {
        throw new Error(`Tu rol no puede pasar la orden de "${getStateLabel(currentState)}" a "${getStateLabel(targetStateId)}".`);
      }

      if (requiresTracking(targetStateId) && !trackingNumber?.trim() && !existingOrder.trackingNumber) {
        throw new Error('El número de seguimiento (tracking) es obligatorio para poner la orden en camino.');
      }

      if (requiresReason(targetStateId) && !notes?.trim()) {
        throw new Error('Indicá el motivo del rechazo o la cancelación.');
      }

      const isLeavingDraft = currentState === OrderState.Created && targetStateId !== OrderState.Created;

      if (targetStateId === OrderState.Paid) {
        const selectedInvoiceType = invoiceType?.toUpperCase();
        if (selectedInvoiceType !== 'A' && selectedInvoiceType !== 'B' && selectedInvoiceType !== 'EXENTO') {
          throw new Error('Debe especificar si la factura es de tipo A, B o Exento para marcar la orden como pagada.');
        }

        if (!paymentMethod?.trim()) throw new Error('Debe indicar un método de pago para marcar la orden como pagada.');

        const updatedOrder = await prisma.$transaction(async (tx) => {
          if (currentState === OrderState.Created || currentState === OrderState.Pending) {
             await this.releaseReservedStock(tx, orderId);
          }

          await this.finalizeStockDeduction(tx, existingOrder.itemOrders.map(i => ({ productId: i.productId, amount: i.amount })));

          const spResult = await tx.$queryRaw<Array<{
            order_id: bigint; total_amount: number; invoice_type: string; net_amount: number; vat_amount: number;
          }>>`
            SELECT * FROM procesar_pago_orden(
              ${orderId}::bigint, 
              ${selectedInvoiceType}::varchar, 
              ${BigInt(OrderState.Paid)}::bigint
            )
          `;

          if (!spResult || spResult.length === 0) throw new Error('Error al ejecutar el procedimiento almacenado de facturación.');

          const fiscalData = spResult[0];

          let addressSnapshotUpdates = {};
          if (isLeavingDraft && existingOrder.shippingAddressId) {
            const snapshot = await this.fetchAddressSnapshot(tx, existingOrder.shippingAddressId);
            if (snapshot) addressSnapshotUpdates = snapshot;
          }

          const updated = await tx.order.update({
            where: { id: orderId },
            data: {
              currentStateId: BigInt(targetStateId),
              invoiceType: selectedInvoiceType,
              paymentMethod: paymentMethod.trim(),
              ...addressSnapshotUpdates,
            },
          });

          const addressIdToUse = existingOrder.shippingAddressId ?? (await tx.address.findFirst({ where: { clientId: existingOrder.clientId! } }))?.id;

          if (addressIdToUse) {
            await tx.orderStatusHistory.create({
              data: {
                orderId: orderId,
                stateId: BigInt(targetStateId),
                addressId: addressIdToUse,
                notes: `Orden pagada con Factura ${selectedInvoiceType}. Método: ${paymentMethod.trim()}. Neto: $${fiscalData.net_amount}, IVA 21%: $${fiscalData.vat_amount}.`,
              },
            });
          }

          return updated;
        });

        return {
          success: true,
          orderId: Number(updatedOrder.id),
          message: `Orden marcada como pagada con Factura ${selectedInvoiceType} exitosamente.`,
        };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        if (releasesStock(targetStateId) && (currentState === OrderState.Created || currentState === OrderState.Pending)) {
           await this.releaseReservedStock(tx, orderId);
        }

        if (releasesStock(targetStateId) && currentState === OrderState.Created) {
          await tx.$executeRaw`SELECT sp_anular_orden_borrador(${orderId}::bigint)`;
        } else {
          const noteParts = [location?.trim() && `Ubicación: ${location.trim()}.`, notes?.trim()].filter(Boolean);
          const finalNotes = noteParts.length > 0 ? noteParts.join(' ') : `Estado actualizado a "${getStateLabel(targetStateId)}"`;

          await tx.$executeRaw`
            SELECT sp_cambiar_estado_orden(
              ${orderId}::bigint, 
              ${BigInt(targetStateId)}::bigint, 
              ${finalNotes}::text
            )
          `;
        }

        let addressSnapshotUpdates = {};
        if (isLeavingDraft && existingOrder.shippingAddressId) {
          const snapshot = await this.fetchAddressSnapshot(tx, existingOrder.shippingAddressId);
          if (snapshot) addressSnapshotUpdates = snapshot;
        }

        return tx.order.update({
          where: { id: orderId },
          data: {
            ...(trackingNumber?.trim() && { trackingNumber: trackingNumber.trim() }),
            ...addressSnapshotUpdates,
          },
        });
      });

      return {
        success: true,
        orderId: Number(updatedOrder.id),
        message: releasesStock(targetStateId)
          ? 'Orden cerrada y stock liberado correctamente.'
          : 'Estado de la orden actualizado correctamente.',
      };
    } catch (err: any) {
      console.error('Error en servicio de órdenes (updateOrderState):', err);
      return { success: false, message: err.message || 'Error en la operación de la base de datos' };
    }
  }

  async updateItemQuantity(
    orderId: number | bigint,
    productId: number | bigint,
    newQuantity: number
  ): Promise<OrderMutationResponse> {
    try {
      const result = await prisma.$queryRaw<Array<{ sp_actualizar_cantidad_item_orden: number }>>`
        SELECT sp_actualizar_cantidad_item_orden(
          ${BigInt(orderId)}::bigint, 
          ${BigInt(productId)}::bigint, 
          ${newQuantity}::integer
        )
      `;

      const nuevoTotal = result[0]?.sp_actualizar_cantidad_item_orden ?? 0;

      return {
        success: true,
        orderId: Number(orderId),
        message: `Cantidad actualizada correctamente. Nuevo total de la orden: $${nuevoTotal}`,
      };
    } catch (err: any) {
      console.error('Error al actualizar ítem con SP:', err);
      return { success: false, message: err.message || 'Error al actualizar la cantidad del ítem en la base de datos' };
    }
  }
}

export const ordersService = new OrdersService();