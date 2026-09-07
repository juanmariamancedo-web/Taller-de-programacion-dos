import { prisma } from '../src/main/infrastructure/db/prisma'

const provinces = [
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán'
]

export async function seedProvinces() {
  for (const name of provinces) {
    await prisma.province.upsert({
      where: { name },
      update: {},
      create: { name }
    })
  }

  console.log(`${provinces.length} provincias cargadas.`)
}
