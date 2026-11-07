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
    this.assertValidStock(input.stock)

    const product = await prisma.product.create({
      data: this.toProductData(input),
      select: { id: true }
    })

    return { id: product.id.toString() }
  }

  async updateProduct(input: UpdateProductInput): Promise<{ id: string }> {
    this.assertValidStock(input.stock)

    // Guardia atómica: solo actualiza si el nuevo stock no queda por debajo de lo reservado.
    // (reservedStock <= nuevo stock) se evalúa en el mismo UPDATE, sin carrera con las reservas.
    const productId = BigInt(input.id)
    const result = await prisma.product.updateMany({
      where: { id: productId, reservedStock: { lte: input.stock } },
      data: this.toProductData(input)
    })

    if (result.count === 0) await this.throwStockBelowReserved(productId, input.stock)

    return { id: productId.toString() }
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
    this.assertValidStock(stock)

    const productId = BigInt(id)
    const result = await prisma.product.updateMany({
      where: { id: productId, reservedStock: { lte: stock } },
      data: { stock }
    })

    if (result.count === 0) await this.throwStockBelowReserved(productId, stock)

    return { id: productId.toString() }
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
        data: products.map((product) => {
          const reservedStock = product.reservedStock ?? 0

          return {
            id: product.id.toString(),
            name: product.name,
            price: Number(product.price),
            stock: product.stock,
            reservedStock,
            availableStock: Math.max(0, product.stock - reservedStock),
            lowStock: product.lowStock,
            image: product.image,
            isActive: product.isActive,
            categoryId: product.categoryId.toString()
          }
        }),
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

  private assertValidStock(stock: number) {
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('El stock debe ser un número entero mayor o igual a 0.')
    }
  }

  /** Se llama cuando el UPDATE condicional no afectó filas: o no existe, o el stock quedaba por debajo de lo reservado. */
  private async throwStockBelowReserved(productId: bigint, requestedStock: number): Promise<never> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, reservedStock: true }
    })

    if (!product) {
      throw new Error('El producto no existe.')
    }

    const reserved = product.reservedStock ?? 0
    throw new Error(
      `No se puede dejar el stock de "${product.name}" en ${requestedStock}: hay ${reserved} unidades reservadas por órdenes en edición. Esperá a que terminen o ingresá un valor mayor o igual a ${reserved}.`
    )
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