-- Eliminar versiones previas 
DROP FUNCTION IF EXISTS sp_actualizar_stock_producto(BIGINT, INT);
DROP FUNCTION IF EXISTS sp_anular_orden_borrador(BIGINT);
DROP FUNCTION IF EXISTS sp_actualizar_cantidad_item_orden(BIGINT, BIGINT, INT);
DROP FUNCTION IF EXISTS sp_cambiar_estado_orden(BIGINT, BIGINT, VARCHAR);
DROP FUNCTION IF EXISTS procesar_pago_orden(BIGINT, VARCHAR, BIGINT);


-- 1. ACTUALIZACIÓN SEGURA DE STOCK (Con bloqueo de fila contra concurrencia)
CREATE OR REPLACE FUNCTION sp_actualizar_stock_producto(
    p_product_id BIGINT,
    p_cantidad_delta INT
)
RETURNS INT AS $$
DECLARE
    v_stock_actual INT;
    v_nuevo_stock INT;
BEGIN
    SELECT stock INTO v_stock_actual 
    FROM products 
    WHERE id = p_product_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto con ID % no existe.', p_product_id;
    END IF;

    v_nuevo_stock := v_stock_actual + p_cantidad_delta;

    IF v_nuevo_stock < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente. El stock actual es % y se intentan descontar % unidades.', v_stock_actual, ABS(p_cantidad_delta);
    END IF;

    UPDATE products 
    SET stock = v_nuevo_stock, updated_at = NOW()
    WHERE id = p_product_id;

    RETURN v_nuevo_stock;
END;
$$ LANGUAGE plpgsql;


-- 2. ANULAR / CANCELAR BORRADOR DE ORDEN
CREATE OR REPLACE FUNCTION sp_cancelar_orden(
    p_order_id BIGINT,
    p_cancelled_state_id BIGINT,
    p_motivo TEXT
)
RETURNS VOID AS $$
DECLARE
    v_address_id BIGINT;
BEGIN
    -- Obtener la dirección de envío asociada
    SELECT shipping_address_id INTO v_address_id 
    FROM orders WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden con ID % no existe.', p_order_id;
    END IF;

    -- Actualizar el estado a Cancelado (o el ID que represente la cancelación)
    UPDATE orders 
    SET current_state_id = p_cancelled_state_id, updated_at = NOW()
    WHERE id = p_order_id;

    -- Registrar el motivo y la traza en el historial de auditoría
    INSERT INTO order_status_history (order_id, state_id, address_id, notes, created_at)
    VALUES (
        p_order_id, 
        p_cancelled_state_id, 
        v_address_id, 
        COALESCE(p_motivo, 'Orden cancelada'), 
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- 3. ACTUALIZAR CANTIDAD DE UN ÍTEM EN BORRADOR Y RECALCULAR TOTAL
CREATE OR REPLACE FUNCTION sp_actualizar_cantidad_item_orden(
    p_order_id BIGINT,
    p_product_id BIGINT,
    p_nueva_cantidad INT
)
RETURNS NUMERIC AS $$
DECLARE
    v_current_state BIGINT;
    v_nuevo_total NUMERIC := 0;
    r_item RECORD;
BEGIN
    -- Validar que la orden esté en borrador (1 = Created)
    SELECT current_state_id INTO v_current_state 
    FROM orders WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden con ID % no existe.', p_order_id;
    END IF;

    IF v_current_state <> 1 THEN
        RAISE EXCEPTION 'Solo se pueden modificar los ítems de una orden en estado de borrador.';
    END IF;

    IF p_nueva_cantidad <= 0 THEN
        -- Si la cantidad es 0 o menor, eliminamos el ítem
        DELETE FROM item_orders 
        WHERE order_id = p_order_id AND product_id = p_product_id;
    ELSE
        -- Actualizamos o insertamos la cantidad del ítem
        UPDATE item_orders 
        SET amount = p_nueva_cantidad 
        WHERE order_id = p_order_id AND product_id = p_product_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto no forma parte de esta orden.';
        END IF;
    END IF;

    -- Recalcular el total general de la orden sumando (cantidad * precio unitario) de todos sus ítems
    FOR r_item IN SELECT amount, unit_price FROM item_orders WHERE order_id = p_order_id LOOP
        v_nuevo_total := v_nuevo_total + (r_item.amount * r_item.unit_price);
    END LOOP;

    -- Actualizar el total en la tabla orders
    UPDATE orders 
    SET total = v_nuevo_total, updated_at = NOW()
    WHERE id = p_order_id;

    RETURN v_nuevo_total;
END;
$$ LANGUAGE plpgsql;


-- 4. PROCESAR PAGO
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

    IF p_invoice_type = 'A' OR p_invoice_type = 'EXENTO' THEN
        v_net := ROUND(v_total / 1.21, 2);
        v_vat := ROUND(v_total - v_net, 2);
        
        IF p_invoice_type = 'EXENTO' THEN
            v_new_total := v_net;
        ELSE
            v_new_total := v_total;
        END IF;
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


-- 5. CAMBIO CENTRALIZADO DE ESTADO Y TRAZABILIDAD
CREATE OR REPLACE FUNCTION sp_cambiar_estado_orden(
    p_order_id BIGINT,
    p_nuevo_estado_id BIGINT,
    p_notas TEXT
)
RETURNS VOID AS $$
DECLARE
    v_address_id BIGINT;
BEGIN
    -- Obtener la dirección de envío asociada a la orden
    SELECT shipping_address_id INTO v_address_id 
    FROM orders WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden con ID % no existe.', p_order_id;
    END IF;

    -- Actualizar el estado actual de la orden
    UPDATE orders 
    SET current_state_id = p_nuevo_estado_id, updated_at = NOW()
    WHERE id = p_order_id;

    -- Registrar el movimiento en el historial de estados de la orden
    INSERT INTO order_status_history (order_id, state_id, address_id, notes, created_at)
    VALUES (p_order_id, p_nuevo_estado_id, v_address_id, p_notas, NOW());
END;
$$ LANGUAGE plpgsql;