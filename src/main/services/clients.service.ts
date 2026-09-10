import { prisma } from '../infrastructure/db/prisma'
import { CreateClientInput, SearchParams, UpdateClientInput } from '../domain/types/electron-env'

export class ClientsService {
  async updateClient(input: UpdateClientInput): Promise<{ id: string }> {
    return prisma.$transaction(async (transaction) => {
      const clientId = BigInt(input.id)
      const duplicate = await transaction.client.findFirst({
        where: {
          AND: [
            { id: { not: clientId } },
            { OR: [{ cuil: input.cuil }, { email: input.email }] }
          ]
        },
        select: { cuil: true, email: true }
      })

      if (duplicate?.cuil === input.cuil) throw new Error('Ya existe otro cliente con ese CUIL/CUIT.')
      if (duplicate?.email === input.email) throw new Error('Ya existe otro cliente con ese email.')

      const province = await transaction.province.findUnique({
        where: { name: input.province },
        select: { id: true }
      })
      if (!province) throw new Error('La provincia seleccionada no existe.')

      const city = await transaction.city.findFirst({
        where: { name: input.city, provinceId: province.id },
        select: { id: true }
      }) ?? await transaction.city.create({
        data: { name: input.city, provinceId: province.id },
        select: { id: true }
      })

      const address = await transaction.address.findFirst({
        where: { clientId },
        select: { id: true }
      })

      await transaction.client.update({
        where: { id: clientId },
        data: {
          name: input.name,
          lastname: input.lastname,
          cuil: input.cuil,
          email: input.email
        }
      })

      if (address) {
        await transaction.address.update({
          where: { id: address.id },
          data: {
            street: input.street,
            number: input.number,
            postalCode: input.postalCode,
            cityId: city.id
          }
        })
      } else {
        await transaction.address.create({
          data: {
            clientId,
            street: input.street,
            number: input.number,
            postalCode: input.postalCode,
            cityId: city.id
          }
        })
      }

      return { id: input.id }
    })
  }

  async deleteClient(id: string): Promise<{ id: string }> {
    return prisma.$transaction(async (transaction) => {
      const clientId = BigInt(id)
      await transaction.client.update({
        where: { id: clientId },
        data: { isActive: false }
      })

      return { id }
    })
  }

  async getClients(searchParams: SearchParams): Promise<{
    data: Array<{
      id: string
      name: string
      lastname: string
      cuil: string
      email: string
      isActive: boolean
      address?: { postalCode: string; city: string; province: string }
    }>
    total: number
  }> {
    const page = Math.max(searchParams.page, 1)
    const pageSize = 5
    const search = searchParams.search.trim()
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { lastname: { contains: search, mode: 'insensitive' as const } },
            { cuil: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } }
          ]
        }
      : undefined

    const [clients, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: searchParams.sort.toLowerCase().endsWith('desc') ? 'desc' : 'asc' },
        select: {
          id: true,
          name: true,
          lastname: true,
          cuil: true,
          email: true,
          isActive: true,
          addresses: {
            take: 1,
            select: {
              postalCode: true,
              street: true,
              number: true,
              city: { select: { name: true, province: { select: { name: true } } } }
            }
          }
        }
      }),
      prisma.client.count({ where })
    ])

    return {
      data: clients.map((client) => {
        const address = client.addresses[0]
        return {
          id: client.id.toString(),
          name: client.name,
          lastname: client.lastname,
          cuil: client.cuil,
          email: client.email,
          isActive: client.isActive,
          ...(address
            ? {
                address: {
                  street: address.street,
                  number: address.number,
                  postalCode: address.postalCode,
                  city: address.city.name,
                  province: address.city.province.name
                }
              }
            : {})
        }
      }),
      total
    }
  }

  async createClient(input: CreateClientInput): Promise<{ id: string }> {
    return prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.client.findFirst({
        where: {
          OR: [{ cuil: input.cuil }, { email: input.email }]
        },
        select: { cuil: true, email: true }
      })

      if (duplicate?.cuil === input.cuil) {
        throw new Error('Ya existe un cliente registrado con ese CUIL/CUIT.')
      }

      if (duplicate?.email === input.email) {
        throw new Error('Ya existe un cliente registrado con ese email.')
      }

      const province = await transaction.province.findUnique({
        where: { name: input.province },
        select: { id: true }
      })

      if (!province) {
        throw new Error('La provincia seleccionada no existe.')
      }

      const existingCity = await transaction.city.findFirst({
        where: { name: input.city, provinceId: province.id },
        select: { id: true }
      })

      const city = existingCity ?? await transaction.city.create({
        data: { name: input.city, provinceId: province.id },
        select: { id: true }
      })

      const clients = await transaction.client.findMany({
        select: { id: true },
        orderBy: { id: 'asc' }
      })
      let nextClientId = 1n

      for (const existingClient of clients) {
        if (existingClient.id === nextClientId) {
          nextClientId++
          continue
        }

        if (existingClient.id > nextClientId) break
      }

      const client = await transaction.client.create({
        data: {
          id: nextClientId,
          name: input.name,
          lastname: input.lastname,
          cuil: input.cuil,
          email: input.email,
          addresses: {
            create: {
              street: input.street,
              number: input.number,
              postalCode: input.postalCode,
              city: { connect: { id: city.id } }
            }
          }
        },
        select: { id: true }
      })

      return { id: client.id.toString() }
    })
  }
}

export const clientsService = new ClientsService()