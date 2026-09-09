import { prisma } from '../infrastructure/db/prisma'
import { CreateClientInput } from '../domain/types/electron-env'

export class ClientsService {
  async createClient(input: CreateClientInput): Promise<{ id: string }> {
    return prisma.$transaction(async (transaction) => {
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

      const client = await transaction.client.create({
        data: {
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