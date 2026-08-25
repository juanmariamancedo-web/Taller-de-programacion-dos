// electron-env.d.ts
export type ThemeSource = "system" | "dark" | "light";
export type Theme = "dark" | "light";

// Tipo explícito para la función de desuscripción
export type Unsubscribe = () => void;

export interface IElectronAPI {
  // Invokes (Promesas)
  setTheme: (theme: ThemeSource) => Promise<boolean>;
  getInitialTheme: () => Promise<Theme>;

  // Suscripción: recibe un callback y retorna la función de desuscripción
  onThemeChanged: (callback: (isDark: boolean) => void) => Unsubscribe;
}

// Extensión global del objeto Window
declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}