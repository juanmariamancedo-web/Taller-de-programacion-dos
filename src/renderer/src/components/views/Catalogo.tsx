import { FormEvent, useMemo, useState } from 'react'
import type { JSX } from 'react'

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

const emptyForm: ProductForm = {
  name: '',
  price: 0,
  stock: 0,
  lowStock: 1,
  image: '',
  isActive: true
}

const initialProducts: Product[] = []

export default function Catalogo(): JSX.Element {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')
  const [error, setError] = useState<string | null>(null)

  const visibleProducts = useMemo<Product[]>((): Product[] => {
    const normalizedSearch = search.trim().toLowerCase()
    return products
      .filter((product) => product.name.toLowerCase().includes(normalizedSearch))
      .sort((firstProduct, secondProduct) => {
        if (sort === 'stock') return firstProduct.stock - secondProduct.stock
        if (sort === 'state') return Number(secondProduct.isActive) - Number(firstProduct.isActive)
        return firstProduct.name.localeCompare(secondProduct.name)
      })
  }, [products, search, sort])

  const updateForm = <Field extends keyof ProductForm>(
    field: Field,
    value: ProductForm[Field]
  ): void => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError('El nombre del producto es obligatorio.')
      return
    }

    if (form.price < 0 || form.stock < 0 || form.lowStock < 0) {
      setError('Precio, stock y stock mínimo no pueden ser negativos.')
      return
    }

    if (editingProductId === null) {
      setProducts((currentProducts) => [...currentProducts, { ...form, id: Date.now() }])
    } else {
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === editingProductId ? { ...form, id: product.id } : product
        )
      )
    }

    resetForm()
  }

  const editProduct = (product: Product): void => {
    setEditingProductId(product.id)
    setForm({
      name: product.name,
      price: product.price,
      stock: product.stock,
      lowStock: product.lowStock,
      image: product.image,
      isActive: product.isActive
    })
    setError(null)
  }

  const toggleProduct = (productId: number): void => {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, isActive: !product.isActive } : product
      )
    )
  }

  const resetForm = (): void => {
    setForm(emptyForm)
    setEditingProductId(null)
    setError(null)
  }

  const stockClass = (product: Product): string => {
    if (product.stock === 0)
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
    if (product.stock <= product.lowStock)
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

      <form
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
              onChange={(event) => updateForm('name', event.target.value)}
              placeholder="Nombre del producto"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Precio
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => updateForm('price', Number(event.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Stock
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(event) => updateForm('stock', Number(event.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            Stock mínimo
            <input
              type="number"
              min="0"
              value={form.lowStock}
              onChange={(event) => updateForm('lowStock', Number(event.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200 sm:col-span-2">
            Imagen
            <input
              value={form.image}
              onChange={(event) => updateForm('image', event.target.value)}
              placeholder="URL de la imagen"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
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

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
        >
          {editingProductId === null ? 'Crear producto' : 'Guardar cambios'}
        </button>
      </form>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="name">Ordenar por nombre</option>
          <option value="stock">Ordenar por stock</option>
          <option value="state">Ordenar por estado</option>
        </select>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[720px] bg-black/5 text-sm text-gray-900 dark:bg-white/5 dark:text-white">
          <thead className="bg-gray-100 dark:bg-white/10">
            <tr className="text-left font-semibold text-gray-700 dark:text-gray-200">
              <th className="px-4 py-3">Imagen</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {visibleProducts.length ? (
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
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${stockClass(product)}`}
                    >
                      {product.stock === 0 ? 'Sin stock' : product.stock}
                    </span>
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
