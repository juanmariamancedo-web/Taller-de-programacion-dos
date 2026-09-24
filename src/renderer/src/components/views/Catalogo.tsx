import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { useAppSelector } from '../../store/hooks'
import { Sort } from '../Sort'

type Product = {
  id: number
  name: string
  price: number
  stock: number
  lowStock: number
  image: string
  isActive: boolean
}

type ProductForm = Omit<Product, 'id'>
type FormData = Omit<ProductForm, 'price' | 'stock' | 'lowStock'> & {
  price: string
  stock: string
  lowStock: string
}
type FormErrors = Partial<Record<keyof FormData, string>>

const emptyForm: FormData = {
  name: '',
  price: '',
  stock: '',
  lowStock: '',
  image: '',
  isActive: true
}

const initialProducts: Product[] = []
const STOCK_STORAGE_KEY = 'catalogo-product-stock'
const nameCharactersPattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]$/

function sanitizeProductName(value: string): string {
  return value
    .split('')
    .filter((character) => nameCharactersPattern.test(character) || character === ' ' || character === '-' || character === "'")
    .join('')
}

function hasValidProductName(value: string): boolean {
  return value.split('').every((character) => nameCharactersPattern.test(character) || character === ' ' || character === '-' || character === "'")
}

export default function Catalogo(): JSX.Element {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({})
  const [editingStockId, setEditingStockId] = useState<number | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productLoadError, setProductLoadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sort = useAppSelector((state) => state.app.sort)
  const session = useAppSelector((state) => state.app.session)
  const canManageProducts = session?.roleName === 'admin' || session?.roleName === 'seller'
  const canAdjustStock = session?.roleName === 'supervisor'

  useEffect(() => {
    let cancelled = false

    const loadProducts = async (): Promise<void> => {
      setLoadingProducts(true)
      setProductLoadError(null)

      try {
        const firstResponse = await window.electronAPI?.getProducts({
          search: '',
          page: 1,
          sort: 'nameAsc'
        })

        if (!firstResponse?.success) {
          throw new Error(firstResponse?.message ?? 'No se pudieron cargar los productos.')
        }

        const totalPages = firstResponse.totalPages ?? 1
        const remainingResponses = await Promise.all(
          Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
            window.electronAPI?.getProducts({
              search: '',
              page: index + 2,
              sort: 'nameAsc'
            })
          )
        )

        const responses = [firstResponse, ...remainingResponses]
        const savedStocks = JSON.parse(localStorage.getItem(STOCK_STORAGE_KEY) ?? '{}') as Record<string, number>
        const loadedProducts: Product[] = responses.flatMap((response) =>
          response?.success && response.data
            ? response.data.map((product) => ({
                id: Number(product.id),
                name: product.name,
                price: Number(product.price),
                stock: Number.isInteger(savedStocks[String(product.id)])
                  ? savedStocks[String(product.id)]
                  : Number(product.stock),
                lowStock: Number(product.lowStock),
                image: product.image,
                isActive: product.isActive
              }))
            : []
        )

        if (!cancelled) setProducts(loadedProducts)
      } catch (error) {
        if (!cancelled) {
          setProductLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los productos.')
        }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [])

  const visibleProducts = useMemo<Product[]>((): Product[] => {
    const normalizedSearch = search.trim().toLowerCase()
    const primarySort = sort.replace(/Asc|Desc$/, '')
    const direction = sort.endsWith('Asc') ? 1 : -1

    return [...products]
      .filter((product) => product.name.toLowerCase().includes(normalizedSearch))
      .sort((firstProduct, secondProduct) => {
        switch (primarySort) {
          case 'stock':
            return (firstProduct.stock - secondProduct.stock) * direction
          case 'price':
            return (firstProduct.price - secondProduct.price) * direction
          case 'isActive':
            return (Number(firstProduct.isActive) - Number(secondProduct.isActive)) * direction
          case 'name':
          default:
            return firstProduct.name.localeCompare(secondProduct.name) * direction
        }
      })
  }, [products, search, sort])

  const updateForm = <Field extends keyof FormData>(
    field: Field,
    value: FormData[Field]
  ): void => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
  }

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {}
    const name = form.name.trim()
    if (!name || name.length < 2 || name.length > 80 || !hasValidProductName(name)) {
      nextErrors.name = 'Usá entre 2 y 80 letras, espacios o guiones.'
    }
    if (!/^\d+(\.\d{1,2})?$/.test(form.price) || Number(form.price) < 0) {
      nextErrors.price = 'Ingresá un precio válido.'
    }
    if (!/^\d+$/.test(form.stock)) nextErrors.stock = 'Ingresá un stock válido.'
    if (!/^\d+$/.test(form.lowStock)) nextErrors.lowStock = 'Ingresá un stock mínimo válido.'
    if (editingProductId === null && !form.image.trim()) nextErrors.image = 'Ingresá la imagen del producto.'
    if (
      form.image.trim() &&
      !/^https?:\/\/\S+$/i.test(form.image.trim()) &&
      !/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(form.image.trim())
    ) {
      nextErrors.image = 'Ingresá una URL o una imagen válida.'
    }
    return nextErrors
  }

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        image: 'Seleccioná un archivo de imagen válido.'
      }))
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateForm('image', reader.result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const validationErrors = validateForm()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    const productData: ProductForm = {
      name: form.name.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      lowStock: Number(form.lowStock),
      image: form.image.trim(),
      isActive: form.isActive
    }

    if (editingProductId === null) {
      setProducts((currentProducts) => [...currentProducts, { ...productData, id: Date.now() }])
    } else {
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === editingProductId ? { ...productData, id: product.id } : product
        )
      )
    }

    resetForm()
  }

  const editProduct = (product: Product): void => {
    setEditingProductId(product.id)
    setForm({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock),
      lowStock: String(product.lowStock),
      image: product.image,
      isActive: product.isActive
    })
    setErrors({})
  }

  const toggleProduct = (productId: number): void => {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, isActive: !product.isActive } : product
      )
    )
  }

  const getStockValue = (product: Product): number => {
    const draft = stockDrafts[product.id]
    return draft !== undefined && /^\d+$/.test(draft) ? Number(draft) : product.stock
  }

  const startStockEdit = (product: Product): void => {
    setEditingStockId(product.id)
    setStockDrafts((currentDrafts) => ({
      ...currentDrafts,
      [product.id]: String(product.stock)
    }))
  }

  const updateStockDraft = (productId: number, value: string): void => {
    setStockDrafts((currentDrafts) => ({
      ...currentDrafts,
      [productId]: value.replace(/\D/g, '')
    }))
  }

  const saveStock = (product: Product): void => {
    const draft = stockDrafts[product.id]
    if (draft === undefined || !/^\d+$/.test(draft)) return

    const stock = Number(draft)
    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === product.id ? { ...currentProduct, stock } : currentProduct
      )
    )
    setStockDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[product.id]
      return nextDrafts
    })
    const savedStocks = JSON.parse(localStorage.getItem(STOCK_STORAGE_KEY) ?? '{}') as Record<string, number>
    localStorage.setItem(
      STOCK_STORAGE_KEY,
      JSON.stringify({ ...savedStocks, [product.id]: stock })
    )
    setEditingStockId(null)
  }

  const resetForm = (): void => {
    setForm(emptyForm)
    setEditingProductId(null)
    setErrors({})
  }

  const stockClass = (product: Product): string => {
    const stock = getStockValue(product)
    if (stock === 0)
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
    if (stock <= product.lowStock)
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="w-full flex flex-col gap-2 pb-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">Productos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Administrá el catálogo y el inventario.
        </p>
      </div>

      {canManageProducts && <form
        onSubmit={handleSubmit}
        className="w-full rounded-xl border border-gray-200 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingProductId === null ? 'Nuevo producto' : 'Editar producto'}
          </h2>
          {editingProductId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 sm:col-span-2">
            Nombre
            <input
                value={form.name}
                onChange={(event) => updateForm('name', sanitizeProductName(event.target.value))}
              placeholder="Nombre del producto"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            {errors.name && <span className="text-xs text-rose-600 dark:text-rose-300">{errors.name}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Precio
            <input
              type="text"
              inputMode="decimal"
              value={form.price}
              onChange={(event) => updateForm('price', event.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            {errors.price && <span className="text-xs text-rose-600 dark:text-rose-300">{errors.price}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Stock
            <input
              type="text"
              inputMode="numeric"
              value={form.stock}
              onChange={(event) => updateForm('stock', event.target.value.replace(/\D/g, ''))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            {errors.stock && <span className="text-xs text-rose-600 dark:text-rose-300">{errors.stock}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Stock mínimo
            <input
              type="text"
              inputMode="numeric"
              value={form.lowStock}
              onChange={(event) => updateForm('lowStock', event.target.value.replace(/\D/g, ''))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            {errors.lowStock && <span className="text-xs text-rose-600 dark:text-rose-300">{errors.lowStock}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 sm:col-span-2">
            Imagen
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={form.image}
                onChange={(event) => updateForm('image', event.target.value)}
                placeholder="URL de la imagen o seleccioná un archivo"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Explorar archivos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelection}
              />
            </div>
            {errors.image && <span className="text-xs text-rose-600 dark:text-rose-300">{errors.image}</span>}
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => updateForm('isActive', event.target.checked)}
            />
            Producto activo
          </label>
        </div>

        {Object.keys(errors).length > 0 && (
          <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">
            Revisá los campos marcados antes de guardar el producto.
          </p>
        )}
        <button
          type="submit"
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
        >
          {editingProductId === null ? 'Crear producto' : 'Guardar cambios'}
        </button>
      </form>}

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[720px] bg-black/5 text-sm text-gray-900 dark:bg-white/5 dark:text-white">
          <thead className="bg-gray-100 dark:bg-white/10">
            <tr className="text-left font-semibold text-gray-700 dark:text-gray-200">
              <th className="px-4 py-3">Imagen</th>
              <th className="px-4 py-3"><Sort className="" serverArg="name" name="Nombre" /></th>
              <th className="px-4 py-3"><Sort className="" serverArg="price" name="Precio" /></th>
              <th className="px-4 py-3"><Sort className="" serverArg="stock" name="Stock" /></th>
              <th className="px-4 py-3"><Sort className="" serverArg="isActive" name="Estado" /></th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {loadingProducts ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Cargando productos...
                </td>
              </tr>
            ) : productLoadError ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-rose-600 dark:text-rose-300">
                  {productLoadError}
                </td>
              </tr>
            ) : visibleProducts.length ? (
              visibleProducts.map((product) => (
                <tr key={product.id} className="transition hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="text-gray-400">Sin imagen</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3">${product.price.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {editingStockId === product.id ? (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={stockDrafts[product.id] ?? ''}
                        onChange={(event) => updateStockDraft(product.id, event.target.value)}
                        aria-label={`Nuevo stock de ${product.name}`}
                        className="w-24 rounded-md border border-blue-300 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-blue-400/50 dark:bg-zinc-900 dark:text-white"
                      />
                    ) : (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${stockClass(product)}`}
                      >
                        {getStockValue(product) === 0 ? 'Sin stock' : getStockValue(product)}
                      </span>
                    )}
                    {canAdjustStock && (
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => editingStockId === product.id ? saveStock(product) : startStockEdit(product)}
                          className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300"
                        >
                          {editingStockId === product.id ? 'Guardar' : 'Cambiar'}
                        </button>
                      </div>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold ${product.isActive ? 'text-emerald-600' : 'text-slate-500'}`}
                  >
                    {product.isActive ? 'Activo' : 'Inactivo'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editProduct(product)}
                        className="rounded-lg bg-blue-100 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200"
                      >
                        {product.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No hay productos encontrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
