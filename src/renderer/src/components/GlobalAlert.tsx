import { useAppSelector, useAppDispatch } from "../store/hooks"
import { setGlobalAlert } from "../store/slices/appSlice"

export default function GlobalAlert() {
  const dispatch = useAppDispatch()
  const alertMessage = useAppSelector((state) => state.app.globalAlert)

  if (!alertMessage) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aviso del Sistema</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">{alertMessage}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => dispatch(setGlobalAlert(null))}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}