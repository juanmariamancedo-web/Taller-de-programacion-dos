import { useState, useEffect, JSX } from "react"
import { useAppDispatch } from "../../store/hooks"
import { setSearch, setSort } from "../../store/slices/appSlice"

export default function SwitchOpen({children, setOpen}: {children: JSX.Element, setOpen: React.Dispatch<React.SetStateAction<boolean>>}){
    const dispatch = useAppDispatch()

    useEffect(()=>{
        const mql = window.matchMedia("(min-width: 1024px)")

        function listenner(x:any){
            x.matches? setSmall(false) : setSmall(true)
        }

        listenner(mql)

        mql.onchange = listenner
    }, [])

    const [small, setSmall] = useState(false)

    return (
    <div onClick={()=>{
        if(small) setOpen(false)
        dispatch(setSearch(""))
        dispatch(setSort("idDesc"))
    }}>
        {children}
    </div>)
}