// electron-env.d.ts
export type ThemeSource = "system" | "dark" | "light";
export type Theme = "dark" | "light";

export interface Credentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    isActive: boolean;
  };
  message?: string;
}

// Tipo explícito para la función de desuscripción
export type Unsubscribe = () => void;

export interface IElectronAPI {
  // Invokes (Promesas)
  setTheme: (theme: ThemeSource) => Promise<boolean>;
  getInitialTheme: () => Promise<Theme>;

  // Suscripción: recibe un callback y retorna la función de desuscripción
  onThemeChanged: (callback: (isDark: boolean) => void) => Unsubscribe;
  login: (credentials: Credentials) => Promise<AuthResponse>;
}

// Extensión global del objeto Window
declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}