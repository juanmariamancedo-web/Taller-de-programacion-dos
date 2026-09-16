import { useState, useEffect } from "react";
import { AddressWithCityAndClient } from "../../../main/domain/types/electron-env";

export function useSeletedAddressOnOrder(formData: {
        clientId: number;
        shippingAddressId: number;
    }
){
      const [addresses, setAddresses] = useState<AddressWithCityAndClient[]>([])
      const [searchTermAddress, setSearchTermAddress] = useState("")
      const [isOpenAddress, setIsOpenAddress] = useState(false)

    // Fetch de Direcciones del cliente seleccionado
    useEffect(() => {
    if (!formData.clientId) {
        setAddresses([])
        return
    }

    async function fetchAddresses() {
        try {
            // Si la dirección ya está seleccionada y coincide con el input, enviamos search vacío
            const response = await window.electronAPI?.getAddresses(formData.clientId, {
                page: 1,
                search: searchTermAddress, 
                sort: "nameDesc"
            })

            if (response?.success) {
                setAddresses(response.data ?? [])
            }
        } catch (error) {
            console.error('Error al cargar las direcciones:', error)
        }
    }

    fetchAddresses()
    }, [searchTermAddress, formData.clientId])

    return {
        addresses, 
        setAddresses,
        searchTermAddress,
        setSearchTermAddress,
        isOpenAddress,
        setIsOpenAddress
    }
}