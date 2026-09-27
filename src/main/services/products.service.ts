import { prisma } from '../infrastructure/db/prisma';
import {
  ProductCategory,
  ProductInput,
  ProductsResponse,
  SearchParams,
  UpdateProductInput
} from '../domain/types/electron-env';
import { Prisma } from '../infrastructure/db/generated/client/client';

export class ProductsService {
  async getProductCategories(): Promise<ProductCategory[]> {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    return categories.map((category) => ({ id: category.id.toString(), name: category.name }))
  }

  async createProduct(input: ProductInput): Promise<{ id: string }> {
    const product = await prisma.product.create({
      data: this.toProductData(input),
      select: { id: true }
    })

    return { id: product.id.toString() }
  }

  async updateProduct(input: UpdateProductInput): Promise<{ id: string }> {
    const product = await prisma.product.update({
      where: { id: BigInt(input.id) },
      data: this.toProductData(input),
      select: { id: true }
    })

    return { id: product.id.toString() }
  }

  async setProductStatus(id: string, isActive: boolean): Promise<{ id: string }> {
    const product = await prisma.product.update({
      where: { id: BigInt(id) },
      data: { isActive },
      select: { id: true }
    })

    return { id: product.id.toString() }
  }

  async updateProductStock(id: string, stock: number): Promise<{ id: string }> {
    const product = await prisma.product.update({
      where: { id: BigInt(id) },
      data: { stock },
      select: { id: true }
    })

    return { id: product.id.toString() }
  }

  async getProducts(searchParams?: SearchParams): Promise<ProductsResponse> {
    try {
      const page = Math.max(1, searchParams?.page ?? 1);
      const limit = 5;
      const search = searchParams?.search?.trim() ?? '';

      const where: Prisma.ProductWhereInput = {
        ...(!searchParams?.includeInactive && { isActive: true }),
        ...(search && {
          name: { contains: search, mode: 'insensitive' },
        }),
      };
      const orderByOptions: Record<string, Prisma.ProductOrderByWithRelationInput> = {
        nameAsc: { name: 'asc' },
        nameDesc: { name: 'desc' },
        priceAsc: { price: 'asc' },
        priceDesc: { price: 'desc' },
        stockAsc: { stock: 'asc' },
        stockDesc: { stock: 'desc' },
        isActiveAsc: { isActive: 'asc' },
        isActiveDesc: { isActive: 'desc' }
      }
      const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
        orderByOptions[searchParams?.sort ?? ''] ?? { name: 'asc' },
        { id: 'asc' }
      ]

      const [products, totalCount] = await prisma.$transaction([
        prisma.product.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            category: true, // Incluye la relación con la categoría si es necesaria en el frontend
          },
          orderBy,
        }),
        prisma.product.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit) || 1;

      return {
        success: true,
        data: products.map((product) => ({
          id: product.id.toString(),
          name: product.name,
          price: Number(product.price),
          stock: product.stock,
          lowStock: product.lowStock,
          image: product.image,
          isActive: product.isActive,
          categoryId: product.categoryId.toString()
        })),
        totalPages,
        totalCount,
        currentPage: page,
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      return {
        success: false,
        message: 'No se pudieron obtener los productos',
        data: [],
        totalPages: 0,
        totalCount: 0,
        currentPage: 1,
      };
    }
  }

  private toProductData(input: ProductInput): Prisma.ProductUncheckedCreateInput {
    return {
      name: input.name,
      price: input.price,
      stock: input.stock,
      lowStock: input.lowStock,
      image: input.image,
      isActive: input.isActive,
      categoryId: BigInt(input.categoryId)
    }
  }
}

export const productsService = new ProductsService();