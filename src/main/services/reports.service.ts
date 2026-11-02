import { authService } from './auth.service'
import { prisma } from '../infrastructure/db/prisma'
import type {
  ClientReportData,
  OrdersReportData,
  OrdersReportFilters,
  ReportDateFilters,
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

function getCreatedAtFilter(filters: ReportDateFilters): { gte?: Date; lt?: Date } | undefined {
  const from = parseReportDate(filters.from, 'Desde')
  const to = parseReportDate(filters.to, 'Hasta')
  if (from && to && from > to) {
    throw new Error('La fecha "Desde" no puede ser posterior a "Hasta".')
  }

  const createdAt: { gte?: Date; lt?: Date } = {}
  if (from) createdAt.gte = from
  if (to) {
    const exclusiveEnd = new Date(to)
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
    createdAt.lt = exclusiveEnd
  }
  return Object.keys(createdAt).length ? createdAt : undefined
}

function getTimelineLabel(date: Date, granularity: 'week' | 'month'): string {
  if (granularity === 'month') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  const monday = new Date(date)
  const day = monday.getUTCDay()
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1))
  return monday.toISOString().slice(0, 10)
}

export class ReportsService {
  private async getSellerFilter(): Promise<{ sellerId?: bigint }> {
    const session = await authService.getActiveSession()
    if (session && (
      session.roleId === 3 ||
      ['seller', 'vendedor'].includes(session.roleName.toLowerCase())
    )) {
      return { sellerId: BigInt(session.id) }
    }
    return {}
  }

