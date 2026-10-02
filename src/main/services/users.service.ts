import { prisma } from '../infrastructure/db/prisma';
import bcrypt from 'bcryptjs';
import { CreateUserInput, UpdateUserInput, SearchParams } from '../domain/types/electron-env';
import { Prisma } from '../infrastructure/db/generated/client/client';

export class UsersService {
  async createUser(input: CreateUserInput): Promise<{ id: string }> {
    // Eliminamos cualquier espacio que pueda tener el username
    const cleanUsername = input.username.replace(/\s+/g, '');

    if (!cleanUsername) {
      throw new Error('El nombre de usuario no puede estar vacío ni contener solo espacios.');
    }

    const password = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        roleId: BigInt(input.roleId),
        password,
        isActive: input.isActive,
      },
      select: { id: true },
    });

    return { id: user.id.toString() };
  }

  async getUsers(searchParams?: SearchParams) {
    const page = searchParams?.page ?? 1;
    const limit = 5;

    const sortMap: Record<string, Prisma.UserOrderByWithRelationInput> = {
      idAsc: { id: 'asc' },
      idDesc: { id: 'desc' },
      usernameAsc: { username: 'asc' },
      usernameDesc: { username: 'desc' },
      activeAsc: { isActive: 'asc' },
      activeDesc: { isActive: 'desc' },
      roleAsc: { roleId: 'asc' },
      roleDesc: { roleId: 'desc' },
    };

    const orderBy =
      searchParams?.sort && sortMap[searchParams.sort]
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
        take: limit,
        where,
        orderBy,
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalUsers / limit);

    return {
      data: users.map((user) => ({
        ...user,
        id: Number(user.id),
        roleId: Number(user.roleId),
        role: user.role ? { ...user.role, id: Number(user.role.id) } : null,
      })),
      success: true,
      totalPages,
    };
  }

  async updateUser(input: UpdateUserInput): Promise<{ success: boolean; message?: string }> {
    const userId = BigInt(input.id);
    
    // Eliminamos cualquier espacio que pueda tener el username
    const cleanUsername = input.username.replace(/\s+/g, '');

    if (!cleanUsername) {
      throw new Error('El nombre de usuario no puede estar vacío ni contener solo espacios.');
    }

    const updateData: Prisma.UserUpdateInput = {
      username: cleanUsername,
      role: { connect: { id: BigInt(input.roleId) } },
      isActive: input.isActive,
    };

    if (input.password && input.password.trim().length > 0) {
      updateData.password = await bcrypt.hash(input.password, 10);
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { success: true, message: 'Usuario actualizado exitosamente' };
  }


  async deleteUser(id: number | bigint): Promise<{ success: boolean; message?: string }> {
    await prisma.user.delete({
      where: { id: BigInt(id) },
    });

    return { success: true, message: 'Usuario eliminado correctamente' };
  }

  async getRoles() {
    const roles = await prisma.userRole.findMany({
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: roles.map((role) => ({
        ...role,
        id: Number(role.id),
      })),
    };
  }

  async updateProfile(input: {
    userId: number | string;
    username: string;
    prevPassword?: string;
    newPassword?: string;
  }) {
    const cleanUsername = input.username.replace(/\s+/g, '');

    if (!cleanUsername || cleanUsername.length < 4) {
      throw new Error('El nombre de usuario debe tener al menos 4 caracteres y sin espacios.');
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(input.userId) },
    });

    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    const updateData: any = {
      username: cleanUsername,
    };

    // Si intenta cambiar la contraseña, validar la contraseña previa
    if (input.newPassword) {
      if (!input.prevPassword) {
        throw new Error('Debes ingresar tu contraseña actual para cambiarla.');
      }

      const isMatch = await bcrypt.compare(input.prevPassword, user.password);
      if (!isMatch) {
        throw new Error('La contraseña actual es incorrecta.');
      }

      updateData.password = await bcrypt.hash(input.newPassword, 10);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return { success: true, message: 'Perfil actualizado exitosamente' };
  }
}

export const usersService = new UsersService();