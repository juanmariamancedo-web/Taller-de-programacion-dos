import { OrderFormProps } from "../../types/Order"
import { useOrderForm } from "../../hooks/useorderForm"
import { ItemOrder } from "../ItemOrder"
import { OrderState, STATE_LABELS, isLogisticsRole } from "../../../../main/domain/orderStateRules"

const inputClass =
  "w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"

const labelClass = "mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
const disabledFieldClass = "cursor-not-allowed opacity-60 bg-gray-100 dark:bg-zinc-800"

export default function CreateOrderPage({ initialOrder }: OrderFormProps) {
  const {
    loadingSession, isSaving, currentOrderId, isEditing, orderStateId,
    allowedNextStates, canEditDetails, canSubmit, hasInvoice, showInvoice,
    formData, setFormData, items, stateChanged, nextStateNeedsTracking, nextStateNeedsReason,
    isTargetStatePaid, isInitialStatePaid, clients, searchTermClients, setSearchTermClients,
    isOpenClients, setIsOpenClients, addresses, searchTermAddress, setSearchTermAddress,
    isOpenAddress, setIsOpenAddress, initialStateOptions, role,
    handleAddItem, handleRemoveItem, handleUpdateItem, handleClientSelect, handleAddressSelect,
    handleCancel, handleViewInvoice, handleSubmit
  } = useOrderForm(initialOrder)

  if (loadingSession) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-gray-500">Cargando sesión...</p>
      </div>
    )
  }

  const title = !initialOrder?.id ? "Nueva Orden" : `Orden #${currentOrderId}${canEditDetails ? "" : " (solo lectura)"}`
  const subtitle = !initialOrder?.id
    ? "Ingresá los datos necesarios para registrar una nueva orden."
    : canEditDetails
    ? "Mientras la orden esté en borrador podés modificar sus datos."
    : orderStateId === OrderState.Created
    ? "La orden es un borrador del vendedor: no podés modificar sus datos, pero sí cambiar su estado."
    : "La orden ya fue confirmada: los datos y los ítems no se pueden modificar."

  const addressDisabled = !canEditDetails || (formData.clientId <= 0 && searchTermClients.trim().length === 0)
  const isCancelledOrRejectedState = orderStateId === OrderState.Cancelled || orderStateId === OrderState.Rejected

  const rawSubtotal = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)
  const isExento = formData.invoiceType === 'EXENTO'
  const netAmount = isExento ? Number((rawSubtotal / 1.21).toFixed(2)) : rawSubtotal
  const displayTotal = isExento ? netAmount : rawSubtotal

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>

        <div className="flex gap-2">
          {showInvoice && hasInvoice && isCancelledOrRejectedState ? (
            <>
              <button type="button" onClick={() => handleViewInvoice('invoice')} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Ver factura original</button>
              <button type="button" onClick={() => handleViewInvoice('credit-note')} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">Ver nota de crédito</button>
            </>
          ) : showInvoice ? (
            <button type="button" onClick={() => handleViewInvoice()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Ver comprobante</button>
          ) : null}

          <button type="button" onClick={handleCancel} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5">
            ← Volver
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col gap-6 shadow-sm">
        
        {hasInvoice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-4 border border-gray-200 dark:border-white/10">
              <label className={labelClass}>Tipo de Factura (Bloqueado)</label>
              <select disabled={true} value={formData.invoiceType} className={`${inputClass} ${disabledFieldClass}`}>
                <option value="B">Factura B</option><option value="EXENTO">Factura B - Sujeto Exento</option><option value="A">Factura A</option>
              </select>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 p-4 border border-gray-200 dark:border-white/10">
              <label className={labelClass}>Método de Pago (Bloqueado)</label>
              <select disabled={true} value={formData.paymentMethod} className={`${inputClass} ${disabledFieldClass}`}>
                <option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta de Débito">Tarjeta de Débito</option><option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
              </select>
            </div>
          </div>
        )}

        {allowedNextStates.length > 0 && (
          <div className="rounded-xl bg-blue-50/50 p-4 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300">Cambio de estado</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Estado</label>
                <select value={formData.currentStateId} onChange={(e) => setFormData((prev) => ({ ...prev, currentStateId: Number(e.target.value) }))} className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value={orderStateId}>{STATE_LABELS[orderStateId]} (actual)</option>
                  {allowedNextStates.map((stateId) => (<option key={stateId} value={stateId}>{STATE_LABELS[stateId]}</option>))}
                </select>
              </div>
              {isTargetStatePaid && !hasInvoice && (
                <>
                  <div>
                    <label className={labelClass}>Tipo de Factura <span className="text-red-500">*</span></label>
                    <select value={formData.invoiceType} onChange={(e) => setFormData((prev) => ({ ...prev, invoiceType: e.target.value as any }))} className={`${inputClass} bg-white dark:bg-zinc-900`}>
                      <option value="B">Factura B</option><option value="EXENTO">Factura B - Sujeto Exento</option><option value="A">Factura A</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Método de Pago <span className="text-red-500">*</span></label>
                    <select value={formData.paymentMethod} onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))} className={`${inputClass} bg-white dark:bg-zinc-900`}>
                      <option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta de Débito">Tarjeta de Débito</option><option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                    </select>
                  </div>
                </>
              )}
              {nextStateNeedsTracking && (
                <div>
                  <label className={labelClass}>Número de seguimiento</label>
                  <input type="text" value={formData.trackingNumber} onChange={(e) => setFormData(prev => ({...prev, trackingNumber: e.target.value}))} placeholder="Ej. TRK-98234" className={inputClass} required />
                </div>
              )}
            </div>
            {stateChanged && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isLogisticsRole(role) && (
                  <div>
                    <label className={labelClass}>Ubicación (opcional)</label>
                    <input type="text" value={formData.location} onChange={(e) => setFormData(prev => ({...prev, location: e.target.value}))} placeholder="Ej. Depósito Central" className={inputClass} />
                  </div>
                )}
                <div>
                  <label className={labelClass}>{nextStateNeedsReason ? "Motivo (obligatorio)" : "Observaciones (opcional)"}</label>
                  <input type="text" value={formData.notes} onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))} placeholder="Ej. Motivo..." className={inputClass} required={nextStateNeedsReason} />
                </div>
              </div>
            )}
          </div>
        )}

        {!initialOrder?.id && initialStateOptions.length > 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Estado inicial</label>
              <select value={formData.currentStateId} onChange={(e) => setFormData((prev) => ({ ...prev, currentStateId: Number(e.target.value) }))} className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                {initialStateOptions.map((stateId) => (<option key={stateId} value={stateId}>{STATE_LABELS[stateId]}</option>))}
              </select>
            </div>
            {isInitialStatePaid && (
              <>
                <div>
                  <label className={labelClass}>Tipo de Factura <span className="text-red-500">*</span></label>
                  <select value={formData.invoiceType} onChange={(e) => setFormData(prev => ({...prev, invoiceType: e.target.value as any}))} className={`${inputClass} bg-white dark:bg-zinc-900`}>
                    <option value="B">Factura B</option><option value="EXENTO">Factura B - Sujeto Exento</option><option value="A">Factura A</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Método de Pago <span className="text-red-500">*</span></label>
                  <select value={formData.paymentMethod} onChange={(e) => setFormData(prev => ({...prev, paymentMethod: e.target.value}))} className={`${inputClass} bg-white dark:bg-zinc-900`}>
                    <option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta de Débito">Tarjeta de Débito</option><option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="relative w-full">
            <label className={labelClass}>Cliente</label>
            <input
              type="text"
              disabled={!canEditDetails}
              className={`${inputClass} ${!canEditDetails ? disabledFieldClass : ""}`}
              placeholder="Buscar cliente..."
              value={searchTermClients}
              onChange={(e) => setSearchTermClients(e.target.value)}
              onFocus={() => setIsOpenClients(true)}
              onBlur={() => setTimeout(() => setIsOpenClients(false), 200)}
            />
            {isOpenClients && canEditDetails && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white">
                {clients.length > 0 ? clients.map((client) => (
                  <li key={String(client.id)}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleClientSelect(client)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">
                      <span>{`${client.name} ${client.lastname}`}</span>
                      <span className="text-xs text-gray-400">#{String(client.id)}</span>
                    </button>
                  </li>
                )) : (<li className="px-4 py-3 text-center text-sm text-gray-500">No se encontraron clientes</li>)}
              </ul>
            )}
          </div>

          <div className="relative w-full">
            <label className={labelClass}>Dirección de envío</label>
            <input
              type="text"
              disabled={addressDisabled}
              className={`${inputClass} ${addressDisabled ? disabledFieldClass : ""}`}
              placeholder={formData.clientId > 0 ? "Buscar dirección..." : "Seleccioná un cliente primero"}
              value={searchTermAddress}
              onChange={(e) => setSearchTermAddress(e.target.value)}
              onFocus={() => setIsOpenAddress(true)}
              onBlur={() => setTimeout(() => setIsOpenAddress(false), 200)}
            />
            {isOpenAddress && !addressDisabled && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 text-gray-900 dark:text-white">
                {addresses.length > 0 ? addresses.map((address) => (
                  <li key={String(address.id)}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleAddressSelect(address)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800">
                      <span>{`${address.street} ${address.number}`}</span>
                      <span className="text-xs text-gray-400">#{String(address.id)}</span>
                    </button>
                  </li>
                )) : (<li className="px-4 py-3 text-center text-sm text-gray-500">No se encontraron direcciones</li>)}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ítems de la orden</h2>
            {canEditDetails && (
              <button type="button" onClick={handleAddItem} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">
                + Agregar ítem
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="w-28 px-4 py-3">Cantidad</th>
                  <th className="w-36 px-4 py-3 text-right">Precio unit.</th>
                  <th className="w-32 px-4 py-3 text-right">Subtotal</th>
                  <th className="w-12 px-4 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {items.map((item) => (
                  <ItemOrder
                    key={item.id}
                    item={item}
                    disabled={!canEditDetails}
                    isOnlyItem={items.length === 1 || !canEditDetails}
                    selectedProductIds={items.map((i) => i.productId).filter((id) => id > 0)}
                    currentStateId={orderStateId}
                    onUpdateItem={handleUpdateItem}
                    onRemoveItem={handleRemoveItem}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex flex-col items-end gap-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-4">
              <span>Neto {isExento ? 'Exento' : 'Gravado'}: ${netAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              {!isExento && formData.invoiceType === 'A' && (
                <span>IVA (21%): ${(rawSubtotal - (rawSubtotal / 1.21)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-base font-bold text-gray-900 dark:text-white">
              <span>Total:</span>
              <span className="text-xl text-blue-600 dark:text-blue-400">
                ${displayTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <button type="button" onClick={handleCancel} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">
            {canSubmit ? "Cancelar" : "Volver a la lista"}
          </button>

          {canSubmit && (
            <button type="submit" disabled={isSaving} className="rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar orden"}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}