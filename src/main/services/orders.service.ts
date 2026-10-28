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

  /** Obtiene los datos de la dirección para generar el snapshot histórico. */
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
        clientId: Number(order.clientId),
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

        shippingAddress: {
          id: order.shippingAddressId ? Number(order.shippingAddressId) : null,
          street,
          number,
          floor,
          apartment,
          postalCode,
          city: { name: cityName },
        },

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

  // ─── Crear ──────────────────────────────────────────────────────────────

  async createOrder(
    payload: CreateOrderPayload & {
      invoiceType?: 'A' | 'B' | 'EXENTO';
      paymentMethod?: string;
    },
    sessionContext?: UserSessionContext | null
  ): Promise<CreateOrderResponse> {
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
      const { items, total, invoiceType, paymentMethod } = payload;

      if (!clientId || !sellerId || !items || items.length === 0) {
        return {
          success: false,
          message: 'Datos de la orden incompletos (cliente, seller e ítems son obligatorios)',
        };
      }

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

      if (initialStateId === OrderState.Paid) {
        const selectedInvoiceType = invoiceType?.toUpperCase();
        if (selectedInvoiceType !== 'A' && selectedInvoiceType !== 'B' && selectedInvoiceType !== 'EXENTO') {
          return {
            success: false,
            message: 'Debe especificar si la factura es de tipo A, B o Exento para crear una orden pagada.',
          };
        }
      }

      const newOrder = await prisma.$transaction(async (tx) => {
        await this.reserveStock(tx, items);

        let addressSnapshot = {
          shippingStreet: '',
          shippingNumber: 0,
          shippingFloor: null as string | null,
          shippingApartment: null as string | null,
          shippingPostalCode: '',
          shippingCityName: '',
        };

        if (shippingAddressId) {
          const snapshot = await this.fetchAddressSnapshot(tx, shippingAddressId);
          if (snapshot) addressSnapshot = snapshot;
        }

        const normalizedInvoiceType = initialStateId === OrderState.Paid ? invoiceType?.toUpperCase() : null;

        const order = await tx.order.create({
          data: {
            clientId: BigInt(clientId),
            sellerId: BigInt(sellerId),
            total: Number(total),
            currentStateId: BigInt(initialStateId),
            invoiceType: normalizedInvoiceType,
            paymentMethod: paymentMethod || 'Efectivo',
            ...(shippingAddressId && { shippingAddressId: BigInt(shippingAddressId) }),
            ...addressSnapshot,
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
          let historyNotes = initialStateId === OrderState.Created
            ? 'Creación de la orden de compra y descuento de stock'
            : `Creación de la orden en estado "${getStateLabel(initialStateId)}" y descuento de stock`;

          if (initialStateId === OrderState.Paid) {
            const selectedInv = normalizedInvoiceType || 'B';
            const numericTotal = Number(total);
            const requiresVatCalculation = selectedInv === 'A' || selectedInv === 'EXENTO';
            const netAmount = requiresVatCalculation ? Number((numericTotal / 1.21).toFixed(2)) : numericTotal;
            const vatAmount = requiresVatCalculation ? Number((numericTotal - netAmount).toFixed(2)) : 0.00;

            historyNotes = `Orden creada y pagada con Factura ${selectedInv}. Neto: $${netAmount}, IVA 21%: $${vatAmount}.`;
          }

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
        message: 'Orden creada exitosamente y stock actualizado.',
      };
    } catch (err: any) {
      console.error('Error en servicio de órdenes:', err);
      let errorMessage = err.message || 'Error en la operación de la base de datos';

      const errorMsg = String(err?.message || '');
      const errorCode = err?.code;
      const driverError = String(err?.meta?.driverAdapterError?.cause?.message || err?.meta?.driverAdapterError || '');

      if (
        errorCode === 'P2002' ||
        errorMsg.includes('P2002') ||
        errorMsg.includes('tracking_number') ||
        errorMsg.includes('Unique constraint failed') ||
        driverError.includes('UniqueConstraintViolation') ||
        driverError.includes('tracking_number')
      ) {
        errorMessage = 'El número de seguimiento (tracking) ya se encuentra registrado en otra orden.';
      }

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  // ─── Editar datos (solo mientras es borrador) ───────────────────────────

  async updateOrder(
    payload: UpdateOrderPayload & { paymentMethod?: string },
    sessionContext?: UserSessionContext | null
  ): Promise<OrderMutationResponse> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);
      const { id, clientId, shippingAddressId, items, total, paymentMethod } = payload;
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

        if (hasNewItems) {
          const previousItems = await tx.itemOrder.findMany({ where: { orderId } });
          await this.releaseStock(tx, previousItems);
          await tx.itemOrder.deleteMany({ where: { orderId } });
          await this.reserveStock(tx, items!);
        }

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
      console.error('Error en servicio de órdenes:', err);
      let errorMessage = err.message || 'Error en la operación de la base de datos';

      const errorMsg = String(err?.message || '');
      const errorCode = err?.code;
      const driverError = String(err?.meta?.driverAdapterError?.cause?.message || err?.meta?.driverAdapterError || '');

      if (
        errorCode === 'P2002' ||
        errorMsg.includes('P2002') ||
        errorMsg.includes('tracking_number') ||
        errorMsg.includes('Unique constraint failed') ||
        driverError.includes('UniqueConstraintViolation') ||
        driverError.includes('tracking_number')
      ) {
        errorMessage = 'El número de seguimiento (tracking) ya se encuentra registrado en otra orden.';
      }

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  // ─── Cambiar estado ─────────────────────────────────────────────────────
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

      if (!existingOrder) {
        throw new Error('La orden especificada no existe.');
      }

      this.assertSellerOwnsOrder(role, existingOrder.sellerId, this.getSessionUserId(activeSession));

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

      const isLeavingDraft = currentState === OrderState.Created && targetStateId !== OrderState.Created;

      // ─── LÓGICA DE PAGO CON PROCEDIMIENTO ALMACENADO (Factura A / B / Exento) ───────────
      if (targetStateId === OrderState.Paid) {
        const selectedInvoiceType = invoiceType?.toUpperCase();
        if (selectedInvoiceType !== 'A' && selectedInvoiceType !== 'B' && selectedInvoiceType !== 'EXENTO') {
          throw new Error('Debe especificar si la factura es de tipo A, B o Exento para marcar la orden como pagada.');
        }

        if (!paymentMethod?.trim()) {
          throw new Error('Debe indicar un método de pago para marcar la orden como pagada.');
        }

        const updatedOrder = await prisma.$transaction(async (tx) => {
          const spResult = await tx.$queryRaw<Array<{
            order_id: bigint;
            total_amount: number;
            invoice_type: string;
            net_amount: number;
            vat_amount: number;
          }>>`
            SELECT * FROM procesar_pago_orden(
              ${orderId}::bigint, 
              ${selectedInvoiceType}::varchar, 
              ${BigInt(OrderState.Paid)}::bigint
            )
          `;

          if (!spResult || spResult.length === 0) {
            throw new Error('Error al ejecutar el procedimiento almacenado de facturación.');
          }

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

          const addressIdToUse = existingOrder.shippingAddressId ?? (await tx.address.findFirst({ where: { clientId: existingOrder.clientId } }))?.id;

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

      // ─── FLUJO ESTÁNDAR PARA OTROS ESTADOS ──────────────────────────────────
      const updatedOrder = await prisma.$transaction(async (tx) => {
        if (releasesStock(targetStateId)) {
          await this.releaseStock(tx, existingOrder.itemOrders);
        }

        let addressSnapshotUpdates = {};
        if (isLeavingDraft && existingOrder.shippingAddressId) {
          const snapshot = await this.fetchAddressSnapshot(tx, existingOrder.shippingAddressId);
          if (snapshot) addressSnapshotUpdates = snapshot;
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            currentStateId: BigInt(targetStateId),
            ...(trackingNumber?.trim() && { trackingNumber: trackingNumber.trim() }),
            ...addressSnapshotUpdates,
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
      console.error('Error en servicio de órdenes:', err);
      let errorMessage = err.message || 'Error en la operación de la base de datos';

      const errorMsg = String(err?.message || '');
      const errorCode = err?.code;
      const driverError = String(err?.meta?.driverAdapterError?.cause?.message || err?.meta?.driverAdapterError || '');

      if (
        errorCode === 'P2002' ||
        errorMsg.includes('P2002') ||
        errorMsg.includes('tracking_number') ||
        errorMsg.includes('Unique constraint failed') ||
        driverError.includes('UniqueConstraintViolation') ||
        driverError.includes('tracking_number')
      ) {
        errorMessage = 'El número de seguimiento (tracking) ya se encuentra registrado en otra orden.';
      }

      return {
        success: false,
        message: errorMessage,
      };
    }
  }
}

export const ordersService = new OrdersService();