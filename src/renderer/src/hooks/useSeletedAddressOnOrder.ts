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
    let active = true
    if (!formData.clientId) {
        setAddresses([])
        return () => {
            active = false
        }
    }

    async function fetchAddresses() {
        setAddresses([])
        try {
            const fetchPage = (page: number) => window.electronAPI?.getAddresses(formData.clientId, {
                page,
                search: searchTermAddress,
                sort: "nameDesc"
            })
            const firstPage = await fetchPage(1)
            if (!firstPage?.success) throw new Error(firstPage?.message ?? "No se pudieron cargar las direcciones.")

            const pages = await Promise.all(
                Array.from({ length: Math.max(0, (firstPage.totalPages ?? 1) - 1) }, (_, index) =>
                    fetchPage(index + 2)
                )
            )
            const responses = [firstPage, ...pages]
            const allAddresses = responses.flatMap((response) => {
                if (!response?.success) throw new Error(response?.message ?? "No se pudieron cargar las direcciones.")
                return response.data ?? []
            })

            if (active) {
                setAddresses(allAddresses.filter(
                    (address) => Number(address.clientId) === Number(formData.clientId)
                ))
            }
        } catch (error) {
            console.error('Error al cargar las direcciones:', error)
        }
    }

    void fetchAddresses()
    return () => {
        active = false
    }
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