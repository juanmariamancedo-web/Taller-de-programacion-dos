import { FormOrderItem } from './views/CreateOrderPage'
import { ChangeEvent, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ProductListItem } from '../../../main/domain/types/electron-env'

interface ItemOrderProps {
  item: FormOrderItem
  isOnlyItem: boolean
  disabled?: boolean
  selectedProductIds: number[]
  isExistingOrder?: boolean
  stockError?: boolean
  currentStateId?: number
  onUpdateItem: (id: string, updatedFields: Partial<FormOrderItem>) => void
  onRemoveItem: (id: string) => void
}

type ProductWithStock = ProductListItem & {
  stock?: number
  physicalStock?: number
  reservedStock?: number
  availableStock?: number
}

const getAvailableStock = (product: ProductWithStock): number => {
  if (product.availableStock !== undefined) return Number(product.availableStock)
  const physical = Number(product.stock ?? product.physicalStock ?? 0)
  const reserved = Number(product.reservedStock ?? 0)
  return Math.max(0, physical - reserved)
}

export function ItemOrder({
  item,
  isOnlyItem,
  disabled = false,
  selectedProductIds,
  stockError = false,
  currentStateId = 1,
  onUpdateItem,
  onRemoveItem,
}: ItemOrderProps) {
  const [searchTerm, setSearchTerm] = useState(item.description || '')
  const [products, setProducts] = useState<ProductWithStock[]>([])
  
  // Guardamos el objeto completo del producto seleccionado directamente en el estado local
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    setSearchTerm(item.description || '')
  }, [item.description])

  // Si se resetea o borra el ítem (productId === 0), limpiamos la selección
  useEffect(() => {
    if (!item.productId) {
      setSelectedProduct(null)
    }
  }, [item.productId])

  // Si la orden viene guardada (edición), buscamos la info inicial del producto por su ID
  useEffect(() => {
    if (!item.productId || selectedProduct) return

    async function fetchProduct() {
      try {
        const api = window.electronAPI as any
        if (api?.getProducts) {
          const res = await api.getProducts({ search: item.description || '', page: 1, sort: 'nameDesc' })
          const found = (res.data || []).find((p: any) => Number(p.id) === Number(item.productId))
          if (found) {
            setSelectedProduct(found as ProductWithStock)
          }
        }
      } catch (err) {
        console.error('Error al resolver producto del ítem:', err)
      }
    }
    fetchProduct()
  }, [item.productId, item.description, selectedProduct])

  // Sincronización automática periódica para refrescar el stock desde el backend
  useEffect(() => {
    if (!item.productId) return

    const refreshProductStock = async () => {
      try {
        const api = window.electronAPI as any
        if (api?.getProducts) {
          const res = await api.getProducts({ search: item.description || '', page: 1, sort: 'nameDesc' })
          const found = (res.data || []).find((p: any) => Number(p.id) === Number(item.productId))
          if (found) {
            setSelectedProduct((prev) => {
              if (!prev) return found as ProductWithStock
              // Mantenemos la referencia pero actualizamos los valores de stock del servidor
              return {
                ...prev,
                stock: found.stock,
                physicalStock: found.physicalStock,
                reservedStock: found.reservedStock,
                availableStock: found.availableStock,
              }
            })
          }
        }
      } catch (err) {
        console.error('Error al refrescar stock del ítem:', err)
      }
    }

    const interval = setInterval(refreshProductStock, 2000)
    return () => clearInterval(interval)
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
        console.error('Error al obtener productos:', error)
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

  const availableProducts = products.filter((product) => {
    const isCurrent = Number(product.id) === item.productId
    const isOut = getAvailableStock(product) <= 0 && !isCurrent
    const isSelected = !isCurrent && selectedProductIds.includes(Number(product.id))
    return !isOut && !isSelected
  })

  // Priorizamos el objeto local del producto seleccionado
  const activeProduct = selectedProduct || products.find((p) => Number(p.id) === item.productId)
  
  const rawBaseAvailable = activeProduct ? getAvailableStock(activeProduct) : 0

  // Cálculo robusto: Si el servidor ya reservó, el stock disponible es el del servidor. 
  // Si estamos tipeando y el servidor todavía no respondió (debounce), restamos la delta local de forma reactiva.
  const dynamicAvailable = rawBaseAvailable

  // Límite máximo para el input de cantidad
  const maxQuantity = activeProduct ? Math.max(1, rawBaseAvailable + Number(item.quantity)) : undefined

  const handleSelectProduct = (product: ProductWithStock) => {
    if (disabled) return

    setSelectedProduct(product)
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

    // Actualizamos de forma inmediata el estado local del producto para reflejar reservas instantáneas
    if (selectedProduct) {
      const physical = Number(selectedProduct.stock ?? selectedProduct.physicalStock ?? 0)
      const currentReserved = Number(selectedProduct.reservedStock ?? 0)
      // Ajustamos temporalmente el reservedStock localmente para que el contador responda al instante antes del debounce
      const diff = qty - item.quantity
      setSelectedProduct({
        ...selectedProduct,
        reservedStock: Math.max(0, currentReserved + diff)
      })
    }

    onUpdateItem(item.id, { quantity: qty })
  }

  const unitPriceWithVat = item.unitPrice
  const unitNetPrice = unitPriceWithVat / 1.21
  const unitVatAmount = unitPriceWithVat - unitNetPrice
  const totalSubtotal = item.quantity * unitPriceWithVat

  const inputStyle =
    'w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

  const errorStyle = stockError ? 'border-red-500 ring-2 ring-red-500/20 dark:border-red-500' : ''

  return (
    <tr className="border-b border-slate-200/80 transition hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]">
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
            onFocus={openDropdown}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          />

          {/* INDICADOR DE STOCK REACTIVO */}
          {activeProduct && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  dynamicAvailable > 0 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span>
                Stock disponible:{' '}
                <strong className={dynamicAvailable > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-red-500 font-bold'}>
                  {dynamicAvailable}
                </strong> un.
              </span>
              <span className="text-slate-400 font-normal">
                (Físico: {activeProduct.stock ?? activeProduct.physicalStock ?? 0}, Res.: {activeProduct.reservedStock ?? 0})
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
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        ${Number(product.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-2 text-xs text-slate-400">Sin resultados</li>
              )}
            </ul>,
            document.body
          )}
        </div>
      </td>

      <td className="w-24 px-4 py-3">
        <input
          type="number"
          min={1}
          max={maxQuantity}
          disabled={disabled}
          value={item.quantity}
          onChange={handleQuantityChange}
          className={`${inputStyle} ${errorStyle} text-center ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        />
      </td>

      <td className="w-44 px-4 py-3 text-right">
        <div className="font-medium text-slate-900 dark:text-white">
          ${unitPriceWithVat.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-slate-400">
          Neto: ${unitNetPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })} | IVA: ${unitVatAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </div>
      </td>

      <td className="w-40 px-4 py-3 text-right">
        <div className="font-semibold text-slate-900 dark:text-white">
          ${totalSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </div>
      </td>

      <td className="w-12 px-4 py-3 text-center">
        <button
          type="button"
          onClick={() => onRemoveItem(item.id)}
          disabled={isOnlyItem || disabled}
          className={`inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition ${
            isOnlyItem || disabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-red-50 hover:text-red-500'
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  )
}