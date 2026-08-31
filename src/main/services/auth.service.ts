import bcrypt from 'bcryptjs';
import { prisma } from '../infrastructure/db/prisma';
import { Credentials, AuthResponse } from '../domain/types/electron-env';
import { sessionService } from './session.service';

export class AuthService {
  async getActiveSession() {
    const userId = sessionService.getToken();
    if (!userId) return null;

    // Buscar usuario en la BD usando el ID guardado
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, username: true, isActive: true }
    });

    return user;
  }

  async login(credentials: Credentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    try {
      // 1. Buscar usuario por username con Prisma
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

      // 3. Persistir sesión encriptada en disco
      sessionService.saveToken(String(user.id));

      // 4. Devolver respuesta exitosa con los datos del usuario
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

  async logout() {
    sessionService.clearSession();
    return { success: true };
  }
}

export const authService = new AuthService();