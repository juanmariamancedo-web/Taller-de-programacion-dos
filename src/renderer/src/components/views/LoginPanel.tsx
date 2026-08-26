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

  // Mientras se consulta el IPC de Electron, mostrás un loader o nada
  if (loading) {
    return <div>Cargando...</div>;
  }

  // Si no hay sesión activa
  if (!session) {
    return (
      <>
        <h1>Login</h1>
      </>
    );
  }

  // Si no hay sesión, mostrás los hijos (children)
  return <>{children}</>;
}