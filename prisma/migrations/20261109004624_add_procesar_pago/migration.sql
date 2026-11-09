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
    SELECT total INTO v_total FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden con ID % no existe.', p_order_id;
    END IF;

    IF p_invoice_type = 'A' THEN
        v_net := ROUND(v_total / 1.21, 2);
        v_vat := ROUND(v_total - v_net, 2);
        v_new_total := v_total;
        
    ELSIF p_invoice_type = 'EXENTO' THEN
        v_net := ROUND(v_total / 1.21, 2); 
        v_vat := 0.00;
        v_new_total := v_net; 
        
    ELSE
        v_net := v_total;
        v_vat := 0.00;
        v_new_total := v_total;
    END IF;

    UPDATE orders
    SET current_state_id = p_paid_state_id,
        invoice_type = p_invoice_type,
        total = v_new_total,
        updated_at = NOW()
    WHERE id = p_order_id;

    order_id := p_order_id;
    total_amount := v_new_total;
    invoice_type := p_invoice_type;
    net_amount := v_net;
    vat_amount := v_vat;

    RETURN NEXT;
END;
$$;