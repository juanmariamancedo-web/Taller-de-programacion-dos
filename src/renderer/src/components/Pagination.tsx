import { Tab } from "@renderer/App";

interface Props {
    onSelectTab: React.Dispatch<React.SetStateAction<Tab>>,
}

export default function Paginacion({ paginas, pagina, dir,  }: { paginas: number, pagina : number, dir: string }) {
    return (
        <div className="flex justify-center items-center gap-3">
            
            {/* Primer pagina */}
            {pagina > 1 && 
                <Link 
                className="shadow-sm overflow-hidden hover:shadow-md transition grid-rows-subgrid rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white"
                href={`${dir}?page=1`} >
                    1
                </Link>
            }

            {pagina > 3 && <span>...</span>}

            {/* Ir a pagina anterior */}
            {pagina > 2 && 
                <Link 
                    className="shadow-sm overflow-hidden hover:shadow-md transition grid-rows-subgrid rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white"
                    href={`${dir}?page=${pagina - 1}`} 
                >
                    {pagina - 1}
                </Link>
            }

            <span>{pagina}</span>

            {/* Ir a siguiente pagina */}
            {pagina < paginas - 1 &&
                <Link 
                    className="shadow-sm overflow-hidden hover:shadow-md transition grid-rows-subgrid rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white"
                    href={`${dir}?page=${pagina + 1}`}   
                >
                    {pagina + 1}
                </Link>
            }
            
            {pagina < paginas - 2 && <span>...</span>}

            {/* Ultima pagina */}
            {pagina < paginas && 
                <Link 
                    className="shadow-sm overflow-hidden hover:shadow-md transition grid-rows-subgrid rounded-xl bg-black/5 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6 dark:bg-white/5 dark:text-white"
                    href={`${dir}?page=${paginas}`} >
                    {paginas}
                </Link>
            }

        </div>
    );
}