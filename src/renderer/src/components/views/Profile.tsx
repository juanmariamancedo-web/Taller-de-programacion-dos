import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setCurrentTab } from '../../store/slices/appSlice'
import UserSuccess from '../UserSucces'
import { Prisma } from '../../../../main/infrastructure/db/generated/client/client'

export default function Profile() {
    const [success, setSuccess] = useState(false)
    const session = useAppSelector(state=> state.app.session)
    const dispatch = useAppDispatch()

    const [formData, setFormData] = useState({
        username: session?.username || "",
        roleId: session?.roleId,
        prevPassword: "",
        password: '',
        passwordRepeat: '',
        isActive: false
    })

    const [errors, setErrors] = useState({
        username: '',
        roleId: '',
        prevPassword: "",
        password: '',
        passwordRepeat: '',
        isActive: ''
    })

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
            prevPassword: "",
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

        if(nuevosErrores){
            setErrors(newErrors)
        }else{
            setSuccess(true)
        }

        // Devuelve true si NO hay errores
        return !Object.values(newErrors).some((err) => err !== '')
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const isValid = checkErrors()
        if (isValid) {
        // Proceder con el guardado
        }
    }

    const inputClass =
        'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

    function onReset(){
        setFormData({
            username: '',
            roleId: 0,
            prevPassword: "",
            password: '',
            passwordRepeat: '',
            isActive: false
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
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Perfil</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Modifica tu usuario.
                    </p>
                </div>
                <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                    onClick={() => dispatch(setCurrentTab("dashboard"))}
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
                        disabled
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
                </div>
                <div className='col-span-1 sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3'>
                        <div className='col-span-1 sm:col-span-3 flex items-center justify-start'>
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                Cambia contraseña
                            </h2>
                        </div>
                        {/* Contraseña anterior*/}
                        <div>
                            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Contraseña previa
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
                </div>

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