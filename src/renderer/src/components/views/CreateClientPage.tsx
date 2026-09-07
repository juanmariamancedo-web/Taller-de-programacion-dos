import { setCurrentTab } from '../../store/slices/appSlice'
import { useAppDispatch } from '../../store/hooks'
import { useEffect, useState } from 'react'

type FormData = {
  name: string
  lastname: string
  cuil_cuit: string
  province: string
  city: string
  postcode: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

const lettersPattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '\-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/
// Agregamos \d para remover cualquier dígito inmediatamente en el onChange
const invalidTextCharactersPattern = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ '\-]|[\d]/g

function isValidCuil(value: string): boolean {
  if (!/^\d{11}$/.test(value) || !/^(20|23|24|27|30|33|34)/.test(value)) return false

  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const total = multipliers.reduce((sum, multiplier, index) => sum + Number(value[index]) * multiplier, 0)
  const remainder = 11 - (total % 11)
  const checkDigit = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder

  return checkDigit === Number(value[10])
}

function validateForm(data: FormData, provinceNames: string[]): FormErrors {
  const errors: FormErrors = {}
  const textFields: Array<keyof Pick<FormData, 'name' | 'lastname' | 'province' | 'city'>> = [
    'name',
    'lastname',
    'province',
    'city',
  ]

  textFields.forEach((field) => {
    const value = data[field].trim()
    if (value.length < 2 || value.length > 50 || !lettersPattern.test(value)) {
      errors[field] = 'Usa entre 2 y 50 letras, espacios o guiones.'
    }
  })

  if (!provinceNames.includes(data.province)) {
    errors.province = 'Seleccioná una provincia de la lista.'
  }

  if (!isValidCuil(data.cuil_cuit)) errors.cuil_cuit = 'Debe tener 11 dígitos y un CUIT/CUIL válido.'
  if (!/^\d{4,8}$/.test(data.postcode)) errors.postcode = 'Usa entre 4 y 8 números.'

  return errors
}

function FieldStatus({ error, valid, offset }: { error?: string; valid: boolean; offset?: boolean }) {
  if (!error && !valid) return null

  const positionClass = offset ? 'right-10' : 'right-3'

  return error ? (
    <span className={`pointer-events-none absolute ${positionClass} top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300`}>
      <span className="text-xs font-bold">!</span>
    </span>
  ) : (
    <span className={`pointer-events-none absolute ${positionClass} top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300`}>
      <span className="text-xs font-bold">✓</span>
    </span>
  )
}

export default function CreateClientPage() {
  const dispatch = useAppDispatch()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    lastname: '',
    cuil_cuit: '',
    province: '',
    city: '',
    postcode: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [provinces, setProvinces] = useState<Array<{ id: string; name: string }>>([])
  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [provinceLoadError, setProvinceLoadError] = useState<string | null>(null)

  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const data = await window.electronAPI?.getProvinces()
        if (!data) throw new Error('No se pudo acceder al servicio de provincias.')
        setProvinces(data)
      } catch (error) {
        console.error('Error al cargar provincias:', error)
        setProvinceLoadError('No se pudieron cargar las provincias.')
      } finally {
        setLoadingProvinces(false)
      }
    }

    loadProvinces()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const nextValue =
      name === 'cuil_cuit' || name === 'postcode'
        ? value.replace(/\D/g, '')
        : name === 'name' || name === 'lastname' || name === 'city'
          ? value.replace(invalidTextCharactersPattern, '')
          : value
    setFormData((prev) => ({ ...prev, [name]: nextValue }))

    if (hasSubmitted) {
      setErrors(validateForm({ ...formData, [name]: nextValue }, provinces.map((province) => province.name)))
    }
  }

  const blockNumbers = (e: React.KeyboardEvent<HTMLInputElement>) => {
  // Previene números de la fila superior y del teclado numérico
  if (/^\d$/.test(e.key)) {
    e.preventDefault()
  }
}

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateForm(formData, provinces.map((province) => province.name))
    setHasSubmitted(true)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) return

    // Aquí conectaremos más adelante con Prisma / IPC de Electron
    console.log('Datos del nuevo cliente:', formData)
  }

  const hasValue = (field: keyof FormData) => formData[field].trim().length > 0
  const inputClass = (field: keyof FormData) => {
    const stateClass = errors[field]
      ? 'border-rose-400 bg-rose-50/60 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-400/70 dark:bg-rose-500/10'
      : hasSubmitted && hasValue(field)
        ? 'border-emerald-400 bg-emerald-50/50 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-emerald-400/70 dark:bg-emerald-500/10'
        : 'border-slate-200 bg-slate-50/70 focus:border-blue-500 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04]'

    return `w-full rounded-xl border px-4 py-3 pr-10 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:text-white ${stateClass}`
  }

  const fieldMessage = (field: keyof FormData) => errors[field] || (hasSubmitted && hasValue(field) ? 'Campo válido' : '')

  return (
    <div className="max-w-4xl mx-auto p-6 w-full">
      {/* Encabezado y botón para volver */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Agregar Nuevo Cliente
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ingresa los datos correspondientes para registrar al cliente en el sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={() => dispatch(setCurrentTab('clients'))}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          ← Volver
        </button>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-zinc-900"
      >
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">i</span>
          <p>Completá los datos con información real. Los campos numéricos aceptan únicamente dígitos.</p>
        </div>

        {hasSubmitted && Object.keys(errors).length > 0 && (
          <div role="alert" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">!</span>
            <p>Revisá los campos marcados antes de guardar el cliente.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nombre
            </label>
            <div className="relative">
              <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              onKeyDown={blockNumbers}
              placeholder="Ej. Juan"
              required
              className={inputClass('name')}
              aria-invalid={Boolean(errors.name)}
              />
              <FieldStatus error={errors.name} valid={hasSubmitted && hasValue('name')} />
            </div>
            <p className={`mt-1.5 text-xs ${errors.name ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{fieldMessage('name')}</p>
          </div>

          {/* Apellido */}
          <div>
            <label htmlFor="lastname" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Apellido
            </label>
            <div className="relative">
              <input
              id="lastname"
              type="text"
              name="lastname"
              value={formData.lastname}
              onChange={handleChange}
              onKeyDown={blockNumbers}
              placeholder="Ej. Pérez"
              required
              className={inputClass('lastname')}
              aria-invalid={Boolean(errors.lastname)}
              />
              <FieldStatus error={errors.lastname} valid={hasSubmitted && hasValue('lastname')} />
            </div>
            <p className={`mt-1.5 text-xs ${errors.lastname ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{fieldMessage('lastname')}</p>
          </div>

          {/* CUIT / CUIL */}
          <div>
            <label htmlFor="cuil_cuit" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              CUIT / CUIL
            </label>
            <div className="relative">
              <input
              id="cuil_cuit"
              type="text"
              name="cuil_cuit"
              value={formData.cuil_cuit}
              onChange={handleChange}
              placeholder="20123456789"
              required
              inputMode="numeric"
              maxLength={11}
              className={inputClass('cuil_cuit')}
              aria-invalid={Boolean(errors.cuil_cuit)}
              />
              <FieldStatus error={errors.cuil_cuit} valid={hasSubmitted && hasValue('cuil_cuit')} />
            </div>
            <p className={`mt-1.5 text-xs ${errors.cuil_cuit ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{fieldMessage('cuil_cuit')}</p>
          </div>

          {/* Código Postal */}
          <div>
            <label htmlFor="postcode" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Código Postal
            </label>
            <div className="relative">
              <input
              id="postcode"
              type="text"
              name="postcode"
              value={formData.postcode}
              onChange={handleChange}
              placeholder="Ej. 3400"
              required
              inputMode="numeric"
              maxLength={8}
              className={inputClass('postcode')}
              aria-invalid={Boolean(errors.postcode)}
              />
              <FieldStatus error={errors.postcode} valid={hasSubmitted && hasValue('postcode')} />
            </div>
            <p className={`mt-1.5 text-xs ${errors.postcode ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{fieldMessage('postcode')}</p>
          </div>

          {/* Provincia */}
          <div>
            <label htmlFor="province" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Provincia
            </label>
            <div className="relative">
              <select
                id="province"
                name="province"
                value={formData.province}
                onChange={handleChange}
                required
                disabled={loadingProvinces || Boolean(provinceLoadError)}
                className={`${inputClass('province')} appearance-none cursor-pointer`}
                aria-invalid={Boolean(errors.province)}
              >
                <option value="" disabled>
                  {loadingProvinces ? 'Cargando provincias...' : 'Seleccioná una provincia'}
                </option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.name}>
                    {province.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
                ▾
              </span>
              <FieldStatus error={errors.province} valid={hasSubmitted && hasValue('province')} offset />
            </div>
            {provinceLoadError && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-300">{provinceLoadError}</p>}
            <p className={`mt-1.5 text-xs ${errors.province ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{fieldMessage('province')}</p>
          </div>

          {/* Ciudad */}
          <div>
            <label htmlFor="city" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Ciudad
            </label>
            <div className="relative">
              <input
              id="city"
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              onKeyDown={blockNumbers}
              placeholder="Ej. Corrientes"
              required
              className={inputClass('city')}
              aria-invalid={Boolean(errors.city)}
              />
              <FieldStatus error={errors.city} valid={hasSubmitted && hasValue('city')} />
            </div>
            <p className={`mt-1.5 text-xs ${errors.city ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{fieldMessage('city')}</p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-4 border-t border-slate-200 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={() => dispatch(setCurrentTab('clients'))}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          >
            Guardar cliente
          </button>
        </div>
      </form>
    </div>
  )
}