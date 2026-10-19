import { authService } from './auth.service'
import { prisma } from '../infrastructure/db/prisma'
import type {
  ClientReportData,
  OrdersReportData,
  OrdersReportFilters,
  ProductReportData
} from '../domain/types/electron-env'

function parseReportDate(value: string | undefined, label: string): Date | undefined {
  if (value === undefined || value === '') return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`La fecha "${label}" no es válida.`)
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`La fecha "${label}" no es válida.`)
  }
  return date
}

export class ReportsService {
  private async getSellerFilter(): Promise<{ sellerId?: bigint }> {
    const session = await authService.getActiveSession()
    if (session?.roleName.toLowerCase() === 'seller') {
      return { sellerId: BigInt(session.id) }
    }
    return {}
  }

  async getProductsReport(): Promise<ProductReportData> {
    const sellerFilter = await this.getSellerFilter()
    const orders = await prisma.order.findMany({
      where: sellerFilter,
      select: {
        sellerId: true,
        total: true,
        seller: { select: { username: true } }
      }
    })

    const sellers = new Map<string, ProductReportData['rows'][number]>()
    let totalSales = 0
    for (const order of orders) {
      const sellerId = order.sellerId.toString()
      const salesTotal = Number(order.total)
      const seller = sellers.get(sellerId) ?? {
        sellerId,
        sellerName: order.seller.username,
        ordersCount: 0,
        salesTotal: 0
      }
      seller.ordersCount += 1
      seller.salesTotal += salesTotal
      totalSales += salesTotal
      sellers.set(sellerId, seller)
    }

    const rows = [...sellers.values()].sort(
      (a, b) =>
        b.ordersCount - a.ordersCount ||
        b.salesTotal - a.salesTotal ||
        a.sellerName.localeCompare(b.sellerName)
    )
    return {
      rows,
      totalOrders: orders.length,
      totalSales,
      sellerCount: rows.length
    }
  }

  async getClientsReport(): Promise<ClientReportData> {
    const sellerFilter = await this.getSellerFilter()
    const orders = await prisma.order.findMany({
      where: sellerFilter,
      select: {
        clientId: true,
        total: true,
        client: { select: { name: true, lastname: true } }
      }
    })

    const clients = new Map<string, ClientReportData['rows'][number]>()
    let totalSpent = 0
    for (const order of orders) {
      const clientId = order.clientId.toString()
      const amountSpent = Number(order.total)
      const client = clients.get(clientId) ?? {
        clientId,
        clientName: `${order.client.name} ${order.client.lastname}`,
        purchases: 0,
        amountSpent: 0
      }
      client.purchases += 1
      client.amountSpent += amountSpent
      totalSpent += amountSpent
      clients.set(clientId, client)
    }

    const rows = [...clients.values()].sort(
      (a, b) =>
        b.purchases - a.purchases ||
        b.amountSpent - a.amountSpent ||
        a.clientName.localeCompare(b.clientName)
    )
    return {
      rows,
      totalPurchases: orders.length,
      totalSpent,
      clientCount: rows.length
    }
  }

  async getOrdersReport(filters: OrdersReportFilters): Promise<OrdersReportData> {
    const from = parseReportDate(filters.from, 'Desde')
    const to = parseReportDate(filters.to, 'Hasta')
    if (from && to && from > to) {
      throw new Error('La fecha "Desde" no puede ser posterior a "Hasta".')
    }

    const sellerFilter = await this.getSellerFilter()
    const createdAt: { gte?: Date; lt?: Date } = {}
    if (from) createdAt.gte = from
    if (to) {
      const exclusiveEnd = new Date(to)
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
      createdAt.lt = exclusiveEnd
    }

    const items = await prisma.itemOrder.findMany({
      where: {
        order: {
          ...sellerFilter,
          ...(Object.keys(createdAt).length ? { createdAt } : {})
        }
      },
      select: {
        amount: true,
        unitPrice: true,
        orderId: true,
        productId: true,
        product: { select: { name: true } }
      }
    })

    const products = new Map<string, OrdersReportData['rows'][number]>()
    const orderIds = new Set<string>()
    const ordersByProduct = new Map<string, Set<string>>()
    let totalUnits = 0
    let totalSales = 0
    for (const item of items) {
      const productId = item.productId.toString()
      const quantitySold = item.amount
      const salesTotal = quantitySold * Number(item.unitPrice)
      const product = products.get(productId) ?? {
        productId,
        productName: item.product.name,
        quantitySold: 0,
        salesTotal: 0,
        orderCount: 0
      }
      product.quantitySold += quantitySold
      product.salesTotal += salesTotal
      products.set(productId, product)
      const orderId = item.orderId.toString()
      orderIds.add(orderId)
      const productOrders = ordersByProduct.get(productId) ?? new Set<string>()
      productOrders.add(orderId)
      ordersByProduct.set(productId, productOrders)
      totalUnits += quantitySold
      totalSales += salesTotal
    }

    for (const [productId, productOrders] of ordersByProduct) {
      const product = products.get(productId)
      if (product) product.orderCount = productOrders.size
    }

    const rows = [...products.values()].sort(
      (a, b) =>
        b.quantitySold - a.quantitySold ||
        b.salesTotal - a.salesTotal ||
        a.productName.localeCompare(b.productName)
    )
    return {
      rows,
      totalUnits,
      totalSales,
      totalOrders: orderIds.size
    }
  }
}

export const reportsService = new ReportsService()
