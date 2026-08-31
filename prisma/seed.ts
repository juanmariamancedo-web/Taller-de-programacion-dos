import { prisma } from  "../src/main/infrastructure/db/prisma"
import bcrypt from "bcryptjs";

async function main() {
  // 1. Crear o asegurar que existan los tres roles
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

  // 2. Hash de la contraseña
  const hashedPassword = await bcrypt.hash('123456', 10);

  // 3. Crear el usuario asociándolo al rol 'admin'
  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      isActive: true,
      // Conectamos con el ID del rol recién creado/encontrado
      role: {
        connect: { id: adminRole.id }
      }
      // O si en la tabla User usás la FK directo (ej. roleId):
      // roleId: adminRole.id
    },
  });

  console.log('Roles y usuario de muestra creados exitosamente');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });