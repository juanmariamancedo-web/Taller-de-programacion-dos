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

/** Estados que cierran la orden y devuelven el stock al inventario. */
const releasesStock = (stateId: number) =>
  stateId === OrderState.Rejected || stateId === OrderState.Cancelled;

/** Tiempo que vive una reserva de edición si la app se cae o se cierra sin liberarla. */
const RESERVATION_TTL_MS = 10 * 60 * 1000;
const newExpiry = () => new Date(Date.now() + RESERVATION_TTL_MS);

/**
 * Nombres REALES en la base de datos, según schema.prisma:
 *  - tabla "products" (@@map)
 *  - "stock" y "reservedStock" NO tienen @map, así que la columna conserva el camelCase.
 * Se usan en los UPDATE condicionales con SQL crudo, que es lo que evita la carrera
 * entre usuarios. Si algún día agregás @map a esas columnas, actualizá esto.
 */
const P = {
  table: Prisma.raw('"products"'),
  id: Prisma.raw('"id"'),
  stock: Prisma.raw('"stock"'),
  reserved: Prisma.raw('"reservedStock"'),
};

class StockError extends Error {
  constructor(message: string, public productId?: number) {
    super(message);
    this.name = 'StockError';
  }
}

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

  // ─── Stock: helpers ─────────────────────────────────────────────────────
  //
  // Modelo:
  //  - stock           = unidades físicas que NO están comprometidas en una orden.
  //                      Se descuenta apenas la orden se crea y se devuelve al cancelar/rechazar.
  //  - reservedStock   = unidades que una sesión de EDICIÓN tiene apartadas temporalmente
  //                      (solo lo extra respecto a lo que la orden ya tenía descontado).
  //  - Disponible      = stock - reservedStock.
  //  Toda validación de disponibilidad es un UPDATE condicional: la fila se bloquea y el
  //  chequeo + la escritura son una sola operación atómica.

  /** Suma cantidades por producto (soporta productos repetidos). */
  private toQtyMap(
    rows: { productId: number | bigint | string; qty: number | bigint | string }[]
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = String(BigInt(row.productId));
      map.set(key, (map.get(key) ?? 0) + Number(row.qty));
    }
    return map;
  }

  /** IDs ordenados: siempre se bloquean las filas en el mismo orden para evitar deadlocks. */
  private sortedIds(...maps: Map<string, number>[]): bigint[] {
    const ids = new Set<string>();
    maps.forEach((m) => m.forEach((_, key) => ids.add(key)));
    return [...ids].map((id) => BigInt(id)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  private async throwStockError(tx: Tx, productId: bigint, requested: number): Promise<never> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { name: true, stock: true, reservedStock: true },
    });

    if (!product) {
      throw new StockError(`El producto con ID ${productId} no existe.`, Number(productId));
    }

    const reserved = product.reservedStock ?? 0;
    throw new StockError(
      `Stock insuficiente para el producto "${product.name}". Disponible: ${product.stock - reserved} (stock: ${product.stock}, reservado por otras ediciones: ${reserved}), solicitado: ${requested}.`,
      Number(productId)
    );
  }

  /** Descuenta stock físico solo si hay disponible (stock - reservedStock >= qty). */
  private async deductStock(tx: Tx, productId: bigint, qty: number) {
    if (qty <= 0) return;
    const affected = await tx.$executeRaw`
      UPDATE ${P.table}
      SET ${P.stock} = ${P.stock} - ${qty}
      WHERE ${P.id} = ${productId} AND ${P.stock} - ${P.reserved} >= ${qty}
    `;
    if (affected === 0) await this.throwStockError(tx, productId, qty);
  }

  /** Aparta unidades (reservedStock += qty) solo si hay disponible. */
  private async reserveUnits(tx: Tx, productId: bigint, qty: number) {
    if (qty <= 0) return;
    const affected = await tx.$executeRaw`
      UPDATE ${P.table}
      SET ${P.reserved} = ${P.reserved} + ${qty}
      WHERE ${P.id} = ${productId} AND ${P.stock} - ${P.reserved} >= ${qty}
    `;
    if (affected === 0) await this.throwStockError(tx, productId, qty);
  }

  /** Devuelve stock físico (cancelación / rechazo / reducción de cantidades). */
  private async restoreStock(tx: Tx, productId: bigint, qty: number) {
    if (qty <= 0) return;
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: qty } },
    });
  }

  /**
   * Libera TODAS las reservas de edición de una orden. Idempotente: si no hay, no hace nada.
   * Cada fila se borra con deleteMany y solo se descuenta si realmente se borró,
   * así nunca se libera dos veces la misma reserva.
   */
  private async releaseReservationsTx(tx: Tx, orderId: bigint) {
    const rows = await tx.stockReservation.findMany({
      where: { orderId },
      orderBy: { productId: 'asc' },
    });

    for (const row of rows) {
      const deleted = await tx.stockReservation.deleteMany({ where: { id: row.id } });
      if (deleted.count === 1 && row.quantity > 0) {
        await tx.product.update({
          where: { id: row.productId },
          data: { reservedStock: { decrement: row.quantity } },
        });
      }
    }
  }

  /**
   * Libera reservas vencidas (app cerrada / caída). Llamalo al iniciar la app,
   * con un setInterval en el proceso main (ej. cada 1-2 min) y antes de reservar o crear.
   */
  async releaseExpiredReservations() {
    try {
      await prisma.$transaction(async (tx) => {
        const expired = await tx.stockReservation.findMany({
          where: { expiresAt: { lt: new Date() } },
          orderBy: [{ productId: 'asc' }, { id: 'asc' }],
        });

        for (const row of expired) {
          const deleted = await tx.stockReservation.deleteMany({ where: { id: row.id } });
          if (deleted.count === 1 && row.quantity > 0) {
            await tx.product.update({
              where: { id: row.productId },
              data: { reservedStock: { decrement: row.quantity } },
            });
          }
        }
      });
    } catch (err) {
      console.error('Error liberando reservas vencidas:', err);
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

  // ─── Reservas de edición (API para el frontend) ─────────────────────────

  /**
   * Fija la reserva de una orden EXISTENTE en edición al estado objetivo.
   * `items` = cantidades que el usuario tiene hoy en el formulario.
   * Solo se reserva lo EXTRA respecto a lo que la orden ya tiene descontado.
   * Es idempotente: se puede llamar muchas veces con el mismo payload.
   */
  async reserveOrderStock(
    payload: { orderId: string | number; items: { productId: number | string; quantity: number | string }[] },
    sessionContext?: UserSessionContext | null
  ): Promise<OrderMutationResponse & { failedProductId?: number }> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);
      const orderId = BigInt(payload.orderId);

      await this.releaseExpiredReservations();

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, sellerId: true, currentStateId: true },
      });
      if (!order) return { success: false, message: 'La orden no existe' };

      this.assertSellerOwnsOrder(role, order.sellerId, this.getSessionUserId(activeSession));

      if (!canEditOrderDetails(Number(order.currentStateId), role)) {
        return { success: false, message: 'La orden ya no se puede editar.' };
      }

      const requested = this.toQtyMap(
        (payload.items ?? [])
          .filter((i) => Number(i.productId) > 0)
          .map((i) => ({ productId: i.productId, qty: i.quantity }))
      );

      await prisma.$transaction(async (tx) => {
        const fresh = await tx.order.findUnique({
          where: { id: orderId },
          select: { currentStateId: true, itemOrders: true },
        });
        if (!fresh || !canEditOrderDetails(Number(fresh.currentStateId), role)) {
          throw new Error('La orden ya no se puede editar.');
        }

        const original = this.toQtyMap(fresh.itemOrders.map((i) => ({ productId: i.productId, qty: i.amount })));
        const reservations = await tx.stockReservation.findMany({ where: { orderId } });
        const current = this.toQtyMap(reservations.map((r) => ({ productId: r.productId, qty: r.quantity })));

        for (const productId of this.sortedIds(requested, current)) {
          const key = String(productId);
          const target = Math.max(0, (requested.get(key) ?? 0) - (original.get(key) ?? 0));
          const delta = target - (current.get(key) ?? 0);

          if (delta > 0) {
            await this.reserveUnits(tx, productId, delta);
          } else if (delta < 0) {
            await tx.product.update({
              where: { id: productId },
              data: { reservedStock: { decrement: -delta } },
            });
          }

          if (target > 0) {
            await tx.stockReservation.upsert({
              where: { orderId_productId: { orderId, productId } },
              create: { orderId, productId, quantity: target, expiresAt: newExpiry() },
              update: { quantity: target, expiresAt: newExpiry() },
            });
          } else {
            await tx.stockReservation.deleteMany({ where: { orderId, productId } });
          }
        }
      });

      return { success: true, orderId: Number(orderId), message: 'Stock reservado.' };
    } catch (err: any) {
      console.error('Error reservando stock:', err);
      return {
        success: false,
        message: err?.message || 'No se pudo reservar el stock.',
        failedProductId: err instanceof StockError ? err.productId : undefined,
      };
    }
  }

  /** Libera la reserva de edición de una orden. Idempotente. */
  async releaseOrderReservation(
    orderIdRaw: string | number,
    sessionContext?: UserSessionContext | null
  ): Promise<OrderMutationResponse> {
    try {
      const activeSession = await this.resolveSession(sessionContext);
      const role = this.getSessionRole(activeSession);
      const orderId = BigInt(orderIdRaw);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { sellerId: true },
      });

      if (order) {
        this.assertSellerOwnsOrder(role, order.sellerId, this.getSessionUserId(activeSession));
      }

      await prisma.$transaction((tx) => this.releaseReservationsTx(tx, orderId));

      return { success: true, orderId: Number(orderId), message: 'Reserva liberada.' };
    } catch (err: any) {
      console.error('Error liberando reserva:', err);
      return { success: false, message: err?.message || 'No se pudo liberar la reserva.' };
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

      // Libera reservas vencidas para que no bloqueen stock disponible
      await this.releaseExpiredReservations();

      const newOrder = await prisma.$transaction(async (tx) => {
        // 1. Descontar stock físico de forma atómica (falla si no hay disponible = stock - reservedStock).
        //    Se procesa por productId ordenado para evitar deadlocks entre usuarios.
        const requested = this.toQtyMap(items.map((i) => ({ productId: i.productId, qty: i.quantity })));
        for (const productId of this.sortedIds(requested)) {
          await this.deductStock(tx, productId, requested.get(String(productId)) ?? 0);
        }

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
        failedProductId: err instanceof StockError ? err.productId : undefined,
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

      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { itemOrders: true },
      });
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

      await this.releaseExpiredReservations();

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // Releemos dentro de la transacción: el estado o los ítems pudieron cambiar
        const fresh = await tx.order.findUnique({
          where: { id: orderId },
          include: { itemOrders: true },
        });
        if (!fresh || !canEditOrderDetails(Number(fresh.currentStateId), role)) {
          throw new Error('La orden ya fue confirmada: solo se puede editar mientras es un borrador.');
        }

        // 1. Liberar la reserva de edición: lo que se guarda pasa a ser stock definitivo
        await this.releaseReservationsTx(tx, orderId);

        const hasNewItems = Boolean(items && items.length > 0);

        if (hasNewItems) {
          // 2. Ajustar el stock físico solo por la DIFERENCIA (nueva - original)
          const original = this.toQtyMap(fresh.itemOrders.map((i) => ({ productId: i.productId, qty: i.amount })));
          const next = this.toQtyMap(items!.map((i) => ({ productId: i.productId, qty: i.quantity })));

          for (const productId of this.sortedIds(original, next)) {
            const key = String(productId);
            const diff = (next.get(key) ?? 0) - (original.get(key) ?? 0);

            if (diff > 0) await this.deductStock(tx, productId, diff);
            else if (diff < 0) await this.restoreStock(tx, productId, -diff);
          }

          await tx.itemOrder.deleteMany({ where: { orderId } });
        }

        let addressSnapshotUpdates = {};
        if (shippingAddressId) {
          const snapshot = await this.fetchAddressSnapshot(tx, BigInt(shippingAddressId));
          if (snapshot) addressSnapshotUpdates = snapshot;
        }

        return tx.order.update({
          where: { id: orderId },
          data: {
            clientId: clientId ? BigInt(clientId) : fresh.clientId,
            shippingAddressId: shippingAddressId ? BigInt(shippingAddressId) : fresh.shippingAddressId,
            total: total !== undefined ? Number(total) : Number(fresh.total),
            paymentMethod: paymentMethod || fresh.paymentMethod,
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
        failedProductId: err instanceof StockError ? err.productId : undefined,
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
          // El stock físico ya se descontó al crear la orden: acá solo se descarta
          // cualquier reserva de edición que haya quedado abierta.
          await this.releaseReservationsTx(tx, orderId);

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
        // Guardia de concurrencia: solo una transición gana. Evita devolver el stock dos veces
        // si dos usuarios cancelan/rechazan la misma orden a la vez.
        const moved = await tx.order.updateMany({
          where: { id: orderId, currentStateId: existingOrder.currentStateId },
          data: { currentStateId: BigInt(targetStateId) },
        });
        if (moved.count === 0) {
          throw new Error('La orden cambió de estado mientras se procesaba. Recargá e intentá de nuevo.');
        }

        // Cualquier reserva de edición abierta deja de tener sentido al cambiar de estado
        await this.releaseReservationsTx(tx, orderId);

        // Si se cancela o rechaza, devolvemos el stock físico que se había descontado
        if (releasesStock(targetStateId)) {
          const qtyByProduct = this.toQtyMap(
            existingOrder.itemOrders.map((i) => ({ productId: i.productId, qty: i.amount }))
          );
          for (const productId of this.sortedIds(qtyByProduct)) {
            await this.restoreStock(tx, productId, qtyByProduct.get(String(productId)) ?? 0);
          }
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
            releasesStock(targetStateId) && '(Stock devuelto al inventario)',
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