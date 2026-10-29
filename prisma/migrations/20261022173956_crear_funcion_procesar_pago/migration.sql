CREATE OR REPLACE FUNCTION procesar_pago_orden(
    p_order_id BIGINT,
    p_invoice_type VARCHAR,
    p_paid_state_id BIGINT
)
RETURNS TABLE (
    order_id BIGINT,
    total_amount NUMERIC,
    invoice_type VARCHAR,
    net_amount NUMERIC,
    vat_amount NUMERIC
) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_total NUMERIC;
    v_new_total NUMERIC;
    v_net NUMERIC;
    v_vat NUMERIC;
BEGIN
    -- 1. Obtener el total original de la orden (con IVA incluido)
    SELECT total INTO v_total FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden con ID % no existe.', p_order_id;
    END IF;

    -- 2. Calcular montos fiscales (precios con IVA incluido)
    IF p_invoice_type = 'A' OR p_invoice_type = 'EXENTO' THEN
        v_net := ROUND(v_total / 1.21, 2);
        v_vat := ROUND(v_total - v_net, 2);
        
        -- Si es EXENTO, el cliente no paga el IVA, por lo tanto el nuevo total a cobrar es el neto
        IF p_invoice_type = 'EXENTO' THEN
            v_new_total := v_net;
        ELSE
            v_new_total := v_total; -- Factura A mantiene el total (el IVA es crédito fiscal para el inscripto)
        END IF;
    ELSE
        -- Factura B (Consumidor Final)
        v_net := v_total;
        v_vat := 0.00;
        v_new_total := v_total;
    END IF;

    -- 3. Actualizar el estado, el tipo de factura y el nuevo total ajustado en la orden
    UPDATE orders
    SET current_state_id = p_paid_state_id,
        invoice_type = p_invoice_type,
        total = v_new_total,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 4. Retornar los valores para el reporte/historial
    order_id := p_order_id;
    total_amount := v_new_total;
    invoice_type := p_invoice_type;
    net_amount := v_net;
    vat_amount := v_vat;

    RETURN NEXT;
END;
$$;