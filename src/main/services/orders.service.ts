import { prisma } from '../infrastructure/db/prisma';
import { SearchParams } from '../domain/types/electron-env';

export class OrdersService {
  async getOrders(searchParams?: SearchParams) {
    const page = searchParams?.page ?? 1;

    const orders = await prisma.order.findMany({
      skip: (page - 1) * 5,
      take: 5,
      orderBy: { createdAt: "desc" }
    });

    // Mapeamos los campos que no sean serializables directamente por IPC
    return orders.map(order => ({
      ...order
    }));
  }
}

export const ordersService = new OrdersService();