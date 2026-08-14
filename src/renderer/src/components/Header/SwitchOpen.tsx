import { useState, useEffect, JSX } from "react"

export default function SwitchOpen({children, setOpen}: {children: JSX.Element, setOpen: React.Dispatch<React.SetStateAction<boolean>>}){
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
    }}>
        {children}
    </div>)
}