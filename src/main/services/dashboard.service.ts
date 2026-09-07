import { prisma } from '../infrastructure/db/prisma';

export class DashboardService {
  async getDashboardData() {
    const registeredClients = (await prisma.client.findMany()).length
    const pendingOrders = (await prisma.order.findMany({
        where: {
            currentState: {
                name: "pending"
            }
        }
    })).length

    const deliveredOrders = (await prisma.order.findMany({
        where: {
            currentState: {
                name: "delivered"
            }
        }
    })).length

    const orders = await prisma.order.findMany({
        include: {
            itemOrders: {
                select: {
                    unitPrice: true,
                    amount: true
                }
            }
        }
    })

    // 1. Calculamos la suma total acumulada
    const totalRevenue = orders.reduce((accOrder, order) => {
        const orderTotal = order.itemOrders.reduce((accItem, item) => {
            return accItem + item.amount * Number(item.unitPrice);
        }, 0);

        return accOrder + orderTotal;
    }, 0);

    const averageTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

    return {
        registeredClients,
        pendingOrders, 
        deliveredOrders,
        averageTicket
    }
  }
}

export const dashboardService = new DashboardService();