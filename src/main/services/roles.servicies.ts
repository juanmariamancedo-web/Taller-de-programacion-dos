import { prisma } from '../infrastructure/db/prisma';

export class RolesService {
  async getOrders() {
    const roles = await prisma.userRole.findMany()

    return {
      success: true,
      data: roles
    };
  }
}

export const rolesService = new RolesService()