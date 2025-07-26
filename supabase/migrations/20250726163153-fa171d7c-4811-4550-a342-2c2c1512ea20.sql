-- Fix the remaining functions to have proper search path
CREATE OR REPLACE FUNCTION public.update_balance_on_payment_by_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    SELECT id INTO v_customer_id FROM customers WHERE name = NEW.customer_name;
    IF v_customer_id IS NOT NULL THEN
        INSERT INTO customer_balances (customer_id, pending_amount)
        VALUES (v_customer_id, -NEW.amount)
        ON CONFLICT (customer_id)
        DO UPDATE SET pending_amount = customer_balances.pending_amount - NEW.amount;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_balance_from_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO customer_balances (customer_id, pending_amount)
        VALUES (NEW.customer_id, NEW.total_amount)
        ON CONFLICT (customer_id)
        DO UPDATE SET pending_amount = customer_balances.pending_amount + NEW.total_amount;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.customer_id != NEW.customer_id THEN
            UPDATE customer_balances SET pending_amount = pending_amount - OLD.total_amount WHERE customer_id = OLD.customer_id;
            INSERT INTO customer_balances (customer_id, pending_amount) VALUES (NEW.customer_id, NEW.total_amount)
            ON CONFLICT (customer_id) DO UPDATE SET pending_amount = customer_balances.pending_amount + NEW.total_amount;
        ELSE
            UPDATE customer_balances SET pending_amount = pending_amount - OLD.total_amount + NEW.total_amount WHERE customer_id = NEW.customer_id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE customer_balances
        SET pending_amount = pending_amount - OLD.total_amount
        WHERE customer_id = OLD.customer_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;