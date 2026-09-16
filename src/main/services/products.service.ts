import { prisma } from '../infrastructure/db/prisma';
import { SearchParams } from '../domain/types/electron-env';
import { Prisma } from '../infrastructure/db/generated/client/client';

export class ProductsService {
  async getProducts(searchParams?: SearchParams) {
    try {
      const page = Math.max(1, searchParams?.page ?? 1);
      const limit = 5;
      const search = searchParams?.search?.trim() ?? '';

      // Filtro para traer productos activos y filtrar opcionalmente por nombre
      const where: Prisma.ProductWhereInput = {
        isActive: true,
        ...(search && {
          name: { contains: search, mode: 'insensitive' },
        }),
      };

      const [products, totalCount] = await prisma.$transaction([
        prisma.product.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            category: true, // Incluye la relación con la categoría si es necesaria en el frontend
          },
          orderBy: { name: 'asc' },
        }),
        prisma.product.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit) || 1;

      return {
        success: true,
        data: products,
        totalPages,
        totalCount,
        currentPage: page,
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      return {
        success: false,
        error: 'No se pudieron obtener los productos',
        data: [],
        totalPages: 0,
        totalCount: 0,
        currentPage: 1,
      };
    }
  }
}

export const productsService = new ProductsService();