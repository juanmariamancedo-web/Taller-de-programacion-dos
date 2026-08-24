import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setSearch } from "../store/slices/appSlice";

export default function Search(){
    const search = useAppSelector((state)=>state.app.search)
    const [searchLocal, setSearchLocal] = useState<string>(search)
    
    const dispatch = useAppDispatch();

    function handleSubmit(e: React.FormEvent){
        e.preventDefault()

        dispatch(setSearch(searchLocal))
    }

    return(
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3 w-full">
            <input type="text" onChange={(e)=>setSearchLocal(e.target.value)} value={searchLocal} className="col-span-4 sm:col-span-3 rounded-md bg-black/5 px-3 py-1.5 text-gray-900 outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white" />
            <button type="submit" className="col-span-4 sm:col-span-1 rounded-md bg-black/5 px-3 py-1.5 text-gray-900 outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white">Buscar</button>
        </form>
    )
}