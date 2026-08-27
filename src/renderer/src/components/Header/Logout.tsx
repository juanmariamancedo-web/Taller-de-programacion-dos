import LogoutIcon from "../icons/LoginIcon";
import { useAppDispatch } from "../../store/hooks";
import { setSession } from "../../store/slices/appSlice";

export default function LoginOut() {
  const dispatch = useAppDispatch();

  async function onClick() {
    try {
      await window.electronAPI?.logout();
      // Limpia la sesión en Redux para re-renderizar la UI sin recargar
      dispatch(setSession(null));
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Cerrar sesión"
      aria-label="Cerrar sesión"
      className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition flex justify-center items-center cursor-pointer text-gray-700 dark:text-gray-200"
    >
      <LogoutIcon />
    </button>
  );
}