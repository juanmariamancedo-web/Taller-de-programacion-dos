import { prisma } from "../src/main/infrastructure/db/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Iniciando seeder general...");

  // 1. Roles
  const adminRole = await prisma.userRole.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin' },
  });

  await prisma.userRole.upsert({
    where: { name: 'supervisor' },
    update: {},
    create: { name: 'supervisor' },
  });

  await prisma.userRole.upsert({
    where: { name: 'seller' },
    update: {},
    create: { name: 'seller' },
  });

  // 2. Usuario Admin
  const hashedPassword = await bcrypt.hash('123456', 10);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      isActive: true,
      role: {
        connect: { id: adminRole.id },
      },
    },
  });

  // 3. Estados de Orden
  const orderStatesList = [
    'created',
    'pending',
    'paid',
    'dispatched',
    'in_transit',
    'delivered',
    'rejected',
    'stock_error',
  ];

  const statesMap: Record<string, bigint> = {};

  console.log('Cargando estados de orden...');
  for (const name of orderStatesList) {
    const state = await prisma.orderState.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    statesMap[name] = state.id;
  }

  // 4. Clientes
  const clientsData = [
    {
      name: 'Juan',
      lastname: 'Pérez',
      cuil: '20-34567890-9',
      email: 'juan.perez@example.com',
      phone: '+541144445555',
    },
    {
      name: 'María',
      lastname: 'Gómez',
      cuil: '27-38901234-4',
      email: 'maria.gomez@example.com',
      phone: '+541155556666',
    },
    {
      name: 'Carlos',
      lastname: 'López',
      cuil: '20-30123456-8',
      email: 'carlos.lopez@example.com',
      phone: '+541166667777',
    },
    {
      name: 'Laura',
      lastname: 'Fernández',
      cuil: '27-32109876-3',
      email: 'laura.fernandez@example.com',
      phone: null,
    },
    {
      name: 'Diego',
      lastname: 'Rodríguez',
      cuil: '20-39876543-1',
      email: 'diego.rodriguez@example.com',
      phone: '+541188889999',
    },
  ];

  console.log('Cargando clientes...');
  const createdClients = [];
  for (const clientData of clientsData) {
    const client = await prisma.client.upsert({
      where: { email: clientData.email },
      update: {},
      create: clientData,
    });
    createdClients.push(client);
  }

  // 5. Órdenes
  const ordersData = [
    {
      currentStateId: statesMap['created'],
      sellerId: adminUser.id,
      clientId: createdClients[0].id,
      trackingNumber: null,
      total: 150.50,
    },
    {
      currentStateId: statesMap['pending'],
      sellerId: adminUser.id,
      clientId: createdClients[1].id,
      trackingNumber: 'TRK-1002-B',
      total: 89.99,
    },
    {
      currentStateId: statesMap['paid'],
      sellerId: adminUser.id,
      clientId: createdClients[2].id,
      trackingNumber: 'TRK-1003-C',
      total: 320.00,
    },
    {
      currentStateId: statesMap['dispatched'],
      sellerId: adminUser.id,
      clientId: createdClients[3].id,
      trackingNumber: 'TRK-1004-D',
      total: 45.10,
    },
    {
      currentStateId: statesMap['delivered'],
      sellerId: adminUser.id,
      clientId: createdClients[4].id,
      trackingNumber: 'TRK-1005-E',
      total: 500.00,
    },
  ];

  console.log('Cargando órdenes de prueba...');
  for (const order of ordersData) {
    await prisma.order.create({
      data: order,
    });
  }

  console.log('Seeder completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });