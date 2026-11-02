import { app, dialog } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { authService } from './auth.service'

function isAdmin(session: { roleId: number; roleName: string } | null): boolean {
  return Boolean(session && (session.roleId === 1 || session.roleName.toLowerCase() === 'admin'))
}

function getDatabaseConfig(): { container: string; user: string; database: string } {
  const connectionString = process.env.DATABASE_URL
  let urlUser = 'admin'
  let urlDatabase = 'taller_db'
  if (connectionString) {
    try {
      const url = new URL(connectionString)
      urlUser = decodeURIComponent(url.username || urlUser)
      urlDatabase = url.pathname.replace(/^\//, '') || urlDatabase
    } catch {
      // Usar los valores predeterminados si DATABASE_URL no es una URL válida.
    }
  }
  return {
    container: process.env.DB_CONTAINER_NAME || 'taller_postgres',
    user: process.env.DB_USER || urlUser,
    database: process.env.DB_NAME || urlDatabase
  }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, windowsHide: true })
    let stderr = ''
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `${command} terminó con código ${code}`)))
  })
}

function runCapture(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, windowsHide: true })
    const chunks: Buffer[] = []
    let stderr = ''
    child.stdout?.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(stderr.trim() || `${command} terminó con código ${code}`)))
  })
}

function runWithInput(command: string, args: string[], env: NodeJS.ProcessEnv, input: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, windowsHide: true })
    let stderr = ''
    child.stdin?.end(input)
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `${command} terminó con código ${code}`)))
  })
}

function prepareRestoreInput(sourcePath: string): Buffer {
  const resetDatabase = [
    'DROP SCHEMA IF EXISTS public CASCADE;',
    'CREATE SCHEMA public;',
    'GRANT ALL ON SCHEMA public TO PUBLIC;',
    ''
  ].join('\n')

  return Buffer.concat([
    Buffer.from(resetDatabase, 'utf8'),
    fs.readFileSync(sourcePath)
  ])
}

export class BackupService {
  private databaseEnv(): NodeJS.ProcessEnv {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL no está configurada.')
    const url = new URL(connectionString)
    return {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGDATABASE: url.pathname.replace(/^\//, ''),
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password)
    }
  }

  private async assertAdmin(): Promise<void> {
    const session = await authService.getActiveSession()
    if (!isAdmin(session)) throw new Error('Acceso denegado: se requiere rol Administrador.')
  }

  async generate(): Promise<{ path: string; fileName: string }> {
    await this.assertAdmin()
    const backupDir = path.join(app.getPath('temp'), 'taller-backups')
    fs.mkdirSync(backupDir, { recursive: true })

    const now = new Date()
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 15)
    const { container, user, database } = getDatabaseConfig()
    const safeDatabase = database.replace(/[^a-zA-Z0-9_-]/g, '_') || 'taller_db'
    const fileName = `backup-${safeDatabase}-${timestamp}.sql`
    const filePath = path.join(backupDir, fileName)

    let dockerError: unknown
    try {
      const dump = await runCapture(
        'docker',
        ['exec', container, 'pg_dump', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--format=plain', '-U', user, database],
        process.env
      )
      fs.writeFileSync(filePath, dump)
    } catch (nativeDockerError) {
      dockerError = nativeDockerError
      try {
        const dump = await runCapture(
          'wsl.exe',
          ['--exec', 'docker', 'exec', container, 'pg_dump', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--format=plain', '-U', user, database],
          process.env
        )
        fs.writeFileSync(filePath, dump)
      } catch (wslDockerError) {
        dockerError = wslDockerError
        try {
          await run('pg_dump', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--file', filePath, '--format', 'plain', '-U', user, '-d', database], this.databaseEnv())
        } catch (hostError) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
          const detail = hostError instanceof Error ? hostError.message : String(hostError)
          const dockerDetail = dockerError instanceof Error ? dockerError.message : String(dockerError)
          throw new Error(`No fue posible generar el backup. Docker/WSL: ${dockerDetail}. Cliente local: ${detail}`)
        }
      }
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      throw new Error('El respaldo generado está vacío o no pudo crearse.')
    }
    return { path: filePath, fileName }
  }

  async saveAs(sourcePath: string): Promise<void> {
    await this.assertAdmin()
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('El archivo de backup no existe.')

    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar backup de base de datos',
        defaultPath: path.basename(sourcePath),
        filters: [{ name: 'SQL dump', extensions: ['sql'] }]
      })
      if (canceled || !filePath) {
        if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath)
        return
      }
      fs.copyFileSync(sourcePath, filePath)
    } catch (error) {
      throw error instanceof Error ? error : new Error('No se pudo guardar el backup descargado.')
    } finally {
      if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath)
    }
  }

  async chooseFile(): Promise<string | null> {
    await this.assertAdmin()
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Seleccionar archivo de respaldo',
      properties: ['openFile'],
      filters: [{ name: 'SQL dump', extensions: ['sql', 'dump'] }, { name: 'Todos los archivos', extensions: ['*'] }]
    })
    return canceled ? null : filePaths[0] ?? null
  }

  async restore(sourcePath: string): Promise<void> {
    await this.assertAdmin()
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('El archivo de respaldo no existe.')

    const restoreInput = prepareRestoreInput(sourcePath)

    try {
      await runWithInput('psql', ['--set', 'ON_ERROR_STOP=1'], this.databaseEnv(), restoreInput)
    } catch (hostError) {
      const { container, user, database } = getDatabaseConfig()
      try {
        await runWithInput('docker', ['exec', '-i', container, 'psql', '--set', 'ON_ERROR_STOP=1', '--username', user, '--dbname', database], process.env, restoreInput)
      } catch (nativeDockerError) {
        try {
          await runWithInput('wsl.exe', ['--exec', 'docker', 'exec', '-i', container, 'psql', '--set', 'ON_ERROR_STOP=1', '--username', user, '--dbname', database], process.env, restoreInput)
        } catch (dockerError) {
          const detail = dockerError instanceof Error ? dockerError.message : String(dockerError)
          const nativeDetail = nativeDockerError instanceof Error ? nativeDockerError.message : String(nativeDockerError)
          const hostDetail = hostError instanceof Error ? hostError.message : String(hostError)
          throw new Error(`No fue posible restaurar el backup. Cliente local: ${hostDetail}. Docker Windows: ${nativeDetail}. Docker/WSL: ${detail}.`)
        }
      }
    }
  }
}

export const backupService = new BackupService()
