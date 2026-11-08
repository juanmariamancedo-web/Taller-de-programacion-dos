import { prisma } from '../infrastructure/db/prisma';
import {
  ProductCategory,
  ProductInput,
  ProductsResponse,
  SearchParams,
  UpdateProductInput
} from '../domain/types/electron-env';
import { Prisma } from '../infrastructure/db/generated/client/client';
import { OrderState } from '../domain/orderStateRules';

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

    const productId = BigInt(input.id)

    // Calculamos dinámicamente las unidades reservadas por órdenes en borrador o pendientes
    const activeReservations = await prisma.itemOrder.aggregate({
      where: {
        productId: productId,
        order: {
          currentStateId: {
            in: [BigInt(OrderState.Created), BigInt(OrderState.Pending)],
          },
        },
      },
      _sum: { amount: true },
    });

    const reserved = Number(activeReservations._sum.amount ?? 0);

    // Guardia atómica de stock: el nuevo stock físico no puede ser menor a lo que ya está reservado
    if (input.stock < reserved) {
      await this.throwStockBelowReserved(productId, input.stock, reserved);
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: this.toProductData(input),
      select: { id: true }
    });

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
    this.assertValidStock(stock)

    const productId = BigInt(id)

    // Calculamos dinámicamente las unidades reservadas por borradores y pendientes
    const activeReservations = await prisma.itemOrder.aggregate({
      where: {
        productId: productId,
        order: {
          currentStateId: {
            in: [BigInt(OrderState.Created), BigInt(OrderState.Pending)],
          },
        },
      },
      _sum: { amount: true },
    });

    const reserved = Number(activeReservations._sum.amount ?? 0);

    if (stock < reserved) {
      await this.throwStockBelowReserved(productId, stock, reserved);
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { stock },
      select: { id: true }
    });

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
            category: true,
          },
          orderBy,
        }),
        prisma.product.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit) || 1;

      // Calculamos el stock reservado y disponible considerando borradores y pendientes
      const productsWithDynamicStock = await Promise.all(
        products.map(async (product) => {
          const activeReservations = await prisma.itemOrder.aggregate({
            where: {
              productId: product.id,
              order: {
                currentStateId: {
                  in: [BigInt(OrderState.Created), BigInt(OrderState.Pending)],
                },
              },
            },
            _sum: { amount: true },
          });

          const reservedStock = Number(activeReservations._sum.amount ?? 0);
          const availableStock = Math.max(0, product.stock - reservedStock);

          return {
            id: product.id.toString(),
            name: product.name,
            price: Number(product.price),
            stock: product.stock,
            reservedStock,
            availableStock,
            lowStock: product.lowStock,
            image: product.image,
            isActive: product.isActive,
            categoryId: product.categoryId.toString()
          }
        })
      );

      return {
        success: true,
        data: productsWithDynamicStock,
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

  private async throwStockBelowReserved(productId: bigint, requestedStock: number, knownReserved?: number): Promise<never> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true }
    })

    if (!product) {
      throw new Error('El producto no existe.')
    }

    const reserved = knownReserved ?? 0
    throw new Error(
      `No se puede dejar el stock de "${product.name}" en ${requestedStock}: hay ${reserved} unidades reservadas por órdenes en edición o pendientes. Esperá a que terminen o ingresá un valor mayor o igual a ${reserved}.`
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