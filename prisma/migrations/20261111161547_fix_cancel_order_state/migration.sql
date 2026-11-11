DROP FUNCTION IF EXISTS sp_anular_orden_borrador(BIGINT);

CREATE OR REPLACE FUNCTION sp_anular_orden_borrador(
    p_order_id BIGINT,
    p_target_state_id BIGINT,
    p_motivo TEXT
)
RETURNS VOID AS $$
BEGIN
    IF p_target_state_id NOT IN (6, 7) THEN
        RAISE EXCEPTION
            'El estado destino debe ser Rechazado o Cancelado';
    END IF;

    PERFORM sp_cancelar_orden(
        p_order_id,
        p_target_state_id,
        p_motivo
    );
END;
$$ LANGUAGE plpgsql;