interface OrderSuccessProps {
  orderId?: string | number
  clientName?: string
  onReset: () => void
  onNavigateBack: () => void
}

export default function OrderSuccess({
  orderId,
  clientName,
  onReset,
  onNavigateBack
}: OrderSuccessProps) {
  return (
    <div className="mx-auto max-w-2xl p-6 w-full my-12">
      <div className="flex flex-col items-center justify-center text-center space-y-6 rounded-2xl border border-slate-200 bg-white p-10 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-zinc-900">
        
        {/* Ícono animado */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20 dark:bg-emerald-500"></span>
          <svg
            className="h-10 w-10 relative"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        {/* Textos */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            ¡Órden registrada con éxito!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
            {orderId && (
              <>
                Se generó la orden{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  #{orderId}
                </span>
              </>
            )}
            {clientName && (
              <>
                {' '}para el cliente{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {clientName}
                </span>
              </>
            )}
            . La orden se guardó correctamente en el sistema.
          </p>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 w-full sm:w-auto">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Cargar otra orden
          </button>
          <button
            type="button"
            onClick={onNavigateBack}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          >
            Volver a la lista de órdenes
          </button>
        </div>

      </div>
    </div>
  )
}