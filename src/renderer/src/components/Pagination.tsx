import { setPage } from "../store/slices/appSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

interface Props {
    paginas: number;
}

export default function Paginacion({ paginas }: Props) {
    const pagina = useAppSelector((store) => store.app.page);
    const dispatch = useAppDispatch();

    if (paginas <= 1) return null;

    const btnStyles = "shadow-sm overflow-hidden hover:shadow-md transition rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white";

    return (
        <div className="flex justify-center items-center gap-3">
            
            {/* Primera página */}
            {pagina > 1 && (
                <button className={btnStyles} onClick={() => dispatch(setPage(1))}>
                    1
                </button>
            )}

            {/* Puntos suspensivos inicio */}
            {pagina > 3 && <span className="dark:text-white">...</span>}

            {/* Página anterior */}
            {pagina > 2 && (
                <button className={btnStyles} onClick={() => dispatch(setPage(pagina - 1))}>
                    {pagina - 1}
                </button>
            )}

            {/* Página actual activa */}
            <span className={`${btnStyles} font-bold px-3 py-1.5 rounded-xl`}>
                {pagina}
            </span>

            {/* Página siguiente */}
            {pagina < paginas - 1 && (
                <button className={btnStyles} onClick={() => dispatch(setPage(pagina + 1))}>
                    {pagina + 1}
                </button>
            )}

            {/* Puntos suspensivos fin */}
            {pagina < paginas - 2 && <span className="dark:text-white">...</span>}

            {/* Última página */}
            {pagina < paginas && (
                <button className={btnStyles} onClick={() => dispatch(setPage(paginas))}>
                    {paginas}
                </button>
            )}

        </div>
    );
}