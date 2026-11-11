import { OrderWithState } from "../../../main/domain/types/electron-env"

export interface FormOrderItem {
  id: string
  productId: number
  description: string
  quantity: number
  unitPrice: number
}

export interface OrderFormProps {
  initialOrder?: OrderWithState | null
}

export interface SessionInfo {
  id?: number
  roleId?: number
  roleName?: string
}

export interface FormData {
  clientId: number
  shippingAddressId: number
  currentStateId: number
  trackingNumber: string
  location: string
  notes: string
  invoiceType: 'A' | 'B' | 'EXENTO'
  paymentMethod: string
}