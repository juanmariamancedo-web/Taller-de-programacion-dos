import { useAppDispatch, useAppSelector } from "../store/hooks"
import { setSort } from "../store/slices/appSlice"

interface Props {
    className: string,
    serverArg: string, 
    name: string
}

export function Sort({className, serverArg, name} : Props){
    const dispatch = useAppDispatch()
    const sort = useAppSelector((state) => state.app.sort)

    function toggleStock(){
        if(sort == `${serverArg}Asc`){
            dispatch(setSort(`${serverArg}Desc`))
        }else{
            dispatch(setSort(`${serverArg}Asc`))
        }
    }

    return(
        <button onClick={toggleStock} className={className}>
            {sort ==  `${serverArg}Desc` && <>↓ </>}
                {name}
            {sort ==  `${serverArg}Asc` && <> ↑</>}
        </button>
    )
}