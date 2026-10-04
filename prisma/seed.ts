import { prisma } from '../src/main/infrastructure/db/prisma'
import bcrypt from 'bcryptjs'
import { seedProvinces } from './SeedProvincias'

async function main() {
  console.log('Iniciando seeder general...')

  await seedProvinces()

  // Buscar una ciudad de prueba generada en seedProvinces
  const sampleCity = await prisma.city.findFirst()
  if (!sampleCity) {
    throw new Error('No se encontraron ciudades creadas por seedProvinces.')
  }

  // 1. Roles
  const rolesData = ['admin', 'supervisor', 'seller', 'operator']
  const rolesMap: Record<string, bigint> = {}

  for (const roleName of rolesData) {
    const role = await prisma.userRole.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName }
    })
    rolesMap[roleName] = role.id
  }

  // 2. Usuarios por tipo (Varios vendedores y roles estándar)
  console.log('Cargando usuarios...')
  const defaultPassword = await bcrypt.hash('123456', 10)

  const usersData = [
    { username: 'admin', roleId: rolesMap['admin'] },
    { username: 'supervisor', roleId: rolesMap['supervisor'] },
    { username: 'seller_juan', roleId: rolesMap['seller'] },
    { username: 'seller_maria', roleId: rolesMap['seller'] },
    { username: 'operator', roleId: rolesMap['operator'] }
  ]

  const createdUsers: Record<string, any> = {}

  for (const userData of usersData) {
    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: {},
      create: {
        username: userData.username,
        password: defaultPassword,
        isActive: true,
        roleId: userData.roleId
      }
    })
    createdUsers[userData.username] = user
  }

  // 3. Categorías de Productos
  console.log('Cargando categorías...')
  const categoriesData = [
    { name: 'Electrónica', description: 'Artículos de tecnología y electrónica' },
    { name: 'Herramienta', description: 'Equipamiento y herramientas de taller' },
    { name: 'Repuestos', description: 'Componentes y repuestos automotores' }
  ]

  const createdCategories = []
  for (const category of categoriesData) {
    const existingCategory = await prisma.category.findFirst({
      where: category.name === 'Herramienta'
        ? { name: { in: ['Herramienta', 'Herramientas'] } }
        : { name: category.name }
    })
    const savedCategory = existingCategory
      ? await prisma.category.update({
          where: { id: existingCategory.id },
          data: category
        })
      : await prisma.category.create({ data: category })

    createdCategories.push(savedCategory)
  }
  const categoriesByName = new Map(createdCategories.map((category) => [category.name, category]))

  // 4. Productos
  console.log('Cargando productos de prueba...')
  const productsData = [
    {
      name: 'Escáner Diagnóstico OBD2',
      price: 45000.0,
      stock: 15,
      lowStock: 3,
      image: 'https://via.placeholder.com/150',
      isActive: true,
      categoryId: categoriesByName.get('Electrónica')!.id
    },
    {
      name: 'Interface J2534 Pass-Thru',
      price: 180000.0,
      stock: 5,
      lowStock: 2,
      image: 'https://via.placeholder.com/150',
      isActive: true,
      categoryId: categoriesByName.get('Electrónica')!.id
    },
    {
      name: 'Sensor MAP Volkswagen 1.6',
      price: 12500.5,
      stock: 25,
      lowStock: 5,
      image: 'https://via.placeholder.com/150',
      isActive: true,
      categoryId: categoriesByName.get('Repuestos')!.id
    },
    {
      name: 'Kit Inyectores Bosch 0280',
      price: 68000.0,
      stock: 8,
      lowStock: 2,
      image: 'https://via.placeholder.com/150',
      isActive: true,
      categoryId: categoriesByName.get('Repuestos')!.id
    },
    {
      name: 'Soldadora Inverter MIG/MAG 170A',
      price: 245000.0,
      stock: 4,
      lowStock: 1,
      image: 'https://via.placeholder.com/150',
      isActive: true,
      categoryId: categoriesByName.get('Herramienta')!.id
    },
    {
      name: 'Multímetro Digital Profesional',
      price: 32000.0,
      stock: 12,
      lowStock: 3,
      image: 'https://via.placeholder.com/150',
      isActive: true,
      categoryId: categoriesByName.get('Herramienta')!.id
    },
    {
      name: 'Batería 12V 75Ah',
      price: 155000.0,
      stock: 7,
      lowStock: 2,
      image: 'https://via.placeholder.com/150',
      isActive: true,
      categoryId: categoriesByName.get('Repuestos')!.id
    },
    {
      name: 'Cargador Inteligente de Baterías',
      price: 89000.0,
      stock: 6,
      lowStock: 2,
      image: 'https://via.placeholder.com/150',
      isActive: true,
      categoryId: categoriesByName.get('Electrónica')!.id
    }
  ]

  const createdProducts = []
  for (const productData of productsData) {
    let product = await prisma.product.findFirst({
      where: { name: productData.name }
    })

    if (!product) {
      product = await prisma.product.create({
        data: productData
      })
    }
    createdProducts.push(product)
  }

  // 5. Estados de Orden
  const orderStatesList = [
    'created',
    'pending',
    'paid',
    'dispatched',
    'in_transit',
    'delivered',
    'rejected',
    'stock_error'
  ]

  const statesMap: Record<string, bigint> = {}

  console.log('Cargando estados de orden...')
  for (const name of orderStatesList) {
    const state = await prisma.orderState.upsert({
      where: { name },
      update: {},
      create: { name }
    })
    statesMap[name] = state.id
  }

  // 6. Clientes
  const clientsData = [
    {
      name: 'Juan',
      lastname: 'Pérez',
      cuil: '20-34567890-9',
      email: 'juan.perez@example.com',
      phone: '+541144445555'
    },
    {
      name: 'María',
      lastname: 'Gómez',
      cuil: '27-38901234-4',
      email: 'maria.gomez@example.com',
      phone: '+541155556666'
    },
    {
      name: 'Carlos',
      lastname: 'López',
      cuil: '20-30123456-8',
      email: 'carlos.lopez@example.com',
      phone: '+541166667777'
    },
    {
      name: 'Laura',
      lastname: 'Fernández',
      cuil: '27-32109876-3',
      email: 'laura.fernandez@example.com',
      phone: null
    },
    {
      name: 'Diego',
      lastname: 'Rodríguez',
      cuil: '20-39876543-1',
      email: 'diego.rodriguez@example.com',
      phone: '+541188889999'
    }
  ]

  console.log('Cargando clientes...')
  const createdClients = []
  for (const clientData of clientsData) {
    const client = await prisma.client.upsert({
      where: { email: clientData.email },
      update: {},
      create: clientData
    })
    createdClients.push(client)
  }

  // 7. Direcciones (Address)
  console.log('Cargando direcciones de prueba...')
  const createdAddresses = []
  for (let i = 0; i < createdClients.length; i++) {
    const client = createdClients[i]

    let address = await prisma.address.findFirst({
      where: { clientId: client.id }
    })

    if (!address) {
      address = await prisma.address.create({
        data: {
          street: `Calle Falsa ${100 + (i + 1) * 10}`,
          number: 100 + i * 5,
          floor: i % 2 === 0 ? `${i + 1}` : null,
          apartment: i % 2 === 0 ? 'A' : null,
          postalCode: `3400`,
          cityId: sampleCity.id,
          clientId: client.id
        }
      })
    }
    createdAddresses.push(address)
  }

  // 8. Órdenes distribuidas entre múltiples vendedores ('seller_juan' y 'seller_maria')
  const sellerJuan = createdUsers['seller_juan']
  const sellerMaria = createdUsers['seller_maria']

  const ordersData = [
    {
      currentStateId: statesMap['created'],
      sellerId: sellerJuan.id,
      clientId: createdClients[0].id,
      shippingAddressId: createdAddresses[0].id,
      trackingNumber: null,
      total: 57500.5,
      itemOrders: {
        create: [
          {
            productId: createdProducts[0].id,
            unitPrice: 45000.0,
            amount: 1
          },
          {
            productId: createdProducts[2].id,
            unitPrice: 12500.5,
            amount: 1
          }
        ]
      }
    },
    {
      currentStateId: statesMap['pending'],
      sellerId: sellerJuan.id,
      clientId: createdClients[1].id,
      shippingAddressId: createdAddresses[1].id,
      trackingNumber: 'TRK-1002-B',
      total: 136000.0,
      itemOrders: {
        create: [
          {
            productId: createdProducts[3].id,
            unitPrice: 68000.0,
            amount: 2
          }
        ]
      }
    },
    {
      currentStateId: statesMap['paid'],
      sellerId: sellerMaria.id,
      clientId: createdClients[2].id,
      shippingAddressId: createdAddresses[2].id,
      trackingNumber: 'TRK-1003-C',
      total: 180000.0,
      itemOrders: {
        create: [
          {
            productId: createdProducts[1].id,
            unitPrice: 180000.0,
            amount: 1
          }
        ]
      }
    },
    {
      currentStateId: statesMap['dispatched'],
      sellerId: sellerMaria.id,
      clientId: createdClients[3].id,
      shippingAddressId: null,
      trackingNumber: 'TRK-1004-D',
      total: 25001.0,
      itemOrders: {
        create: [
          {
            productId: createdProducts[2].id,
            unitPrice: 12500.5,
            amount: 2
          }
        ]
      }
    },
    {
      currentStateId: statesMap['delivered'],
      sellerId: sellerMaria.id,
      clientId: createdClients[4].id,
      shippingAddressId: createdAddresses[4].id,
      trackingNumber: 'TRK-1005-E',
      total: 245000.0,
      itemOrders: {
        create: [
          {
            productId: createdProducts[4].id,
            unitPrice: 245000.0,
            amount: 1
          }
        ]
      }
    }
  ]

  console.log('Cargando órdenes de prueba para múltiples vendedores...')
  for (const order of ordersData) {
    await prisma.order.create({
      data: order
    })
  }

  console.log('Seeder completado exitosamente.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })