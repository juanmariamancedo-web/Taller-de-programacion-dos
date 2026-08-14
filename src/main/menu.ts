import { Menu, nativeTheme, BrowserWindow, MenuItemConstructorOptions } from 'electron'

export function setMainManu(mainWindow: BrowserWindow): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Alternar Modo Oscuro',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            // 1. Cambiamos la fuente del tema nativo
            const newTheme = nativeTheme.shouldUseDarkColors ? 'light' : 'dark'
            nativeTheme.themeSource = newTheme

            // 2. Enviamos el nuevo estado al proceso Renderer (React)
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors)
            }
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}