import { ipcMain } from 'electron';
import { usersService } from '../../services/users.service';
import { SearchParams, CreateUserInput, UpdateUserInput, UpdateProfileInput } from '../../domain/types/electron-env';

export function registerUserIPC(): void {
  // Crear usuario
  ipcMain.handle('users:create', async (_event, input: CreateUserInput) => {
    try {
      const data = await usersService.createUser(input);
      return { success: true, data };
    } catch (error) {
      console.error('Failed to create user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo crear el usuario.',
      };
    }
  });

  // Obtener lista de usuarios
  ipcMain.handle('users:getUsers', async (_event, searchParams: SearchParams) => {
    try {
      const rawData = await usersService.getUsers(searchParams);

      const data = JSON.parse(
        JSON.stringify(rawData, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );

      return data;
    } catch (error) {
      console.error('Failed to fetch users:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido al obtener usuarios.',
      };
    }
  });

  // Actualizar usuario
  ipcMain.handle('users:update', async (_event, input: UpdateUserInput) => {
    try {
      const response = await usersService.updateUser(input);
      return response;
    } catch (error) {
      console.error('Failed to update user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo actualizar el usuario.',
      };
    }
  });

  // Eliminar usuario
  ipcMain.handle('users:delete', async (_event, id: number | bigint) => {
    try {
      const response = await usersService.deleteUser(id);
      return response;
    } catch (error) {
      console.error('Failed to delete user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo eliminar el usuario.',
      };
    }
  });

  // Obtener roles de usuario
  ipcMain.handle('users:getRoles', async () => {
    try {
      const rawData = await usersService.getRoles();
      return JSON.parse(
        JSON.stringify(rawData, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudieron cargar los roles.',
      };
    }
  });
  ipcMain.handle('users:update-profile', async (_event, input: UpdateProfileInput) => {
    try {
      const result = await usersService.updateProfile(input)
      return result
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al actualizar el perfil',
      }
    }
  })
}