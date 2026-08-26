import { safeStorage, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const SESSION_FILE = path.join(app.getPath('userData'), 'session.enc');

export class SessionService {
  // Guardar token/ID de sesión cifrado
  saveToken(token: string): void {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(SESSION_FILE, encrypted);
    }
  }

  // Leer y descifrar el token guardado
  getToken(): string | null {
    if (!fs.existsSync(SESSION_FILE)) return null;

    try {
      const buffer = fs.readFileSync(SESSION_FILE);
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  }

  // Borrar la sesión (Logout)
  clearSession(): void {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  }
}

export const sessionService = new SessionService();