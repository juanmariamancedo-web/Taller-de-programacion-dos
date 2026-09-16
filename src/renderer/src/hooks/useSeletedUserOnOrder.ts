import { useState, useEffect } from "react";
import { ClientListItem } from "../../../main/domain/types/electron-env";

export default function useSeletedUserOnOrder(){
    const [clients, setClients] = useState<ClientListItem[]>([])
    const [searchTermClients, setSearchTermClients] = useState("")
    const [isOpenClients, setIsOpenClients] = useState(false)


    // Fetch de Clientes
    useEffect(() => {
        async function fetchClients() {
        try {
            const response = await window.electronAPI?.getClients({
            page: 1,
            search: searchTermClients,
            sort: "nameDesc"
            })
            if (response?.success) {
            setClients(response.data ?? [])
            }
        } catch (error) {
            console.error('Error al cargar los clientes:', error)
        }
        }

        fetchClients()
    }, [searchTermClients])
    
    return ({
        clients, 
        setClients, 
        searchTermClients, 
        setSearchTermClients, 
        isOpenClients, 
        setIsOpenClients
    })    
}