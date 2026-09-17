import { prisma } from '../infrastructure/db/prisma';
import { SearchParams } from '../domain/types/electron-env';
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

    const orderBy = (searchParams?.sort && sortMap[searchParams.sort])
      ? sortMap[searchParams.sort]
      : { createdAt: 'desc' as const };

    const search = searchParams?.search?.trim();

    // Normalización y casteo seguro por si IPC envía string
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
          currentState: { select: { name: true } },
          client: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalOrders / limit);

    return {
      success: true,
      data: orders,
      totalPages,
    };
  }
}

export const ordersService = new OrdersService();