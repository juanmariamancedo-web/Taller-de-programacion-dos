import { FormOrderItem } from './views/CreateOrderPage'
import { ChangeEvent, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ProductListItem } from '../../../main/domain/types/electron-env'

interface ItemOrderProps {
  item: FormOrderItem
  isOnlyItem: boolean
  disabled?: boolean
  selectedProductIds: number[]
  onUpdateItem: (id: string, updatedFields: Partial<FormOrderItem>) => void
  onRemoveItem: (id: string) => void
}

// Solución: Usamos intersección o aseguramos que stock sea compatible
type ProductWithStock = ProductListItem & { stock: number }

export function ItemOrder({
  item,
  isOnlyItem,
  disabled = false,
  selectedProductIds,
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
        if (window.electronAPI?.getProducts) {
          const res = await window.electronAPI?.getProducts({ search: searchTerm, page: 1, sort: 'nameDesc' })
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

  // FILTRO ESTRICTO: Excluye productos ya seleccionados y oculta automáticamente los que tengan stock 0 o menor
  const availableProducts = products.filter((product) => {
    const stock = Number(product.stock ?? 0)
    const isOutOfStock = stock <= 0
    const isAlreadySelected = Number(product.id) !== item.productId && selectedProductIds.includes(Number(product.id))

    return !isOutOfStock && !isAlreadySelected
  })

  // Obtener el stock actual del producto seleccionado en este ítem (si lo hubiera)
  const currentProductStock = products.find((p) => Number(p.id) === item.productId)?.stock

  const handleSelectProduct = (product: ProductWithStock) => {
    if (disabled) return
    setSearchTerm(product.name)
    setIsOpen(false)

    const maxStock = Number(product.stock ?? 1)
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

    const maxVal = currentProductStock !== undefined ? Number(currentProductStock) : rawVal
    const qty = Math.min(maxVal, Math.max(minVal, rawVal))

    onUpdateItem(item.id, { quantity: qty })
  }

  const subtotal = item.quantity * item.unitPrice

  const inputStyle =
    'w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

  return (
    <tr className="border-b border-slate-200/80 transition hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]">
      {/* Producto */}
      <td className="px-4 py-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            className={`${inputStyle} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              openDropdown()
            }}
            onFocus={openDropdown}
            onBlur={() => {
              setTimeout(() => setIsOpen(false), 200)
            }}
          />

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
                        <span className="text-[11px] text-slate-400">Stock: {String(product.stock ?? 0)} un.</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        ${Number(product.price).toLocaleString('es-AR')}
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
      <td className="w-28 px-4 py-3">
        <div className="relative">
          <input
            type="number"
            min={1}
            max={currentProductStock !== undefined ? Number(currentProductStock) : undefined}
            disabled={disabled}
            value={item.quantity}
            onChange={handleQuantityChange}
            className={`${inputStyle} text-center ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            title={currentProductStock !== undefined ? `Stock máximo disponible: ${currentProductStock}` : undefined}
          />
        </div>
      </td>

      {/* Precio Unitario */}
      <td className="w-36 px-4 py-3">
        <input
          type="text"
          value={`$${item.unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
          className={`${inputStyle} text-right cursor-not-allowed opacity-60`}
          disabled
        />
      </td>

      {/* Subtotal */}
      <td className="w-32 px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
        ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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