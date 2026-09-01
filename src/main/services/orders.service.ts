import { prisma } from '../infrastructure/db/prisma';
import { SearchParams } from '../domain/types/electron-env';

export class OrdersService {
  async getOrders(searchParams?: SearchParams) {
    const page = searchParams?.page ?? 1;

    const orders = await prisma.order.findMany({
      skip: (page - 1) * 5,
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        currentState: {
            select : {
                name: true
            }
        }
      }
    });

    // Mapeamos los acampos que no sean serializables directamente por IPC
    return orders.map(order => ({
      ...order
    }));
  }
}

export const ordersService = new OrdersService();