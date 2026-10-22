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
BEGIN
    -- 1. Obtener el total de la orden
    SELECT total INTO v_total FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden con ID % no existe.', p_order_id;
    END IF;

    -- 2. Actualizar el estado de la orden y el tipo de factura
    UPDATE orders
    SET current_state_id = p_paid_state_id,
        invoice_type = p_invoice_type,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 3. Calcular montos fiscales (IVA 21% incluido en el precio)
    IF p_invoice_type = 'A' THEN
        net_amount := ROUND(v_total / 1.21, 2);
        vat_amount := ROUND(v_total - net_amount, 2);
    ELSE
        net_amount := v_total;
        vat_amount := 0.00;
    END IF;

    order_id := p_order_id;
    total_amount := v_total;
    invoice_type := p_invoice_type;

    RETURN NEXT;
END;
$$;