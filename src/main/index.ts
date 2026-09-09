import { app, shell, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { setMainManu } from './menu'
import { registerThemeIPC } from './presentation/ipc/theme.ipc'
import { registerAuthIPC } from './presentation/ipc/auth.ipc'
import { registerOrderIPC } from './presentation/ipc/orders.ipc'
import { registerProvinceIPC } from './presentation/ipc/provinces.ipc'
import { registerUserIPC } from './presentation/ipc/users.ipc'
import { registerClientIPC } from './presentation/ipc/clients.ipc'
import { registerDashboardIPC } from './presentation/ipc/dashboard.ipc'

function createWindow(): BrowserWindow {
  const isDarkInitial = nativeTheme.shouldUseDarkColors

  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: isDarkInitial ? '#0f172a' : '#ffffff',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  const handleThemeUpdate = () => {
    if (!mainWindow.isDestroyed()) {
      const isDark = nativeTheme.shouldUseDarkColors

      mainWindow.webContents.send('theme-changed', isDark)

      if (process.platform === 'win32') {
        try {
          mainWindow.setTitleBarOverlay?.({
            color: isDark ? '#0f172a' : '#ffffff',
            symbolColor: isDark ? '#ffffff' : '#0f172a'
          })
        } catch {
          // Sin acción si la ventana usa el marco nativo estándar
        }
      }
    }
  }

  nativeTheme.on('updated', handleThemeUpdate)

  mainWindow.on('closed', () => {
    nativeTheme.removeListener('updated', handleThemeUpdate)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    handleThemeUpdate()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

registerThemeIPC()
registerAuthIPC()
registerOrderIPC()
registerProvinceIPC()
registerUserIPC()
registerClientIPC()
registerDashboardIPC()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()
  setMainManu(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createWindow()
      setMainManu(window)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})