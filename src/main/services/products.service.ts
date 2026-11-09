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

    const productId = BigInt(input.id)

    const currentProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { reservedStock: true, name: true }
    })

    if (!currentProduct) throw new Error("El producto no existe.")

    if (input.stock < currentProduct.reservedStock) {
      throw new Error(`No se puede dejar el stock de "${currentProduct.name}" en ${input.stock}: hay ${currentProduct.reservedStock} unidades reservadas.`)
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

    const currentProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { reservedStock: true, name: true }
    })

    if (!currentProduct) throw new Error("El producto no existe.")

    if (stock < currentProduct.reservedStock) {
      throw new Error(`No se puede dejar el stock de "${currentProduct.name}" en ${stock}: hay ${currentProduct.reservedStock} unidades reservadas.`)
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { stock },
      select: { id: true }
    });

    return { id: product.id.toString() }
  }

  // ─── NUEVO MÉTODO PARA RESERVAR STOCK EN VIVO ───────────────────────────────
  async reserveProductStock(productId: string, quantity: number, previousQuantity: number = 0) {
    try {
      const pId = BigInt(productId);
      const product = await prisma.product.findUnique({
        where: { id: pId },
        select: { id: true, stock: true, reservedStock: true, name: true }
      });

      if (!product) return { success: false, message: "Producto no encontrado" };

      const delta = quantity - previousQuantity; 
      if (delta === 0) return { success: true };

      const newReserved = Math.max(0, product.reservedStock + delta);

      if (newReserved > product.stock) {
        return { success: false, message: `Stock insuficiente para ${product.name}` };
      }

      await prisma.product.update({
        where: { id: pId },
        data: { reservedStock: newReserved }
      });

      return { success: true };
    } catch (err: any) {
      console.error("Error al reservar stock:", err);
      return { success: false, message: err.message };
    }
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

      const productsWithStock = products.map((product) => {
        const reservedStock = product.reservedStock;
        const availableStock = Math.max(0, product.stock - reservedStock);

        return {
          id: product.id.toString(),
          name: product.name,
          price: Number(product.price),
          stock: product.stock, // Físico
          reservedStock,       // Reservado
          availableStock,      // Disponible (Físico - Reservado)
          lowStock: product.lowStock,
          image: product.image,
          isActive: product.isActive,
          categoryId: product.categoryId.toString()
        }
      });

      return {
        success: true,
        data: productsWithStock,
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