import { useState, useEffect } from "react"
import { useAppDispatch } from "../store/hooks"
import { setCurrentTab, setOrderToEdit, setGlobalAlert } from "../store/slices/appSlice"
import { OrderWithState } from "../../../main/domain/types/electron-env"
import {
  OrderState,
  canEditOrderDetails,
  canViewInvoice,
  getAllowedNextStates,
  getRole,
  requiresReason,
  requiresTracking,
} from "../../../main/domain/orderStateRules"

import { useSeletedAddressOnOrder } from "./useSeletedAddressOnOrder"
import useSeletedUserOnOrder from "./useSeletedUserOnOrder"

import { FormOrderItem, SessionInfo, FormData } from "../types/Order"

const newItem = (): FormOrderItem => ({
  id: crypto.randomUUID(),
  productId: 0,
  description: "",
  quantity: 1,
  unitPrice: 0,
})

const buildFormData = (order?: OrderWithState | null): FormData => ({
  clientId: Number(order?.client?.id ?? -1),
  shippingAddressId: Number(order?.shippingAddressId ?? -1),
  currentStateId: Number(order?.currentStateId ?? order?.currentState?.id ?? OrderState.Created),
  trackingNumber: order?.trackingNumber || "",
  location: "",
  notes: "",
  invoiceType: (order as any)?.invoiceType ?? 'B',
  paymentMethod: (order as any)?.paymentMethod || 'Efectivo',
})

const mapOrderItems = (order: OrderWithState): FormOrderItem[] => {
  const rawItems = (order as any).items ?? (order as any).itemOrders ?? []
  if (rawItems.length === 0) return [newItem()]

  return rawItems.map((item: any) => ({
    id: item.id ? String(item.id) : crypto.randomUUID(),
    productId: Number(item.productId ?? item.product?.id ?? 0),
    description: item.description ?? item.product?.name ?? "",
    quantity: Number(item.quantity ?? item.amount ?? 1),
    unitPrice: Number(item.unitPrice ?? item.price ?? 0),
  }))
}

const fetchSession = async (): Promise<SessionInfo | null> => {
  const data = await window.electronAPI?.getSession?.()
  if (!data) return null
  return { ...data, id: Number(data.id), roleId: Number(data.roleId) }
}

const assertSuccess = (response: any, fallbackMessage: string) => {
  if (!response?.success) throw new Error(response?.message || fallbackMessage)
}

