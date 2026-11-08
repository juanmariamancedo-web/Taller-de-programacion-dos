import { FormOrderItem } from './views/CreateOrderPage'
import { ChangeEvent, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ProductListItem } from '../../../main/domain/types/electron-env'

interface ItemOrderProps {
  item: FormOrderItem
  isOnlyItem: boolean
  disabled?: boolean
  selectedProductIds: number[]
  /** Orden ya guardada: el límite real de cantidad lo decide el servidor al reservar. */
  isExistingOrder?: boolean
  /** El servidor rechazó este ítem por stock insuficiente. */
  stockError?: boolean
  /** Estado logístico actual de la orden (1 = Created / Borrador) */
  currentStateId?: number
  onUpdateItem: (id: string, updatedFields: Partial<FormOrderItem>) => void
  onRemoveItem: (id: string) => void
}

type ProductWithStock = ProductListItem & { stock: number; reservedStock?: number; availableStock?: number }

/** Unidades disponibles generales del producto (Físico - Reservado global) */
const getAvailableStock = (product: ProductWithStock): number => {
  if (product.availableStock !== undefined) {
    return Number(product.availableStock)
  }
  const physical = Number(product.stock ?? 0)
  const reserved = Number(product.reservedStock ?? 0)
  return Math.max(0, physical - reserved)
}

