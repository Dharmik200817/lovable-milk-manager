
-- Clear all existing records
DELETE FROM grocery_items;
DELETE FROM delivery_records;
DELETE FROM payments;
DELETE FROM customer_balances;
DELETE FROM customers;

-- Reset any sequences if needed
-- Note: UUIDs don't use sequences, so no need to reset
