import { setCurrentTab } from '../../store/slices/appSlice'
import { useAppDispatch } from '../../store/hooks'
import { useState } from 'react'

export default function CreateClientPage() {
  const dispatch = useAppDispatch()

  const [formData, setFormData] = useState({
    name: '',
    lastname: '',
    cuil_cuit: '',
    province: '',
    city: '',
    postcode: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Aquí conectaremos más adelante con Prisma / IPC de Electron
    console.log('Datos del nuevo cliente:', formData)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 w-full">
      {/* Encabezado y botón para volver */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Agregar Nuevo Cliente
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ingresa los datos correspondientes para registrar al cliente en el sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={() => dispatch(setCurrentTab('clients'))}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-lg transition"
        >
          ← Volver
        </button>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl p-6 shadow-sm space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej. Juan"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Apellido */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Apellido
            </label>
            <input
              type="text"
              name="lastname"
              value={formData.lastname}
              onChange={handleChange}
              placeholder="Ej. Pérez"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* CUIT / CUIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              CUIT / CUIL
            </label>
            <input
              type="text"
              name="cuil_cuit"
              value={formData.cuil_cuit}
              onChange={handleChange}
              placeholder="20-12345678-9"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Código Postal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Código Postal
            </label>
            <input
              type="text"
              name="postcode"
              value={formData.postcode}
              onChange={handleChange}
              placeholder="Ej. 3400"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Provincia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provincia
            </label>
            <input
              type="text"
              name="province"
              value={formData.province}
              onChange={handleChange}
              placeholder="Ej. Corrientes"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Ciudad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ciudad
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="Ej. Corrientes"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => dispatch(setCurrentTab('clients'))}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            Guardar cliente
          </button>
        </div>
      </form>
    </div>
  )
}