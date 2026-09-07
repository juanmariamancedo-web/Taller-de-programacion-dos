import { useState } from 'react'
import Paginacion from '../Pagination'
import CambiarRole from '../Admin/CambiarRol'
import BannearUsuario from '../Admin/BannerUsuario'
import Search from '../Search'
import { Sort } from '../Sort'
import type { User } from '../../types/User'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setCurrentTab } from "./../../store/slices/appSlice"

export default function ClientsPanel() {
  const dispatch = useAppDispatch()
  const session = useAppSelector((state) => state.app.session)
  const usuarios: User[] = []

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Encabezado */}
      <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 pb-6 lg:pb-8">
        <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-bold">
          Clientes
        </h1>
        
        <button
          onClick={() => dispatch(setCurrentTab('clients-create'))}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg transition shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Agregar cliente
        </button>
      </div>

      <div className="min-w-full">
        <Search />
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[640px] bg-black/5 dark:bg-white/5 text-sm text-gray-900 dark:text-white">
          <thead className="bg-gray-100 dark:bg-white/10">
            <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
              <th className="px-4 py-3">
                <Sort className="" serverArg="Id" name="ID" />
              </th>
              <th className="px-4 py-3">
                <Sort className="" serverArg="name" name="Nombre" />
              </th>
              <th className="px-4 py-3">
                <Sort className="" serverArg="cuil" name="Cuit/Cuil" />
              </th>
              <th className="px-4 py-3">
                <Sort className="" serverArg="province" name="Provincia" />
              </th>
              <th className="px-4 py-3">
                <Sort className="" serverArg="city" name="Ciudad" />
              </th>
              <th className="px-4 py-3">
                <Sort className="" serverArg="postcode" name="Código postal" />
              </th>
              <th className="px-4 py-3">
                <Sort className="" serverArg="role" name="Rol" />
              </th>
              <th className="px-4 py-3">Acción rol</th>
              <th className="px-4 py-3">
                <Sort className="" serverArg="banned" name="Estado" />
              </th>
              <th className="px-4 py-3">Acción</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-sm">
            {usuarios.length ? (
              usuarios.map((user) => {
                const isCurrentUser = session?.id === String(user.id)

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      #{user.id}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {`${user.name ?? 'Sin'} ${user.lastname ?? 'cliente'}`}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {user.cuil_cuit}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {user.province}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {user.city}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {user.postcode}
                    </td>

                    {isCurrentUser ? (
                      <>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {user.role}
                        </td>
                        <td className="px-4 py-3 text-gray-400 italic">N/A</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {user.is_banned ? 'Baneado' : 'Activo'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 italic">N/A</td>
                      </>
                    ) : (
                      <>
                        <CambiarRole user={user} />
                        <BannearUsuario user={user} />
                      </>
                    )}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={10} className="text-center py-6 text-gray-500">
                  No hay usuarios encontrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginacion paginas={1} />
    </div>
  )
}