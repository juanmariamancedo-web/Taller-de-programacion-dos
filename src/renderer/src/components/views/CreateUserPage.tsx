import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setCurrentTab, setUserToEdit } from '../../store/slices/appSlice'
import UserSuccess from '../UserSucces'
import { Prisma } from '../../../../main/infrastructure/db/generated/client/client'

export default function UserForm() {
  const dispatch = useAppDispatch()

  // Obtener el usuario a editar desde Redux
  const userToEdit = useAppSelector((state) => state.app.userToEdit)

  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [roles, setRoles] = useState<Prisma.UserRoleGetPayload<{}>[]>([])

  const [formData, setFormData] = useState({
    username: '',
    roleId: 0,
    password: '',
    passwordRepeat: '',
    isActive: true,
  })

  const [errors, setErrors] = useState({
    username: '',
    roleId: '',
    password: '',
    passwordRepeat: '',
    isActive: '',
  })

  // Cargar lista de roles
  useEffect(() => {
    async function fetchRoles() {
      try {
        const response = await window.electronAPI?.getRoles()
        if (response?.data) {
          const fetchedRoles = Array.isArray(response.data) ? response.data : [response.data]
          setRoles(fetchedRoles)

          // Si es modo creación y hay roles, seleccionar el primero por defecto si no hay uno
          if (!userToEdit && fetchedRoles.length > 0 && formData.roleId === 0) {
            setFormData((prev) => ({ ...prev, roleId: Number(fetchedRoles[0].id) }))
          }
        }
      } catch (error) {
        console.error('Error al cargar los roles:', error)
      }
    }

    fetchRoles()
  }, [userToEdit])

  // Cargar datos del usuario si estamos en modo edición
  useEffect(() => {
    if (userToEdit) {
      setFormData({
        username: userToEdit.username || '',
        roleId: Number(userToEdit.roleId ?? userToEdit.role?.id ?? 0),
        password: '', // En edición se deja vacío salvo que se desee cambiar
        passwordRepeat: '',
        isActive: userToEdit.isActive ?? true,
      })
    } else {
      setFormData({
        username: '',
        roleId: roles.length > 0 ? Number(roles[0].id) : 0,
        password: '',
        passwordRepeat: '',
        isActive: true,
      })
    }
  }, [userToEdit, roles])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value

        setFormData((prev) => ({
            ...prev,
            [name]:
            name === 'roleId'
                ? Number(val)
                : name === 'username'
                ? val.toString().replace(/\s+/g, '') // Removemos todos los espacios en tiempo real
                : val,
        }))
    }

  function checkErrors(): boolean {
    const newErrors = {
      username: '',
      roleId: '',
      password: '',
      passwordRepeat: '',
      isActive: '',
    }

    let nuevosErrores = false

    // Validar nombre de usuario (mínimo 4 caracteres)
    if (formData.username.length < 4) {
      newErrors.username = 'El nombre de usuario debe tener como mínimo 4 caracteres'
      nuevosErrores = true
    }

    // Validación de Contraseña
    if (!userToEdit) {
      // En CREACIÓN: la contraseña es obligatoria
      if (formData.password.length < 6) {
        newErrors.password = 'La contraseña debe tener como mínimo 6 caracteres'
        nuevosErrores = true
      }
      if (formData.password !== formData.passwordRepeat) {
        newErrors.passwordRepeat = 'Las contraseñas no coinciden'
        nuevosErrores = true
      }
    } else {
      // En EDICIÓN: la contraseña es opcional, pero si la ingresan debe cumplir requisitos
      if (formData.password.length > 0) {
        if (formData.password.length < 6) {
          newErrors.password = 'La contraseña debe tener como mínimo 6 caracteres'
          nuevosErrores = true
        }
        if (formData.password !== formData.passwordRepeat) {
          newErrors.passwordRepeat = 'Las contraseñas no coinciden'
          nuevosErrores = true
        }
      }
    }

    // Validar selección de Rol
    if (!formData.roleId || formData.roleId <= 0) {
      newErrors.roleId = 'Seleccioná un rol válido'
      nuevosErrores = true
    }

    if (nuevosErrores) {
      setErrors(newErrors)
    } else {
      setErrors({ username: '', roleId: '', password: '', passwordRepeat: '', isActive: '' })
    }

    return !nuevosErrores
  }
  

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError('')

    const isValid = checkErrors()
    if (!isValid) return

    try {
      let response: any

      if (userToEdit?.id) {
        // --- MODO ACTUALIZACIÓN ---
        const payload: any = {
          id: Number(userToEdit.id),
          username: formData.username,
          roleId: formData.roleId,
          isActive: formData.isActive,
        }

        // Solo adjuntar contraseña si fue modificada
        if (formData.password.trim().length > 0) {
          payload.password = formData.password
        }

        response = await window.electronAPI?.updateUser?.(payload)
      } else {
        // --- MODO CREACIÓN ---
        response = await window.electronAPI?.createUser?.({
          username: formData.username,
          roleId: formData.roleId,
          password: formData.password,
          isActive: formData.isActive,
        })
      }

      if (!response?.success) {
        setSaveError(response?.error ?? response?.message ?? 'No se pudo guardar la información del usuario.')
        return
      }

      setSuccess(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Error de comunicación con Electron.')
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

  function onReset() {
    dispatch(setUserToEdit(null))
    setFormData({
      username: '',
      roleId: roles.length > 0 ? Number(roles[0].id) : 0,
      password: '',
      passwordRepeat: '',
      isActive: true,
    })
    setSuccess(false)
  }

  function onNavigateBack() {
    dispatch(setUserToEdit(null))
    dispatch(setCurrentTab('users'))
  }

  if (success) {
    return <UserSuccess onReset={onReset} username={formData.username} onNavigateBack={onNavigateBack} />
  }

  return (
    <div className="mx-auto max-w-4xl p-6 w-full">
      {/* Encabezado */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {userToEdit ? `Editar Usuario: ${userToEdit.username}` : 'Nuevo Usuario'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {userToEdit
              ? 'Modificá los datos del usuario seleccionado.'
              : 'Ingresá los datos necesarios para registrar un nuevo usuario.'}
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

      {/* Formulario */}
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

          {/* Rol */}
          <div>
            <label htmlFor="roleId" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Rol
            </label>
            <select
              id="roleId"
              name="roleId"
              value={formData.roleId}
              onChange={handleChange}
              className={inputClass}
            >
              <option value={0} disabled>
                -- Seleccioná un rol --
              </option>
              {roles.map((rol) => (
                <option
                  key={String(rol.id)}
                  value={Number(rol.id)}
                  className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-white"
                >
                  {rol.name}
                </option>
              ))}
            </select>
            {errors.roleId && <p className="mt-1 text-xs text-red-500">{errors.roleId}</p>}
          </div>

          {/* Contraseña */}
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {userToEdit ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={userToEdit ? 'Dejar en blanco para no cambiar' : '••••••••'}
              className={inputClass}
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          {/* Repetir contraseña */}
          <div>
            <label htmlFor="passwordRepeat" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {userToEdit ? 'Repetir Nueva Contraseña' : 'Repetir Contraseña'}
            </label>
            <input
              id="passwordRepeat"
              name="passwordRepeat"
              type="password"
              value={formData.passwordRepeat}
              onChange={handleChange}
              placeholder={userToEdit ? 'Dejar en blanco para no cambiar' : '••••••••'}
              className={inputClass}
            />
            {errors.passwordRepeat && <p className="mt-1 text-xs text-red-500">{errors.passwordRepeat}</p>}
          </div>
        </div>

        {/* Checkbox Activo */}
        <div className="flex items-center gap-3 pt-2">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            checked={formData.isActive}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5"
          />
          <label htmlFor="isActive" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Usuario activo
          </label>
        </div>

        {saveError && <p className="text-sm text-red-500 font-medium">{saveError}</p>}

        {/* Botones de acción */}
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
            {userToEdit ? 'Actualizar Usuario' : 'Guardar Usuario'}
          </button>
        </div>
      </form>
    </div>
  )
}