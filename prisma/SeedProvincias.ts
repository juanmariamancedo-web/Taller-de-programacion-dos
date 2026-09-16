import { prisma } from '../src/main/infrastructure/db/prisma'

const provincesWithCities = [
  { province: 'Buenos Aires', cities: ['La Plata', 'Mar del Plata', 'Bahía Blanca'] },
  { province: 'Catamarca', cities: ['San Fernando del Valle de Catamarca'] },
  { province: 'Chaco', cities: ['Resistencia', 'Sáenz Peña'] },
  { province: 'Chubut', cities: ['Rawson', 'Comodoro Rivadavia'] },
  { province: 'Ciudad Autónoma de Buenos Aires', cities: ['CABA'] },
  { province: 'Córdoba', cities: ['Córdoba Capital', 'Río Cuarto'] },
  { province: 'Corrientes', cities: ['Corrientes Capital', 'Goya', 'Paso de los Libres'] },
  { province: 'Entre Ríos', cities: ['Paraná', 'Concordia'] },
  { province: 'Formosa', cities: ['Formosa Capital'] },
  { province: 'Jujuy', cities: ['San Salvador de Jujuy'] },
  { province: 'La Pampa', cities: ['Santa Rosa'] },
  { province: 'La Rioja', cities: ['La Rioja Capital'] },
  { province: 'Mendoza', cities: ['Mendoza Capital', 'San Rafael'] },
  { province: 'Misiones', cities: ['Posadas', 'Iguazú'] },
  { province: 'Neuquén', cities: ['Neuquén Capital'] },
  { province: 'Río Negro', cities: ['Viedma', 'Bariloche'] },
  { province: 'Salta', cities: ['Salta Capital'] },
  { province: 'San Juan', cities: ['San Juan Capital'] },
  { province: 'San Luis', cities: ['San Luis Capital'] },
  { province: 'Santa Cruz', cities: ['Río Gallegos'] },
  { province: 'Santa Fe', cities: ['Santa Fe Capital', 'Rosario'] },
  { province: 'Santiago del Estero', cities: ['Santiago del Estero Capital'] },
  { province: 'Tierra del Fuego', cities: ['Ushuaia', 'Río Grande'] },
  { province: 'Tucumán', cities: ['San Miguel de Tucumán'] }
]

export async function seedProvinces() {
  for (const item of provincesWithCities) {
    // 1. Crear o buscar la provincia
    const province = await prisma.province.upsert({
      where: { name: item.province },
      update: {},
      create: { name: item.province }
    })

    // 2. Crear las ciudades asociadas a la provincia
    for (const cityName of item.cities) {
      await prisma.city.upsert({
        where: {
          name_provinceId: {
            name: cityName,
            provinceId: province.id
          }
        },
        update: {},
        create: {
          name: cityName,
          provinceId: province.id
        }
      })
    }
  }

  console.log('Provincias y ciudades cargadas correctamente.')
}