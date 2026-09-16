import { ChangeEvent, useState, useEffect, useRef } from 'react'
import { FormOrderItem } from './views/CreateOrderPage'
import { Product } from '../../../main/domain/types/electron-env'

interface ItemOrderProps {
  item: FormOrderItem
  isOnlyItem: boolean
  onUpdateItem: (id: string, updatedFields: Partial<FormOrderItem>) => void
  onRemoveItem: (id: string) => void
}

export function ItemOrder({
  item,
  isOnlyItem,
  onUpdateItem,
  onRemoveItem,
}: ItemOrderProps) {
  const [searchTerm, setSearchTerm] = useState(item.description || '')
  const [products, setProducts] = useState<Product[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Carga productos desde IPC con debounce al escribir
  useEffect(() => {
    if (!isOpen) return

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        if (window.electronAPI?.getProducts) {
          const res = await window.electronAPI?.getProducts({search: searchTerm, page: 1, sort: "nameDesc"})
          setProducts(res.data || [])
        }
      } catch (error) {
        console.error('Error al obtener productos desde IPC:', error)
      } finally {
        setIsLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [searchTerm, isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectProduct = (product: Product) => {
    setSearchTerm(product.name)
    setIsOpen(false)

    onUpdateItem(item.id, {
      productId: Number(product.id),
      description: product.name,
      unitPrice: Number(product.price),
    })
  }

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const qty = Math.max(1, Number(e.target.value) || 1)
    onUpdateItem(item.id, { quantity: qty })
  }

  const handleUnitPriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const price = Math.max(0, Number(e.target.value) || 0)
    onUpdateItem(item.id, { unitPrice: price })
  }

  const subtotal = item.quantity * item.unitPrice

  const inputStyle =
    'w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

  return (
    <tr className="border-b border-slate-200/80 transition hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]">
      {/* Columna: Búsqueda y Selección de Producto */}
      <td className="px-4 py-3">
        <div className="relative" ref={dropdownRef}>
          <input
            type="text"
            className={inputStyle}
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              // Retrasamos el cierre para permitir el evento click de la lista
              setTimeout(() => setIsOpen(false), 200)
            }}
          />

          {isOpen && (
            <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
              {isLoading ? (
                <li className="px-4 py-2 text-xs text-slate-400">Buscando productos...</li>
              ) : products.length > 0 ? (
                products.map((product) => (
                  <li
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-zinc-800"
                  >
                    <span className="font-medium">{product.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ${Number(product.price).toLocaleString('es-AR')}
                    </span>
                  </li>
                ))
              ) : (
                <li className="px-4 py-2 text-xs text-slate-400">Sin resultados</li>
              )}
            </ul>
          )}
        </div>
      </td>

      {/* Columna: Cantidad */}
      <td className="w-28 px-4 py-3">
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={handleQuantityChange}
          className={`${inputStyle} text-center`}
        />
      </td>

      {/* Columna: Precio Unitario */}
      <td className="w-36 px-4 py-3">
        <input
          type="text"
          min={0}
          step="0.01"
          value={`$${item.unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
          onChange={handleUnitPriceChange}
          className={`${inputStyle} text-right`}
          disabled
        />
      </td>

      {/* Columna: Subtotal */}
      <td className="w-32 px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
        ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </td>

      {/* Columna: Botón Eliminar */}
      <td className="w-12 px-4 py-3 text-center">
        <button
          type="button"
          onClick={() => onRemoveItem(item.id)}
          disabled={isOnlyItem}
          title={isOnlyItem ? 'La orden debe tener al menos un ítem' : 'Eliminar ítem'}
          className={`inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition ${
            isOnlyItem
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