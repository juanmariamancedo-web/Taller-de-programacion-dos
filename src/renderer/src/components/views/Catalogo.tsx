import { FormEvent, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { ProductCategory } from '../../../../main/domain/types/electron-env'
import Paginacion from '../Pagination'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setPage } from '../../store/slices/appSlice'
import { Sort } from '../Sort'

type Product = {
  id: string
  name: string
  price: number
  stock: number
  lowStock: number
  image: string
  isActive: boolean
  categoryId: string
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
  isActive: true,
  categoryId: ''
}

const nameCharactersPattern = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]$/

type ProductPage = {
  products: Product[]
  totalCount: number
  totalPages: number
}

async function fetchProducts(
  search: string,
  page: number,
  sort: string,
  includeInactive: boolean
): Promise<ProductPage> {
  const api = window.electronAPI
  if (!api) throw new Error('No se pudo conectar con la base de datos.')

  const response = await api.getProducts({
    search,
    page,
    sort,
    includeInactive
  })

  if (!response.success) {
    throw new Error(response.message ?? 'No se pudieron cargar los productos.')
  }

  return {
    products: (response.data ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      stock: Number(product.stock),
      lowStock: Number(product.lowStock),
      image: product.image,
      isActive: product.isActive,
      categoryId: product.categoryId
    })),
    totalCount: response.totalCount,
    totalPages: response.totalPages
  }
}

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
  const [products, setProducts] = useState<Product[]>([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({})
  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productLoadError, setProductLoadError] = useState<string | null>(null)
  const [productActionError, setProductActionError] = useState<string | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { page, sort } = useAppSelector((state) => state.app)
  const dispatch = useAppDispatch()
  const session = useAppSelector((state) => state.app.session)
  const canManageProducts = session?.roleName === 'admin' || session?.roleName === 'supervisor'
  const canEditProducts = canManageProducts
  const canAdjustStock = session?.roleName === 'admin' || session?.roleName === 'supervisor'
  const productTableColumnCount = canEditProducts ? 6 : 5

  const reloadCurrentPage = async (): Promise<void> => {
    const loadedPage = await fetchProducts(search, page, sort, canManageProducts)
    setTotalProducts(loadedPage.totalCount)
    if (page > loadedPage.totalPages) {
      dispatch(setPage(loadedPage.totalPages))
      return
    }
    setProducts(loadedPage.products)
  }

  useEffect(() => {
    let cancelled = false

    const loadProducts = async (): Promise<void> => {
      setLoadingProducts(true)
      setProductLoadError(null)

      try {
        const loadedPage = await fetchProducts(search, page, sort, canManageProducts)
        if (!cancelled) {
          setTotalProducts(loadedPage.totalCount)
          if (page > loadedPage.totalPages) {
            dispatch(setPage(loadedPage.totalPages))
          } else {
            setProducts(loadedPage.products)
          }
        }
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
  }, [canManageProducts, dispatch, page, search, sort])

  useEffect(() => {
    if (!canManageProducts) return

    let cancelled = false
    const loadCategories = async (): Promise<void> => {
      try {
        const response = await window.electronAPI?.getProductCategories()
        if (!response?.success) {
          throw new Error(response?.message ?? 'No se pudieron cargar las categorías.')
        }
        const loadedCategories = response.data ?? []
        if (!cancelled) {
          setCategories(loadedCategories)
        }
      } catch (error) {
        if (!cancelled) {
          setProductActionError(error instanceof Error ? error.message : 'No se pudieron cargar las categorías.')
        }
      }
    }

    void loadCategories()
    return () => {
      cancelled = true
    }
  }, [canManageProducts])

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
      nextErrors.name = 'Usá entre 2 y 80 letras, números, espacios o guiones.'
    }
    if (!/^\d+(\.\d{1,2})?$/.test(form.price) || Number(form.price) < 0) {
      nextErrors.price = 'Ingresá un precio válido.'
    }
    if (!/^\d+$/.test(form.stock)) nextErrors.stock = 'Ingresá un stock válido.'
    if (!/^\d+$/.test(form.lowStock)) nextErrors.lowStock = 'Ingresá un stock mínimo válido.'
    if (!form.categoryId) nextErrors.categoryId = 'Seleccioná una categoría.'
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
      isActive: form.isActive,
      categoryId: form.categoryId
    }

    setSavingProduct(true)
    setProductActionError(null)
    try {
      const response = editingProductId === null
        ? await window.electronAPI?.createProduct(productData)
        : await window.electronAPI?.updateProduct({ ...productData, id: editingProductId })
      if (!response?.success) {
        throw new Error(response?.message ?? 'No se pudo guardar el producto.')
      }

      await reloadCurrentPage()
      resetForm()
    } catch (error) {
      setProductActionError(error instanceof Error ? error.message : 'No se pudo guardar el producto.')
    } finally {
      setSavingProduct(false)
    }
  }

  const editProduct = (product: Product): void => {
    setEditingProductId(product.id)
    setForm({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock),
      lowStock: String(product.lowStock),
      image: product.image,
      isActive: product.isActive,
      categoryId: product.categoryId
    })
    setErrors({})
  }

  const toggleProduct = async (product: Product): Promise<void> => {
    setProductActionError(null)
    try {
      const response = await window.electronAPI?.setProductStatus({
        id: product.id,
        isActive: !product.isActive
      })
      if (!response?.success) {
        throw new Error(response?.message ?? 'No se pudo cambiar el estado del producto.')
      }
      await reloadCurrentPage()
    } catch (error) {
      setProductActionError(error instanceof Error ? error.message : 'No se pudo cambiar el estado del producto.')
    }
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

  const updateStockDraft = (productId: string, value: string): void => {
    setStockDrafts((currentDrafts) => ({
      ...currentDrafts,
      [productId]: value.replace(/\D/g, '')
    }))
  }

  const saveStock = async (product: Product): Promise<void> => {
    const draft = stockDrafts[product.id]
    if (draft === undefined || !/^\d+$/.test(draft)) return

    const stock = Number(draft)
    setProductActionError(null)
    try {
      const response = await window.electronAPI?.updateProductStock({ id: product.id, stock })
      if (!response?.success) {
        throw new Error(response?.message ?? 'No se pudo actualizar el stock.')
      }
      setProducts((currentProducts) => currentProducts.map((currentProduct) =>
        currentProduct.id === product.id ? { ...currentProduct, stock } : currentProduct
      ))
      setStockDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts }
        delete nextDrafts[product.id]
        return nextDrafts
      })
      setEditingStockId(null)
    } catch (error) {
      setProductActionError(error instanceof Error ? error.message : 'No se pudo actualizar el stock.')
    }
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
      {productActionError && (
        <p role="alert" className="w-full text-sm text-rose-600 dark:text-rose-300">
          {productActionError}
        </p>
      )}

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
            Categoría
            <select
              value={form.categoryId}
              onChange={(event) => updateForm('categoryId', event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option value="" className="bg-white text-gray-900 dark:bg-zinc-900 dark:text-white">
                Seleccioná una categoría
              </option>
              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                  className="bg-white text-gray-900 dark:bg-zinc-900 dark:text-white"
                >
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <span className="text-xs text-rose-600 dark:text-rose-300">{errors.categoryId}</span>}
            {categories.length === 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-300">No hay categorías disponibles para crear productos.</span>
            )}
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
          disabled={savingProduct || categories.length === 0}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingProduct ? 'Guardando...' : editingProductId === null ? 'Crear producto' : 'Guardar cambios'}
        </button>
      </form>}

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            dispatch(setPage(1))
          }}
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
              {canEditProducts && <th className="px-4 py-3">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {loadingProducts ? (
              <tr>
                <td colSpan={productTableColumnCount} className="py-8 text-center text-gray-500">
                  Cargando productos...
                </td>
              </tr>
            ) : productLoadError ? (
              <tr>
                <td colSpan={productTableColumnCount} className="py-8 text-center text-rose-600 dark:text-rose-300">
                  {productLoadError}
                </td>
              </tr>
            ) : products.length ? (
              products.map((product) => (
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
                  {canEditProducts && (
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
                          onClick={() => toggleProduct(product)}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200"
                        >
                          {product.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={productTableColumnCount} className="py-8 text-center text-gray-500">
                  No hay productos encontrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginacion paginas={Math.ceil(totalProducts / 5)} />
    </div>
  )
}