export function ItemOrder({
  item,
  isOnlyItem,
  disabled = false,
  selectedProductIds,
  isExistingOrder = false,
  stockError = false,
  currentStateId = 1,
  onUpdateItem,
  onRemoveItem,
}: ItemOrderProps) {
  const [searchTerm, setSearchTerm] = useState(item.description || '')
  const [products, setProducts] = useState<ProductWithStock[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  useEffect(() => {
    setSearchTerm(item.description || '')
  }, [item.description])

  // Función para refrescar el producto actual bajo demanda o por sincronización
  const refreshCurrentProduct = async () => {
    if (!item.productId) return
    try {
      const api = window.electronAPI as any
      if (api?.getProducts) {
        const res = await api.getProducts({ search: item.description || '', page: 1, sort: 'nameDesc' })
        const found = (res.data || []).find((p: any) => Number(p.id) === Number(item.productId))
        if (found) {
          setProducts((prev) => {
            const updatedMap = new Map<number, ProductWithStock>(prev.map((p) => [Number(p.id), p]))
            updatedMap.set(Number(found.id), found as ProductWithStock)
            return Array.from(updatedMap.values())
          })
        }
      }
    } catch (err) {
      console.error('Error al refrescar producto:', err)
    }
  }

  // Cargar la info del producto actual al montar si ya tiene un productId asignado
  useEffect(() => {
    async function fetchCurrentProduct() {
      if (!item.productId) return
      try {
        const api = window.electronAPI as any
        if (api?.getProducts) {
          const res = await api.getProducts({ search: item.description || '', page: 1, sort: 'nameDesc' })
          const found = (res.data || []).find((p: any) => Number(p.id) === Number(item.productId))
          if (found) {
            setProducts((prev) => {
              if (prev.some((p) => Number(p.id) === Number(found.id))) return prev
              return [...prev, found as ProductWithStock]
            })
          }
        }
      } catch (err) {
        console.error('Error al cargar producto inicial del ítem:', err)
      }
    }
    fetchCurrentProduct()
  }, [item.productId, item.description])

  const isDraft = currentStateId === 1

  // Sincronización automática en tiempo real por intervalos cortos para asegurar actualización entre ventanas
  useEffect(() => {
    if (!isDraft || !item.productId) return

    const interval = setInterval(() => {
      refreshCurrentProduct()
    }, 2000)

    return () => clearInterval(interval)
  }, [isDraft, item.productId, item.description])

  // Suscripción al evento IPC global de Electron
  useEffect(() => {
    const api = window.electronAPI as any
    if (!api?.onStockUpdated) return

    const unsubscribe = api.onStockUpdated(async () => {
      refreshCurrentProduct()
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [item.productId, item.description])

  const updateDropdownPosition = (): void => {
    const input = inputRef.current
    if (!input) return

    const bounds = input.getBoundingClientRect()
    setDropdownPosition({ top: bounds.bottom + 4, left: bounds.left, width: bounds.width })
  }

  const openDropdown = (): void => {
    if (disabled) return
    updateDropdownPosition()
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen || disabled) return

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const api = window.electronAPI as any
        if (api?.getProducts) {
          const res = await api.getProducts({ search: searchTerm, page: 1, sort: 'nameDesc' })
          setProducts((res.data || []) as ProductWithStock[])
        }
      } catch (error) {
        console.error('Error al obtener productos desde IPC:', error)
      } finally {
        setIsLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [searchTerm, isOpen, disabled])

  useEffect(() => {
    if (!isOpen) return

    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!inputRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtrado seguro para el Dropdown evitando ocultar el producto actual en edición
  const availableProducts = products.filter((product) => {
    const isCurrentItemProduct = Number(product.id) === item.productId
    const isOutOfStock = getAvailableStock(product) <= 0 && !isCurrentItemProduct
    const isAlreadySelected = !isCurrentItemProduct && selectedProductIds.includes(Number(product.id))

    return !isOutOfStock && !isAlreadySelected
  })

  const currentProduct = products.find((p) => Number(p.id) === item.productId)
  
  // Stock base disponible informado por el backend
  const baseAvailable = currentProduct ? getAvailableStock(currentProduct) : 0

  // El límite máximo para el input es lo que queda libre + lo que ya tiene asignado este ítem en la orden actual
  const currentProductAvailable = currentProduct 
    ? baseAvailable + Number(item.quantity)
    : undefined

  const maxQuantity = currentProductAvailable !== undefined ? Math.max(1, currentProductAvailable) : undefined

  const handleSelectProduct = (product: ProductWithStock) => {
    if (disabled) return
    setSearchTerm(product.name)
    setIsOpen(false)

    const maxStock = Math.max(1, getAvailableStock(product))
    const adjustedQuantity = Math.min(item.quantity, maxStock)

    onUpdateItem(item.id, {
      productId: Number(product.id),
      description: product.name,
      unitPrice: Number(product.price),
      quantity: adjustedQuantity,
    })
  }

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const rawVal = Number(e.target.value) || 1
    const minVal = 1

    const maxVal = maxQuantity !== undefined ? Number(maxQuantity) : rawVal
    const qty = Math.min(maxVal, Math.max(minVal, rawVal))

    onUpdateItem(item.id, { quantity: qty })
  }

  // Cálculos fiscales por ítem (asumiendo precios con IVA incluido)
  const unitPriceWithVat = item.unitPrice
  const unitNetPrice = unitPriceWithVat / 1.21
  const unitVatAmount = unitPriceWithVat - unitNetPrice

  const totalSubtotal = item.quantity * unitPriceWithVat
  const netSubtotal = item.quantity * unitNetPrice
  const vatSubtotal = totalSubtotal - netSubtotal

  const inputStyle =
    'w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

  const errorStyle = stockError ? 'border-red-500 ring-2 ring-red-500/20 dark:border-red-500' : ''

  return (
    <tr className="border-b border-slate-200/80 transition hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]">
      {/* Producto */}
      <td className="px-4 py-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            className={`${inputStyle} ${errorStyle} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              openDropdown()
            }}
            onFocus={() => {
              refreshCurrentProduct()
              openDropdown()
            }}
            onBlur={() => {
              setTimeout(() => setIsOpen(false), 200)
            }}
          />

          {/* Indicador de stock en tiempo real */}
          {isDraft && currentProduct && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  baseAvailable > 0 || Number(item.quantity) > 0 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span>
                Stock disponible:{' '}
                <strong className="text-slate-700 dark:text-slate-200">{baseAvailable}</strong> un.
              </span>
              <span className="text-slate-400 font-normal">
                (Físico: {currentProduct.stock}, Res.: {currentProduct.reservedStock ?? 0})
              </span>
            </div>
          )}

          {stockError && (
            <p className="mt-1 text-[11px] font-medium text-red-500">
              Stock insuficiente: se restauró la última cantidad válida.
            </p>
          )}

          {!disabled && isOpen && dropdownPosition && createPortal(
            <ul
              ref={dropdownRef}
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
              className="fixed z-[1000] max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              {isLoading ? (
                <li className="px-4 py-2 text-xs text-slate-400">Buscando productos...</li>
              ) : availableProducts.length > 0 ? (
                availableProducts.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectProduct(product)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-zinc-800"
                    >
                      <div>
                        <span className="font-medium block">{product.name}</span>
                        <span className="text-[11px] text-slate-400">
                          Disponible: {getAvailableStock(product)} un.
                          {Number(product.reservedStock ?? 0) > 0 && (
                            <> ({Number(product.reservedStock)} reservadas)</>
                          )}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        ${Number(product.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-2 text-xs text-slate-400">
                  {products.length > 0 ? 'Sin stock disponible o ya seleccionado' : 'Sin resultados'}
                </li>
              )}
            </ul>,
            document.body
          )}
        </div>
      </td>

      {/* Cantidad */}
      <td className="w-24 px-4 py-3">
        <div className="relative">
          <input
            type="number"
            min={1}
            max={maxQuantity !== undefined ? Number(maxQuantity) : undefined}
            disabled={disabled}
            value={item.quantity}
            onChange={handleQuantityChange}
            onFocus={refreshCurrentProduct}
            className={`${inputStyle} ${errorStyle} text-center ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            title={
              maxQuantity !== undefined
                ? `Stock máximo disponible: ${maxQuantity}`
                : undefined
            }
          />
        </div>
      </td>

      {/* Precio Unitario */}
      <td className="w-44 px-4 py-3 text-right">
        <div className="font-medium text-slate-900 dark:text-white">
          ${unitPriceWithVat.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-slate-400">
          Neto: ${unitNetPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })} | IVA: ${unitVatAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </div>
      </td>

      {/* Subtotal */}
      <td className="w-40 px-4 py-3 text-right">
        <div className="font-semibold text-slate-900 dark:text-white">
          ${totalSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-slate-400">
          IVA inc. (${vatSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
        </div>
      </td>

      {/* Eliminar Ítem */}
      <td className="w-12 px-4 py-3 text-center">
        <button
          type="button"
          onClick={() => onRemoveItem(item.id)}
          disabled={isOnlyItem || disabled}
          title={isOnlyItem ? 'La orden debe tener al menos un ítem' : 'Eliminar ítem'}
          className={`inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition ${
            isOnlyItem || disabled
              ? 'cursor-not-allowed opacity-30'
              : 'hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400'
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </td>
    </tr>
  )
}