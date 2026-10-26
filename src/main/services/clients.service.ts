import { prisma } from '../infrastructure/db/prisma'
import { ClientAddressInput, CreateClientInput, SearchParams, UpdateClientInput } from '../domain/types/electron-env'
import { Prisma } from '../infrastructure/db/generated/client/client'

async function resolveCityId(
  transaction: Prisma.TransactionClient,
  input: ClientAddressInput
): Promise<bigint> {
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

  return city.id
}

function validateAddresses(addresses: ClientAddressInput[]): void {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('El cliente debe tener al menos una dirección.')
  }
}

export class ClientsService {
  async updateClient(input: UpdateClientInput): Promise<{ id: string }> {
    return prisma.$transaction(async (transaction) => {
      validateAddresses(input.addresses)
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

      const existingAddresses = await transaction.address.findMany({
        where: { clientId },
        select: { id: true },
        orderBy: { id: 'asc' }
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

      const retainedAddressIds = new Set<bigint>()
      for (const [index, addressInput] of input.addresses.entries()) {
        const addressId = addressInput.id
          ? BigInt(addressInput.id)
          : existingAddresses[index]?.id
        const cityId = await resolveCityId(transaction, addressInput)
        const data = {
          street: addressInput.street,
          number: addressInput.number,
          postalCode: addressInput.postalCode,
          cityId
        }

        if (addressId) {
          const belongsToClient = existingAddresses.some((address) => address.id === addressId)
          if (!belongsToClient) throw new Error('La dirección seleccionada no pertenece a este cliente.')
          await transaction.address.update({
            where: { id: addressId },
            data
          })
          retainedAddressIds.add(addressId)
        } else {
          const address = await transaction.address.create({
            data: { ...data, clientId },
            select: { id: true }
          })
          retainedAddressIds.add(address.id)
        }
      }

      for (const address of existingAddresses) {
        if (retainedAddressIds.has(address.id)) continue
        const [orderCount, historyCount] = await Promise.all([
          transaction.order.count({ where: { shippingAddressId: address.id } }),
          transaction.orderStatusHistory.count({ where: { addressId: address.id } })
        ])
        if (orderCount > 0 || historyCount > 0) {
          throw new Error('No se puede quitar una dirección asociada a órdenes existentes.')
        }
        await transaction.address.delete({ where: { id: address.id } })
      }

      return { id: input.id }
    })
  }

  async deleteClient(id: string): Promise<{ id: string }> {
    return this.setClientStatus(id, false)
  }

  async setClientStatus(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
    return prisma.$transaction(async (transaction) => {
      const clientId = BigInt(id)
      const client = await transaction.client.update({
        where: { id: clientId },
        data: { isActive },
        select: { id: true, isActive: true }
      })

      return { id: client.id.toString(), isActive: client.isActive }
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
      addresses: Array<{
        id: string
        street: string
        number: number
        postalCode: string
        city: string
        province: string
      }>
      address?: {
        id: string
        street: string
        number: number
        postalCode: string
        city: string
        province: string
      }
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
            select: {
              id: true,
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
          addresses: client.addresses.map((clientAddress) => ({
            id: clientAddress.id.toString(),
            street: clientAddress.street,
            number: clientAddress.number,
            postalCode: clientAddress.postalCode,
            city: clientAddress.city.name,
            province: clientAddress.city.province.name
          })),
          ...(address
            ? {
                address: {
                  id: address.id.toString(),
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
      validateAddresses(input.addresses)
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
          email: input.email
        },
        select: { id: true }
      })

      for (const addressInput of input.addresses) {
        const cityId = await resolveCityId(transaction, addressInput)
        await transaction.address.create({
          data: {
            clientId: client.id,
            street: addressInput.street,
            number: addressInput.number,
            postalCode: addressInput.postalCode,
            cityId
          }
        })
      }

      return { id: client.id.toString() }
    })
  }
}

export const clientsService = new ClientsService()