  async getProductsReport(filters: ReportDateFilters): Promise<ProductReportData> {
    const sellerFilter = await this.getSellerFilter()
    const createdAt = getCreatedAtFilter(filters)
    const orders = await prisma.order.findMany({
      where: {
        ...sellerFilter,
        seller: { role: { name: { in: ['seller', 'vendedor'] } } },
        ...(createdAt ? { createdAt } : {})
      },
      select: {
        id: true,
        createdAt: true,
        currentState: { select: { name: true } },
        sellerId: true,
        total: true,
        seller: { select: { username: true } },
        client: { select: { name: true, lastname: true } },
        itemOrders: {
          select: {
            amount: true,
            unitPrice: true,
            product: { select: { name: true } }
          }
        }
      }
    })

    const sellers = new Map<string, ProductReportData['rows'][number]>()
    const details: ProductReportData['details'] = []
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
      details.push({
        orderId: order.id.toString(),
        orderDate: order.createdAt?.toISOString() ?? null,
        sellerName: order.seller.username,
        clientName: `${order.client.name} ${order.client.lastname}`,
        orderState: order.currentState.name,
        orderTotal: salesTotal,
        items: order.itemOrders.map((item) => {
          const quantity = Number(item.amount)
          const unitPrice = Number(item.unitPrice)
          return {
            productName: item.product.name,
            quantity,
            unitPrice,
            lineTotal: quantity * unitPrice
          }
        })
      })
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
      sellerCount: rows.length,
      details
    }
  }

  async getClientsReport(filters: ReportDateFilters): Promise<ClientReportData> {
    const sellerFilter = await this.getSellerFilter()
    const createdAt = getCreatedAtFilter(filters)
    const orders = await prisma.order.findMany({
      where: {
        ...sellerFilter,
        ...(createdAt ? { createdAt } : {})
      },
      select: {
        id: true,
        createdAt: true,
        clientId: true,
        total: true,
        client: { select: { name: true, lastname: true } },
        seller: { select: { username: true } },
        currentState: { select: { name: true } },
        itemOrders: {
          select: {
            amount: true,
            unitPrice: true,
            product: { select: { name: true } }
          }
        }
      }
    })

    const clients = new Map<string, ClientReportData['rows'][number]>()
    const details: ClientReportData['details'] = []
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
      details.push({
        orderId: order.id.toString(),
        orderDate: order.createdAt?.toISOString() ?? null,
        sellerName: order.seller.username,
        clientName: `${order.client.name} ${order.client.lastname}`,
        orderState: order.currentState.name,
        orderTotal: amountSpent,
        items: order.itemOrders.map((item) => {
          const quantity = Number(item.amount)
          const unitPrice = Number(item.unitPrice)
          return {
            productName: item.product.name,
            quantity,
            unitPrice,
            lineTotal: quantity * unitPrice
          }
        })
      })
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
      clientCount: rows.length,
      details
    }
  }

  async getOrdersReport(filters: OrdersReportFilters): Promise<OrdersReportData> {
    const sellerFilter = await this.getSellerFilter()
    const createdAt = getCreatedAtFilter(filters)

    const items = await prisma.itemOrder.findMany({
      where: {
        order: {
          ...sellerFilter,
          currentState: { name: { in: ['paid', 'dispatched', 'in_transit', 'delivered'] } },
          ...(createdAt ? { createdAt } : {})
        }
      },
      select: {
        amount: true,
        unitPrice: true,
        orderId: true,
        productId: true,
        product: { select: { name: true } },
        order: {
          select: {
            createdAt: true,
            total: true,
            seller: { select: { username: true } },
            client: { select: { name: true, lastname: true } }
          }
        }
      }
    })

    const products = new Map<string, OrdersReportData['rows'][number]>()
    const orderIds = new Set<string>()
    const ordersByProduct = new Map<string, Set<string>>()
    const details: OrdersReportData['details'] = []
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
      details.push({
        orderId,
        orderDate: item.order.createdAt?.toISOString() ?? null,
        sellerName: item.order.seller.username,
        clientName: `${item.order.client.name} ${item.order.client.lastname}`,
        productName: item.product.name,
        quantity: quantitySold,
        unitPrice: Number(item.unitPrice),
        lineTotal: salesTotal,
        orderTotal: Number(item.order.total)
      })
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
    const granularity = filters.granularity ?? 'month'
    const timelineOrders = await prisma.order.findMany({
      where: { ...sellerFilter, ...(createdAt ? { createdAt } : {}) },
      select: { createdAt: true }
    })
    const timelineMap = new Map<string, number>()
    for (const order of timelineOrders) {
      if (!order.createdAt) continue
      const label = getTimelineLabel(order.createdAt, granularity)
      timelineMap.set(label, (timelineMap.get(label) ?? 0) + 1)
    }

    if (timelineOrders.length) {
      const datedOrders = timelineOrders.flatMap((order) => order.createdAt ? [order.createdAt] : [])
      const minDate = filters.from
        ? parseReportDate(filters.from, 'Desde')!
        : new Date(Math.min(...datedOrders.map((date) => date.getTime())))
      const maxDate = filters.to
        ? parseReportDate(filters.to, 'Hasta')!
        : new Date(Math.max(...datedOrders.map((date) => date.getTime())))

      if (granularity === 'month') {
        const cursor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1))
        const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1))
        while (cursor <= end) {
          const label = getTimelineLabel(cursor, 'month')
          if (!timelineMap.has(label)) timelineMap.set(label, 0)
          cursor.setUTCMonth(cursor.getUTCMonth() + 1)
        }
      } else {
        const cursor = new Date(minDate)
        const day = cursor.getUTCDay()
        cursor.setUTCDate(cursor.getUTCDate() - (day === 0 ? 6 : day - 1))
        const end = new Date(maxDate)
        const endDay = end.getUTCDay()
        end.setUTCDate(end.getUTCDate() - (endDay === 0 ? 6 : endDay - 1))
        while (cursor <= end) {
          const label = getTimelineLabel(cursor, 'week')
          if (!timelineMap.has(label)) timelineMap.set(label, 0)
          cursor.setUTCDate(cursor.getUTCDate() + 7)
        }
      }
    }

    const timeline = [...timelineMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label, count }))

    return {
      rows,
      totalUnits,
      totalSales,
      totalOrders: orderIds.size,
      timeline,
      details
    }
  }

  async getSellerSales(): Promise<import('../domain/types/electron-env').SellerSalesData> {
    const session = await authService.getActiveSession()
    if (!session || (![3].includes(session.roleId) && !['seller', 'vendedor'].includes(session.roleName.toLowerCase()))) {
      throw new Error('Solo los vendedores pueden consultar sus ventas.')
    }

    const sellerId = BigInt(session.id)
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const orders = await prisma.order.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, createdAt: true, total: true,
        client: { select: { name: true, lastname: true } },
        currentState: { select: { name: true } }
      }
    })
    const monthOrders = orders.filter((order) => order.createdAt && order.createdAt >= monthStart)
    const totalSoldMonth = monthOrders.reduce((sum, order) => sum + Number(order.total), 0)
    return {
      totalSoldMonth,
      ordersCount: orders.length,
      averageSale: orders.length ? orders.reduce((sum, order) => sum + Number(order.total), 0) / orders.length : 0,
      orders: orders.map((order) => ({
        id: order.id.toString(),
        createdAt: order.createdAt?.toISOString() ?? null,
        clientName: `${order.client.name} ${order.client.lastname}`,
        state: order.currentState.name,
        total: Number(order.total)
      }))
    }
  }
}

export const reportsService = new ReportsService()
