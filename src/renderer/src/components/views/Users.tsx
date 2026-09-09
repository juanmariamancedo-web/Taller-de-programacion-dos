import Search from "../Search"
import Paginacion from "../Pagination"
import { Sort } from "../Sort"
import { useEffect, useState } from "react";
import { UserWithRole } from "../../../../main/domain/types/electron-env";

// model User {
//   id        BigInt    @id @default(autoincrement())
//   username  String    @unique
//   roleId    BigInt    @map("role_id")
//   role      UserRole  @relation(fields: [roleId], references: [id])
//   password  String
//   isActive  Boolean   @default(true) @map("is_active")
//   createdAt DateTime? @default(now()) @map("created_at")
//   updatedAt DateTime? @updatedAt @map("updated_at")
//   orders    Order[]

//   @@map("users")
// }

export default function(){
    const [users, setUsers] = useState<UserWithRole[]>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                const response = await window.electronAPI?.getUsers({ page: 1, sort: "", search: "" });
                
                if (response?.success && response.data) {
                    setUsers(response.data); // Envolver en array
                } else {
                    setError(response?.message || "");
                }
            } catch (err) {
                setError('Error de comunicación con Electron');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, []);

    return(
        <>
            <div className="flex flex-col items-center gap-3">
                <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-bold flex flex-row gap-x-4 pb-6 lg:pb-10">
                    Usuarios
                </h1>
                <Search />
                {error && <p className="text-rose-600 dark:text-rose-300">{error}</p>}
                {isLoading && <p className="text-gray-500">Cargando usuarios...</p>}
                <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                    <table className="w-full min-w-[640px] bg-black/5 dark:bg-white/5 text-sm text-gray-900 dark:text-white">

                        <thead className="bg-gray-100 dark:bg-white/10">
                            <tr className="text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                                <th className="px-4 py-3">
                                    <Sort   
                                        name="ID"
                                        serverArg="id"
                                        className=""
                                    />
                                </th>
                                <th className="px-4 py-3">
                                    <Sort   
                                        name="Username"
                                        serverArg="username"
                                        className=""
                                    />
                                </th>
                                <th className="px-4 py-3">
                                    <Sort 
                                        name="Activo"
                                        serverArg="activo"
                                        className=""
                                    />
                                </th>
                                <th className="px-4 py-3">
                                    <Sort 
                                        name="Rol"
                                        serverArg="role"
                                        className=""
                                    />
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-sm">
                            {users?.length ? (
                                users.map((user) => {   
                                    
                                    return (
                                                <tr
                                                key={user.id}
                                                className="hover:bg-gray-50 dark:hover:bg-white/5 transition"
                                                >
                                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                        {/* <Link href={`/ordenes/${order.id}`} className="font-bold"> */}
                                                            #{user.id}
                                                        {/* </Link> */}
                                                    </td>

                                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                                        {user.username}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                            user.isActive?
                                                                "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"
                                                        }`}>
                                                            {user.isActive? "Activo": "Inactivo"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                            user.role.name === "admin"
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : user.role.name === "supervisor"
                                                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                        }`}>
                                                            {user.role.name}
                                                        </span>
                                                    </td>
                                                </tr>
                                        )
                                    }
                                )
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-6 text-gray-500">
                                        No hay usuarios encontradas
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Paginacion paginas={5} />
            </ div>
        </>
    )
}