const bcrypt = require('bcrypt')
import {prisma} from "../infrastructure/db/prisma"
import {Credentials, AuthResponse} from "../domain/types/electron-env"

export class AuthService {
  async login(credentials: Credentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    try {
      // 1. Buscar usuario por email con Prisma
      const user = await prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        return {
          success: false,
          message: 'Usuario o contraseña incorrectos'
        };
      }

      // 2. Validar contraseña
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Usuario o contraseña incorrectos'
        };
      }

      // 3. Devolver datos del usuario (excluyendo el hash del password)
      return {
        success: true,
        user: {
          id: `${user.id}`,
          username: user.username,
          isActive: user.isActive
        }
      };
    } catch (error) {
      console.error('Error en login con Prisma:', error);
      return {
        success: false,
        message: 'Error al consultar la base de datos'
      };
    }
  }
}

export const authService = new AuthService();