import { useState } from 'react'
import type { User } from '../../types/User'

export default function BannearUsuario({ user }: { user: User }) {
  const [banned, setBanned] = useState(user.is_banned)

  function toggleBan() {
    setBanned((prev) => !prev)
  }

  return (
    <>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            banned
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}
        >
          {banned ? 'Baneado' : 'Activo'}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={toggleBan}
          className={`px-3 py-1 text-xs font-semibold rounded-lg text-white transition ${
            banned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {banned ? 'Despenalizar' : 'Penalizar'}
        </button>
      </td>
    </>
  )
}
