import { useState, useEffect, FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSession } from '../../store/slices/appSlice';

interface Props {
  children: React.ReactNode;
}

export default function LoginPanel({ children }: Props) {
  const session = useAppSelector((state) => state.app.session);
  const dispatch = useAppDispatch();

  const [loading, setLoading] = useState<boolean>(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Helper para normalizar el id a string antes de mandar a Redux
  const handleSetSession = (activeSession: any) => {
    if (activeSession) {
      dispatch(
        setSession({
          ...activeSession,
          id: activeSession.id.toString(),
        })
      );
    } else {
      dispatch(setSession(null));
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const activeSession = await window.electronAPI?.getSession();
        handleSetSession(activeSession);
      } catch (error) {
        console.error('Error al obtener la sesión:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [dispatch]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);

    try {
      const res = await window.electronAPI?.login({ username, password });

      if (!res?.success) {
        setLoginError(res?.message || 'Usuario o contraseña incorrectos');
        return;
      }

      const activeSession = await window.electronAPI?.getSession();
      handleSetSession(activeSession);

    } catch (error) {
      console.error('Error imprevisto en IPC:', error);
      setLoginError('Error de conexión con el sistema.');
    }
  }

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <form onSubmit={submit} className="space-y-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              className="block w-full rounded-md bg-black/5 px-3 py-1.5 text-gray-900 outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete="current-password"
              className="block w-full rounded-md bg-black/5 px-3 py-1.5 text-gray-900 outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white"
            />
          </div>

          {loginError && <div className="text-red-500 text-sm">{loginError}</div>}

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 py-2 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            Ingresar
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}