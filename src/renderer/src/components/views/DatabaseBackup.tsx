import { useState } from 'react'

export default function DatabaseBackup(): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [restorePath, setRestorePath] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)

  const generateAndDownload = async (): Promise<void> => {
    setLoading(true); setError(null); setMessage(null)
    const response = await window.electronAPI?.generateDatabaseBackup()
    if (!response?.success || !response.path) {
      setError(response?.message ?? 'No se pudo generar el backup.')
      setLoading(false)
      return
    }
    const downloadResponse = await window.electronAPI?.downloadDatabaseBackup(response.path)
    setLoading(false)
    if (downloadResponse?.success) setMessage(`Backup generado y descargado: ${response.fileName}`)
    else setError(downloadResponse?.message ?? 'El backup se generó, pero no pudo descargarse.')
  }

  const chooseFile = async (): Promise<void> => {
    const response = await window.electronAPI?.chooseBackupFile()
    if (response?.success && response.path) { setRestorePath(response.path); setError(null) }
    else setError(response?.message ?? 'No se pudo seleccionar el archivo.')
  }

  const restore = async (): Promise<void> => {
    if (!restorePath) return
    setConfirmRestore(false); setLoading(true); setError(null); setMessage(null)
    const response = await window.electronAPI?.restoreDatabaseBackup(restorePath)
    if (response?.success) setMessage('Base de datos restaurada correctamente.')
    else setError(response?.message ?? 'No se pudo restaurar la base de datos.')
    setLoading(false)
  }

  return <section className="flex w-full flex-col gap-6">
    <div><h1 className="text-3xl font-bold">Backup de base de datos</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Herramienta exclusiva para administradores.</p></div>
    {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"><h2 className="font-semibold">Generar backup</h2><p className="my-3 text-sm text-gray-500">Crea un dump SQL de PostgreSQL.</p><div className="flex gap-2"><button disabled={loading} onClick={() => void generateAndDownload()} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{loading ? 'Generando Backup...' : 'Descargar Backup Base de Datos'}</button></div></div>
      <div className="rounded-xl border border-gray-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"><h2 className="font-semibold">Restaurar backup</h2><p className="my-3 text-sm text-gray-500">Selecciona un archivo SQL válido.</p><button onClick={() => void chooseFile()} className="rounded-lg border px-4 py-2 font-semibold">Seleccionar archivo</button>{restorePath && <><p className="mt-3 break-all text-xs text-gray-500">{restorePath}</p><button disabled={loading} onClick={() => setConfirmRestore(true)} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-60">Restaurar base de datos</button></>}</div>
    </div>
    {confirmRestore && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900"><h2 className="text-xl font-bold text-rose-600">Confirmar restauración</h2><p className="mt-3 text-sm">Esta acción sobrescribirá los datos existentes. ¿Deseas continuar?</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmRestore(false)} className="rounded-lg border px-4 py-2">Cancelar</button><button onClick={() => void restore()} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Sí, restaurar</button></div></div></div>}
  </section>
}
