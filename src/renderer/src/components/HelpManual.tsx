import { useEffect, useMemo, useState } from 'react'
import { useAppSelector } from '../store/hooks'
import { manualSections } from '../data/manual'
import { getRole } from '../../../main/domain/orderStateRules'

export default function HelpManual() {
  const session = useAppSelector((state) => state.app.session)
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string>('')

  const role = getRole(session?.roleId, session?.roleName)

  const sections = useMemo(
    () => manualSections.filter((s) => !s.roles || (role && s.roles.includes(role))),
    [role]
  )

  useEffect(() => {
    if (open && !activeId && sections.length) setActiveId(sections[0].id)
  }, [open, activeId, sections])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!session) return null

  const active = sections.find((s) => s.id === activeId) ?? sections[0]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Manual de usuario"
        aria-label="Abrir manual de usuario"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Manual de usuario"
            onClick={(e) => e.stopPropagation()}
            className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Manual de usuario</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar manual"
                className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 p-3 dark:border-white/10 sm:w-56 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      active?.id === s.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </nav>

              <div className="flex-1 overflow-y-auto p-6">
                {active && (
                  <>
                    <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">{active.title}</h3>
                    <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                      {active.content.map((line, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                            {i + 1}
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}