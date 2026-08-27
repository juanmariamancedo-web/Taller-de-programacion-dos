import { useState, useEffect } from 'react';

interface Props {
  children: React.ReactNode;
}

export default function LoginPanel({ children }: Props) {
  const [session, setSession] = useState<{
        id: bigint;
        username: string;
        isActive: boolean;
    } | null | undefined>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    const checkSession = async () => {
      try {
        const activeSession = await window.electronAPI?.getSession();
        console.log(activeSession);
        setSession(activeSession);
      } catch (error) {
        console.error('Error al obtener la sesión:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  function submit(){

  }

  // Mientras se consulta el IPC de Electron, mostrás un loader o nada
  if (loading) {
    return <div>Cargando...</div>;
  }

  // Si no hay sesión activa
  if (!session) {
    return (
        <div className='container'>
            <form onSubmit={submit} className="space-y-6">
                {/* Email */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Username
                    </label>

                    <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Username"
                        required
                        className="block w-full rounded-md bg-black/5 px-3 py-1.5 text-gray-900 outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white"
                    />

                    {/* {errors.email && (
                        <div className="text-red-500 text-sm">{errors.email}</div>
                    )} */}
                </div>

                {/* Password */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Contraseña
                        </label>

                        {/* <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-500">
                            ¿Olvidaste tu contraseña?
                        </Link> */}
                    </div>

                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        autoComplete="current-password"
                        className="block w-full rounded-md bg-black/5 px-3 py-1.5 text-gray-900 outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white"
                    />

                    {/* {errors.password && (
                        <div className="text-red-500 text-sm">{errors.password}</div>
                    )} */}
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    // disabled={processing}
                    className="w-full rounded-md bg-indigo-600 py-2 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
                >
                    {/* {processing ? 'Enviando...' : 'Ingresar'} */}
                    Ingresar
                </button>
            </form>
        </div>
    );
  }

  // Si no hay sesión, mostrás los hijos (children)
  return <>{children}</>;
}