export function useOrderForm(initialOrder?: OrderWithState | null) {
  const dispatch = useAppDispatch()

  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch((err) => console.error("Error al obtener la sesión activa:", err))
      .finally(() => setLoadingSession(false))
  }, [])

  const role = getRole(session?.roleId, session?.roleName)
  const currentOrderId = initialOrder?.id ? Number(initialOrder.id) : null
  const isEditing = Boolean(currentOrderId)
  
  const orderStateId = Number(
    (initialOrder as any)?.currentStateId ?? initialOrder?.currentState?.id ?? OrderState.Created
  )

  const allowedNextStates = currentOrderId ? getAllowedNextStates(orderStateId, role) : []
  const canEditDetails = !currentOrderId || canEditOrderDetails(orderStateId, role)
  const canSubmit = canEditDetails || allowedNextStates.length > 0

  const hasInvoice = Boolean((initialOrder as any)?.invoiceType)
  const showInvoice = currentOrderId && canViewInvoice(orderStateId, role) && hasInvoice

  const [formData, setFormData] = useState<FormData>(() => buildFormData(initialOrder))
  const [items, setItems] = useState<FormOrderItem[]>([newItem()])

  const stateChanged = formData.currentStateId !== orderStateId
  const nextStateNeedsTracking = stateChanged && requiresTracking(formData.currentStateId)
  const nextStateNeedsReason = stateChanged && requiresReason(formData.currentStateId)

  const isTargetStatePaid = formData.currentStateId === OrderState.Paid
  const isInitialStatePaid = !currentOrderId && formData.currentStateId === OrderState.Paid

  const { clients, searchTermClients, setSearchTermClients, isOpenClients, setIsOpenClients } =
    useSeletedUserOnOrder()

  const { addresses, searchTermAddress, setSearchTermAddress, isOpenAddress, setIsOpenAddress } =
    useSeletedAddressOnOrder(formData)

  const initialStateOptions = [
    OrderState.Created,
    ...getAllowedNextStates(OrderState.Created, role).filter(
      (stateId) => stateId === OrderState.Pending || stateId === OrderState.Paid
    ),
  ]

  useEffect(() => {
    setFormData(buildFormData(initialOrder))
    if (!initialOrder?.id) {
      setSearchTermClients("")
      setSearchTermAddress("")
      setItems([newItem()])
      return
    }

    if (initialOrder?.client) {
      setSearchTermClients(`${initialOrder.client.name} ${initialOrder.client.lastname}`)
    }

    const addr = (initialOrder as any)?.shippingAddress
    if (addr) {
      const city = addr.city?.name ? `, ${addr.city.name}` : ""
      setSearchTermAddress(`${addr.street ?? ""} ${addr.number ?? ""}${city}`.trim())
    }

    if (initialOrder) {
      setItems(mapOrderItems(initialOrder))
    }
  }, [initialOrder])

  const handleAddItem = () => {
    if (formData.clientId <= 0) {
      dispatch(setGlobalAlert("Debe seleccionar un cliente antes de agregar ítems."))
      return
    }
    setItems((prev) => [...prev, newItem()])
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)))
  }

  const handleUpdateItem = (id: string, updatedFields: Partial<FormOrderItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item)))
  }

  const handleClientSelect = (client: (typeof clients)[number]) => {
    const newClientId = Number(client.id)
    setFormData((prev) => ({ ...prev, clientId: newClientId, shippingAddressId: -1 }))
    setSearchTermClients(`${client.name} ${client.lastname}`)
    setSearchTermAddress("")
    setIsOpenAddress(false)
    setIsOpenClients(false)
  }

  const handleAddressSelect = (address: (typeof addresses)[number]) => {
    const newAddressId = Number(address.id)
    const cityName = address.city?.name ? `, ${address.city.name}` : ""
    setFormData((prev) => ({ ...prev, shippingAddressId: newAddressId }))
    setSearchTermAddress(`${address.street} ${address.number}${cityName}`)
    setIsOpenAddress(false)
  }

  const handleCancel = () => {
    dispatch(setOrderToEdit(null))
    dispatch(setCurrentTab("orders"))
  }

  const handleViewInvoice = async (docType?: 'invoice' | 'credit-note') => {
    try {
      const response = await window.electronAPI?.openOrderInvoice?.(String(currentOrderId), docType)
      assertSuccess(response, "No se pudo abrir el comprobante.")
    } catch (err) {
      dispatch(setGlobalAlert(err instanceof Error ? err.message : "Error al abrir el comprobante."))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let finalClientId = formData.clientId
    if (finalClientId <= 0 && searchTermClients.trim().length > 2 && clients.length > 0) {
      const matchedClient = clients.find(c => `${c.name} ${c.lastname}`.toLowerCase().includes(searchTermClients.toLowerCase()))
      if (matchedClient) finalClientId = Number(matchedClient.id)
    }

    let finalAddressId = formData.shippingAddressId
    if (finalAddressId <= 0 && searchTermAddress.trim().length > 2 && addresses.length > 0) {
      const matchedAddress = addresses.find(a => `${a.street} ${a.number}`.toLowerCase().includes(searchTermAddress.toLowerCase()))
      if (matchedAddress) finalAddressId = Number(matchedAddress.id)
    }

    if (canEditDetails) {
      if (!finalClientId || finalClientId <= 0) return dispatch(setGlobalAlert("Debe seleccionar un cliente de la lista."))
      if (!finalAddressId || finalAddressId <= 0) return dispatch(setGlobalAlert("Debe seleccionar una dirección de la lista."))
      if (items.some((i) => i.productId <= 0)) return dispatch(setGlobalAlert("Todos los ítems deben tener un producto seleccionado"))
    }

    const isPayingNow = formData.currentStateId === OrderState.Paid
    if (isPayingNow && !formData.paymentMethod.trim()) return dispatch(setGlobalAlert("Debe seleccionar un método de pago."))
    if (nextStateNeedsTracking && !formData.trackingNumber.trim()) return dispatch(setGlobalAlert("El número de seguimiento es obligatorio."))
    if (nextStateNeedsReason && !formData.notes.trim()) return dispatch(setGlobalAlert("Indicá el motivo del rechazo."))

    setIsSaving(true)
    let generatedOrderId: number | null = currentOrderId

    try {
      const selectedAddress = addresses.find((a) => Number(a.id) === finalAddressId) || (initialOrder as any)?.shippingAddress
      const sellerId = role === "seller" ? Number(session?.id) : Number(initialOrder?.sellerId || session?.id || 0)
      
      const details = {
        clientId: finalClientId,
        shippingAddressId: finalAddressId,
        sellerId,
        total: items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0), 
        shippingStreet: selectedAddress?.street ?? "",
        shippingNumber: Number(selectedAddress?.number ?? 0),
        shippingFloor: selectedAddress?.floor ?? null,
        shippingApartment: selectedAddress?.apartment ?? null,
        shippingPostalCode: selectedAddress?.postalCode ?? "",
        shippingCityName: selectedAddress?.city?.name ?? "",
        items: items.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice })),
      }

      if (!currentOrderId) {
        const payload = {
          ...details,
          initialStateId: formData.currentStateId,
          paymentMethod: isPayingNow ? formData.paymentMethod : undefined,
          invoiceType: isPayingNow ? formData.invoiceType : undefined,
        }
        const response = await window.electronAPI?.createOrder?.(payload as any)
        assertSuccess(response, "Error al crear la orden.")
        if (response?.orderId) generatedOrderId = Number(response.orderId)
      } else {
        const updateRes = await window.electronAPI?.updateOrder?.({ id: String(currentOrderId), ...details } as any)
        assertSuccess(updateRes, "Error al actualizar los datos.")

        if (formData.currentStateId !== orderStateId) {
          const statePayload = {
            id: String(currentOrderId),
            currentStateId: formData.currentStateId,
            trackingNumber: formData.trackingNumber.trim() || undefined,
            location: formData.location.trim() || undefined,
            notes: formData.notes.trim() || undefined,
            invoiceType: isTargetStatePaid ? formData.invoiceType : undefined,
            paymentMethod: isTargetStatePaid ? formData.paymentMethod : undefined,
          }
          const stateResponse = await window.electronAPI?.updateOrderState?.(statePayload as any)
          assertSuccess(stateResponse, "Error al actualizar el estado de la orden.")
        }
      }

      const isCancelledOrRejected = formData.currentStateId === OrderState.Cancelled || formData.currentStateId === OrderState.Rejected
      if ((isPayingNow || isCancelledOrRejected) && generatedOrderId) {
        try {
          await window.electronAPI?.openOrderInvoice?.(String(generatedOrderId))
        } catch (invoiceErr) {
          console.error("No se pudo abrir el comprobante:", invoiceErr)
        }
      }

      dispatch(setOrderToEdit(null))
      setTimeout(() => dispatch(setCurrentTab("orders")), 150)
    } catch (err) {
      console.error("Error al guardar la orden:", err)
      dispatch(setGlobalAlert(err instanceof Error ? err.message : "Error de comunicación."))
    } finally {
      setIsSaving(false)
    }
  }

  return {
    session, loadingSession, isSaving, role, currentOrderId, isEditing, orderStateId,
    allowedNextStates, canEditDetails, canSubmit, hasInvoice, showInvoice,
    formData, setFormData, items, stateChanged, nextStateNeedsTracking, nextStateNeedsReason,
    isTargetStatePaid, isInitialStatePaid, clients, searchTermClients, setSearchTermClients,
    isOpenClients, setIsOpenClients, addresses, searchTermAddress, setSearchTermAddress,
    isOpenAddress, setIsOpenAddress, initialStateOptions, handleAddItem, handleRemoveItem,
    handleUpdateItem, handleClientSelect, handleAddressSelect, handleCancel, handleViewInvoice,
    handleSubmit
  }
}