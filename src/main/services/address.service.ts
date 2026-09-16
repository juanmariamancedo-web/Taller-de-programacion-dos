import { prisma } from '../infrastructure/db/prisma';
import { SearchParams } from '../domain/types/electron-env';
import { Prisma } from '../infrastructure/db/generated/client/client';

export class AddressService {
  async getAddresses(clientId?: number | bigint, searchParams?: SearchParams) {
    const page = searchParams?.page ?? 1;
    const limit = 5;

    const sortMap: Record<string, Prisma.AddressOrderByWithRelationInput> = {
      streetAsc: { street: 'asc' },
      streetDesc: { street: 'desc' },
      cityAsc: { city: { name: 'asc' } },
      cityDesc: { city: { name: 'desc' } },
    };

    const orderBy = (searchParams?.sort && sortMap[searchParams.sort])
      ? sortMap[searchParams.sort]
      : { createdAt: 'desc' as const };

    const search = searchParams?.search?.trim();

    // Filtro por clientId y búsqueda opcional por calle o ciudad
    const where: Prisma.AddressWhereInput = {
      ...(clientId ? { clientId: BigInt(clientId) } : {}),
      ...(search
        ? {
            OR: [
              { street: { contains: search, mode: 'insensitive' } },
              { city: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [totalAddresses, addresses] = await prisma.$transaction([
      prisma.address.count({ where }),
      prisma.address.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          city: true,
          client: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalAddresses / limit);

    return {
      success: true,
      data: addresses,
      totalPages,
    };
  }
}

export const addressService = new AddressService();