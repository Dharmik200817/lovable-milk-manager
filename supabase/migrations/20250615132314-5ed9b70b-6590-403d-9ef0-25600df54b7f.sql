
-- Step 1: Clean up ALL old, conflicting triggers and functions.
DROP TRIGGER IF EXISTS trg_update_balance ON public.payments;
DROP TRIGGER IF EXISTS trg_update_balance_v2 ON public.payments;
DROP TRIGGER IF EXISTS update_balance_on_payment_by_name ON public.payments;
DROP TRIGGER IF EXISTS payment_balance_change ON public.payments;

DROP FUNCTION IF EXISTS public.update_customer_balance();
DROP FUNCTION IF EXISTS public.update_balance_on_payment_by_name();

-- Step 2: Create a function to correctly update balances from delivery records.
CREATE OR REPLACE FUNCTION public.update_customer_balance_from_delivery()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.customer_balances (customer_id, pending_amount)
        VALUES (NEW.customer_id, NEW.total_amount)
        ON CONFLICT (customer_id)
        DO UPDATE SET pending_amount = customer_balances.pending_amount + NEW.total_amount;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.customer_id != NEW.customer_id THEN
            UPDATE public.customer_balances SET pending_amount = pending_amount - OLD.total_amount WHERE customer_id = OLD.customer_id;
            INSERT INTO public.customer_balances (customer_id, pending_amount) VALUES (NEW.customer_id, NEW.total_amount)
            ON CONFLICT (customer_id) DO UPDATE SET pending_amount = customer_balances.pending_amount + NEW.total_amount;
        ELSE
            UPDATE public.customer_balances SET pending_amount = pending_amount - OLD.total_amount + NEW.total_amount WHERE customer_id = NEW.customer_id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.customer_balances
        SET pending_amount = pending_amount - OLD.total_amount
        WHERE customer_id = OLD.customer_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create the trigger for delivery balance updates.
CREATE TRIGGER delivery_balance_change
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_records
FOR EACH ROW EXECUTE FUNCTION public.update_customer_balance_from_delivery();

-- Step 4: Create the function to correctly update balances from payments.
CREATE OR REPLACE FUNCTION public.update_balance_on_payment_by_name()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    SELECT id INTO v_customer_id FROM public.customers WHERE name = NEW.customer_name;
    IF v_customer_id IS NOT NULL THEN
        INSERT INTO public.customer_balances (customer_id, pending_amount)
        VALUES (v_customer_id, -NEW.amount)
        ON CONFLICT (customer_id)
        DO UPDATE SET pending_amount = customer_balances.pending_amount - NEW.amount;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create the trigger for payment balance updates.
CREATE TRIGGER payment_balance_change
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_balance_on_payment_by_name();

-- Step 6: Recalculate all historical balances.
CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
RETURNS void AS $$
BEGIN
    INSERT INTO public.customer_balances (customer_id, pending_amount)
    SELECT id, 0 FROM public.customers
    ON CONFLICT (customer_id) DO UPDATE SET pending_amount = 0;

    UPDATE public.customer_balances cb
    SET pending_amount = cb.pending_amount + agg.total_delivery_amount
    FROM (
        SELECT customer_id, COALESCE(SUM(total_amount), 0) as total_delivery_amount
        FROM public.delivery_records
        GROUP BY customer_id
    ) as agg
    WHERE cb.customer_id = agg.customer_id;

    UPDATE public.customer_balances cb
    SET pending_amount = cb.pending_amount - agg.total_payment_amount
    FROM (
        SELECT c.id as customer_id, COALESCE(SUM(p.amount), 0) as total_payment_amount
        FROM public.payments p
        JOIN public.customers c ON p.customer_name = c.name
        GROUP BY c.id
    ) as agg
    WHERE cb.customer_id = agg.customer_id;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Run the recalculation.
SELECT public.recalculate_all_balances();

-- Step 8: Drop the temporary recalculation function.
DROP FUNCTION public.recalculate_all_balances();
