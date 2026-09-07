import { prisma } from '../infrastructure/db/prisma';
import { SearchParams } from '../domain/types/electron-env';

export class UsersService {
  async getUsers(searchParams?: SearchParams) {
    const page = searchParams?.page ?? 1;

    const users = await prisma.user.findMany({
      skip: (page - 1) * 5,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        role: {
            select: {
                name: true
            }
        }
      }
    });

    // Mapeamos los acampos que no sean serializables directamente por IPC
    return users.map(user => ({
      ...user
    }));
  }
}

export const usersService = new UsersService();