-- Create a function to calculate customer pending balances
CREATE OR REPLACE FUNCTION get_customer_pending_balances()
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  address text,
  phone_number text,
  created_at timestamptz,
  total_deliveries numeric,
  total_payments numeric,
  pending_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.address,
    c.phone_number,
    c.created_at,
    COALESCE(deliveries.total_amount, 0) as total_deliveries,
    COALESCE(payments.total_paid, 0) as total_payments,
    COALESCE(deliveries.total_amount, 0) - COALESCE(payments.total_paid, 0) as pending_amount
  FROM customers c
  LEFT JOIN (
    SELECT 
      dr.customer_id,
      SUM(dr.total_amount) as total_amount
    FROM delivery_records dr
    GROUP BY dr.customer_id
  ) deliveries ON c.id = deliveries.customer_id
  LEFT JOIN (
    SELECT 
      c2.id as customer_id,
      SUM(p.amount) as total_paid
    FROM payments p
    JOIN customers c2 ON c2.name = p.customer_name
    GROUP BY c2.id
  ) payments ON c.id = payments.customer_id;
END;
$$ LANGUAGE plpgsql;