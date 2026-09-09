import { prisma } from '../infrastructure/db/prisma';
import { SearchParams } from '../domain/types/electron-env';
import { Prisma } from '../infrastructure/db/generated/client/client';

export class UsersService {
  async getUsers(searchParams?: SearchParams) {
    const page = searchParams?.page ?? 1;
    const limit = 5;
    
    const sortMap: Record<string, Prisma.UserOrderByWithRelationInput> = {
          userIDAsc: { id: 'asc' },         
          userIDDesc: { id: 'desc' },
          usernameAsc: { username: "asc" },    
          usernameDesc: { username: 'desc' },
          activeAsc: { isActive: 'asc' },
          activeDesc: { isActive: 'desc' },
          roleAsc: { roleId: 'asc' }, 
          roleDesc: { roleId: 'desc' },
        };

    const orderBy = (searchParams?.sort && sortMap[searchParams.sort])
      ? sortMap[searchParams.sort]
      : { createdAt: 'desc' as const };

    const search = searchParams?.search?.trim();

    const where: Prisma.UserWhereInput = search
      ? {
          username: {
            contains: search,
            mode: 'insensitive',
          },
        }
    : {};

    const [totalUsers, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        skip: (page - 1) * limit,
        take: 5,
        where,
        orderBy,
        include: {
          role: {
              select: {
                  name: true
              }
          }
        }
      })
    ]) 

    // Cálculo del número de páginas
    const totalPages = Math.ceil(totalUsers / limit);


    // Mapeamos los acampos que no sean serializables directamente por IPC
    return {
      data: users.map(user => ({
        ...user
      })),
      success: true, 
      totalPages
    }
  }
}

export const usersService = new UsersService();