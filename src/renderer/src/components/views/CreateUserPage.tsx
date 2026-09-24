import { useEffect, useState } from 'react'
import { useAppDispatch } from '../../store/hooks'
import { setCurrentTab } from '../../store/slices/appSlice'
import UserSuccess from '../UserSucces'
import { Prisma } from '../../../../main/infrastructure/db/generated/client/client'

export default function UserForm() {
    const [success, setSuccess] = useState(false)
    const dispatch = useAppDispatch()

    const [formData, setFormData] = useState({
        username: '',
        roleId: 0,
        password: '',
        passwordRepeat: '',
        isActive: true
    })

    const [errors, setErrors] = useState({
        username: '',
        roleId: '',
        password: '',
        passwordRepeat: '',
        isActive: ''
    })
    const [saveError, setSaveError] = useState('')

    const [roles, setRoles] = useState<Prisma.UserRoleGetPayload<{}>[]>([])

    useEffect(() => {
        async function fetchRoles() {
            try {
                const response = await window.electronAPI?.getRoles()
                if (response?.data) {
                    setRoles(Array.isArray(response.data) ? response.data : [response.data]);
                }
            } catch (error) {
                console.error('Error al cargar los roles:', error)
            }
        }

        fetchRoles()
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value

        setFormData((prev) => ({
        ...prev,
        [name]: name === 'roleId' ? Number(val) : name === 'username' ? val.toString().trim() : val
        }))
    }

    function checkErrors(): boolean {
        const newErrors = {
        username: '',
        roleId: '',
        password: '',
        passwordRepeat: '',
        isActive: ''
        }

        let nuevosErrores = false;

        // Validar nombre de usuario (mínimo 6 caracteres)
        if (formData.username.length < 6) {
        newErrors.username = 'El nombre de usuario debe tener como mínimo 6 caracteres'
        nuevosErrores = true
        }

        // Validar contraseña (mínimo 6 caracteres)
        if (formData.password.length < 6) {
        newErrors.password = 'La contraseña debe tener como mínimo 6 caracteres'
        nuevosErrores = true
        }

        // Validar coincidencia de contraseñas
        if (formData.password !== formData.passwordRepeat) {
        newErrors.passwordRepeat = 'Las contraseñas no coinciden'
        nuevosErrores = true
        }

        if (!formData.roleId) {
        newErrors.roleId = 'Seleccioná un rol'
        nuevosErrores = true
        }

        if(nuevosErrores){
            setErrors(newErrors)
        }

        // Devuelve true si NO hay errores
        return !Object.values(newErrors).some((err) => err !== '')
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSaveError('')

        const isValid = checkErrors()
        if (isValid) {
            try {
                const response = await window.electronAPI?.createUser({
                    username: formData.username,
                    roleId: formData.roleId,
                    password: formData.password,
                    isActive: formData.isActive
                })

                if (!response?.success) {
                    setSaveError(response?.error ?? 'No se pudo crear el usuario.')
                    return
                }

                setSuccess(true)
            } catch (error) {
                setSaveError(error instanceof Error ? error.message : 'Error de comunicación con Electron.')
            }
        }
    }

    const inputClass =
        'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

    function onReset(){
        setFormData({
            username: '',
            roleId: 0,
            password: '',
            passwordRepeat: '',
            isActive: true
        })

        setSuccess(false)
    }

    function onNavigateBack(){
        dispatch(setCurrentTab("users"))
    }

    if(success){
        return <UserSuccess onReset={onReset} username={formData.username} onNavigateBack={onNavigateBack} />
    }

    return (
        <div className="mx-auto max-w-4xl p-6 w-full">
            {/* Encabezado */}
            <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Usuario</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Ingresá los datos necesarios para registrar o modificar el usuario.
                    </p>
                </div>
                <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                    onClick={() => dispatch(setCurrentTab('users'))}
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
                        {roles.length > 0 &&
                            roles.map((rol) => (
                                <option
                                    key={String(rol.id)}
                                    value={Number(rol.id)}
                                    className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-white"
                                >
                                    {rol.name}
                                </option>
                            ))
                        }
                    </select>
                    {errors.roleId && <p className="mt-1 text-xs text-red-500">{errors.roleId}</p>}
                </div>

                {/* Contraseña */}
                <div>
                    <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Contraseña
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

                {/* Repetir contraseña */}
                <div>
                    <label htmlFor="passwordRepeat" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Repetir Contraseña
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

                {saveError && <p className="text-sm text-red-500">{saveError}</p>}

                {/* Botones */}
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
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    )
}