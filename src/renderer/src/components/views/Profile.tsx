import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setCurrentTab, setSession } from '../../store/slices/appSlice'
import UserSuccess from '../UserSucces'
import { Prisma } from '../../../../main/infrastructure/db/generated/client/client'

export default function Profile() {
  const session = useAppSelector((state) => state.app.session)
  const dispatch = useAppDispatch()

  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [roles, setRoles] = useState<Prisma.UserRoleGetPayload<{}>[]>([])

  const [formData, setFormData] = useState({
    username: session?.username || '',
    roleId: session?.roleId || 0,
    prevPassword: '',
    password: '',
    passwordRepeat: '',
  })

  const [errors, setErrors] = useState({
    username: '',
    prevPassword: '',
    password: '',
    passwordRepeat: '',
  })

  // Sincronizar estado local si la sesión cambia
  useEffect(() => {
    if (session) {
      setFormData((prev) => ({
        ...prev,
        username: session.username,
        roleId: session.roleId,
      }))
    }
  }, [session])

  useEffect(() => {
    async function fetchRoles() {
      try {
        const response = await window.electronAPI?.getRoles()
        if (response?.data) {
          setRoles(Array.isArray(response.data) ? response.data : [response.data])
        }
      } catch (error) {
        console.error('Error al cargar los roles:', error)
      }
    }

    fetchRoles()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'username' ? value.replace(/\s+/g, '') : value,
    }))
  }

  function checkErrors(): boolean {
    const newErrors = {
      username: '',
      prevPassword: '',
      password: '',
      passwordRepeat: '',
    }

    let hayErrores = false

    if (/\s/.test(formData.username)) {
      newErrors.username = 'El nombre de usuario no puede contener espacios'
      hayErrores = true
    } else if (formData.username.length < 4) {
      newErrors.username = 'El nombre de usuario debe tener como mínimo 4 caracteres'
      hayErrores = true
    }

    const isChangingPassword = formData.password.length > 0 || formData.passwordRepeat.length > 0

    if (isChangingPassword) {
      if (!formData.prevPassword) {
        newErrors.prevPassword = 'Ingresá tu contraseña actual para confirmar el cambio'
        hayErrores = true
      }
      if (formData.password.length < 6) {
        newErrors.password = 'La nueva contraseña debe tener como mínimo 6 caracteres'
        hayErrores = true
      }
      if (formData.password !== formData.passwordRepeat) {
        newErrors.passwordRepeat = 'Las contraseñas no coinciden'
        hayErrores = true
      }
    }

    setErrors(newErrors)
    return !hayErrores
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError('')

    if (!checkErrors()) return
    if (!session?.id) {
      setSaveError('No se encontró una sesión activa válida.')
      return
    }

    try {
      // BigInt a String para evitar error de serialización IPC
      const userId = typeof session.id === 'bigint' ? String(session.id) : String(session.id)

      const payload: {
        userId: string
        username: string
        prevPassword?: string
        newPassword?: string
      } = {
        userId,
        username: formData.username,
      }

      if (formData.password.trim().length > 0) {
        payload.prevPassword = formData.prevPassword
        payload.newPassword = formData.password
      }

      const response = await window.electronAPI?.updateProfile?.(payload)

      if (!response?.success) {
        setSaveError(response?.message || 'No se pudo actualizar el perfil.')
        return
      }

      // Sincronizar el estado de Redux con el nuevo username
      dispatch(
        setSession({
          ...session,
          username: formData.username,
        })
      )

      setSuccess(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Error de comunicación con Electron.')
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

  function onReset() {
    setFormData({
      username: session?.username || '',
      roleId: session?.roleId || 0,
      prevPassword: '',
      password: '',
      passwordRepeat: '',
    })
    setSuccess(false)
  }

  function onNavigateBack() {
    dispatch(setCurrentTab('dashboard'))
  }

  if (success) {
    return <UserSuccess onReset={onReset} username={formData.username} onNavigateBack={onNavigateBack} />
  }

  return (
    <div className="mx-auto max-w-4xl p-6 w-full">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Perfil</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Modificá tus datos de usuario.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          onClick={onNavigateBack}
        >
          ← Volver
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-zinc-900"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Username */}
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nombre de Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              placeholder="Ej. juanmance"
              className={inputClass}
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
          </div>

          {/* Rol (Deshabilitado) */}
          <div>
            <label htmlFor="roleId" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Rol
            </label>
            <select
              id="roleId"
              name="roleId"
              value={formData.roleId}
              disabled
              className={`${inputClass} opacity-60 cursor-not-allowed`}
            >
              {roles.map((rol) => (
                <option key={String(rol.id)} value={Number(rol.id)}>
                  {rol.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cambio de Contraseña */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-white/10">
            <div className="col-span-1 md:col-span-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Cambiar contraseña (opcional)
              </h2>
            </div>

            <div>
              <label htmlFor="prevPassword" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Contraseña actual
              </label>
              <input
                id="prevPassword"
                name="prevPassword"
                type="password"
                value={formData.prevPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={inputClass}
              />
              {errors.prevPassword && <p className="mt-1 text-xs text-red-500">{errors.prevPassword}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nueva Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={inputClass}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            <div>
              <label htmlFor="passwordRepeat" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Repetir Nueva Contraseña
              </label>
              <input
                id="passwordRepeat"
                name="passwordRepeat"
                type="password"
                value={formData.passwordRepeat}
                onChange={handleChange}
                placeholder="••••••••"
                className={inputClass}
              />
              {errors.passwordRepeat && <p className="mt-1 text-xs text-red-500">{errors.passwordRepeat}</p>}
            </div>
          </div>
        </div>

        {saveError && <p className="text-sm text-red-500 font-medium">{saveError}</p>}

        <div className="flex justify-end gap-4 border-t border-slate-200 pt-4 dark:border-white/10">
          <button
            type="button"
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            onClick={onNavigateBack}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          >
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  )
}