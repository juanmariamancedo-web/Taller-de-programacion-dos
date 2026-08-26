import { ipcMain, nativeTheme } from 'electron';

export type ThemeSource = 'system' | 'light' | 'dark';

export function registerThemeIPC(): void {
  ipcMain.handle('theme:set', (_event, theme: ThemeSource) => {
    nativeTheme.themeSource = theme;
    return nativeTheme.shouldUseDarkColors;
  });

  ipcMain.handle('theme:get-initial', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  ipcMain.handle('theme:get-state', () => {
    return {
      isDark: nativeTheme.shouldUseDarkColors,
      themeSource: nativeTheme.themeSource
    };
  });
}