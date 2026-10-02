import Search from "../Search"
import Paginacion from "../Pagination"
import { Sort } from "../Sort"
import { useEffect, useState } from "react";
import { UserListItem } from "../../../../main/domain/types/electron-env";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setCurrentTab, setUserToEdit } from "../../store/slices/appSlice";

export default function UsersPanel() {
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pages, setPages] = useState(1);
    
    const sort = useAppSelector((state) => state.app.sort);
    const search = useAppSelector((state) => state.app.search);
    const page = useAppSelector((state) => state.app.page);

    const dispatch = useAppDispatch();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await window.electronAPI?.getUsers({ page, sort, search });
                
                if (response?.success && response.data) {
                    setPages(response.totalPages ?? 1);
                    setUsers(response.data);
                } else {
                    setError(response?.message || "No se pudieron obtener los usuarios");
                }
            } catch (err) {
                setError('Error de comunicación con Electron');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [sort, search, page]);

    const handleCreateNew = () => {
        dispatch(setUserToEdit(null));
        dispatch(setCurrentTab('users-create'));
    };

    const handleEditUser = (user: UserListItem) => {
        dispatch(setUserToEdit(user));
        dispatch(setCurrentTab('users-create'));
    };

    return (
        <div className="flex flex-col items-center gap-3 w-full">
            <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 pb-6 lg:pb-8">
                <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-bold">
                    Usuarios
                </h1>
                <button
                    type="button"
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
                >
                    <span className="text-xl leading-none">+</span>
                    Agregar usuario
                </button>
            </div>

            <Search />

            {error && <p className="text-rose-600 dark:text-rose-300 font-medium py-2">{error}</p>}
            {isLoading && <p className="text-gray-500 py-4">Cargando usuarios...</p>}

            <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <table className="w-full min-w-[640px] bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white">
                    <thead className="bg-gray-100 dark:bg-white/10 border-b border-gray-200 dark:border-white/10">
                        <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                            <th className="px-4 py-3">
                                <Sort name="ID" serverArg="id" className="" />
                            </th>
                            <th className="px-4 py-3">
                                <Sort name="Username" serverArg="username" className="" />
                            </th>
                            <th className="px-4 py-3">
                                <Sort name="Activo" serverArg="active" className="" />
                            </th>
                            <th className="px-4 py-3">
                                <Sort name="Rol" serverArg="role" className="" />
                            </th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-sm">
                        {users.length > 0 ? (
                            users.map((user) => (
                                <tr
                                    key={String(user.id)}
                                    className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                >
                                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                                        #{String(user.id)}
                                    </td>

                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                                        {user.username}
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            user.isActive
                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"
                                        }`}>
                                            {user.isActive ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            user.role?.name === "admin"
                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                : user.role?.name === "supervisor"
                                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        }`}>
                                            {user.role?.name ?? 'Sin Rol'}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => handleEditUser(user)}
                                            title={`Editar usuario ${user.username}`}
                                            className="rounded-lg bg-blue-100 px-3 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300"
                                        >
                                            Editar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            !isLoading && (
                                <tr>
                                    <td colSpan={5} className="text-center py-6 text-gray-500">
                                        No se encontraron usuarios
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>

            <Paginacion paginas={pages} />
        </div>
    );
}