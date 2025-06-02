
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  address: string;
}

interface CustomerBill {
  date: string;
  milkType: string;
  quantity: number;
  milkTotal: number;
  groceryItems: { name: string; price: number }[];
  totalAmount: number;
}

interface CustomerBills {
  [customerId: string]: {
    customerName: string;
    bills: CustomerBill[];
  };
}

export const CustomerBills = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerBills, setCustomerBills] = useState<CustomerBills>({});
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  useEffect(() => {
    loadCustomers();
    loadCustomerBills();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive"
      });
    }
  };

  const loadCustomerBills = async () => {
    try {
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_records')
        .select(`
          *,
          customers(name, address),
          milk_types(name)
        `)
        .order('delivery_date', { ascending: false });

      if (deliveryError) throw deliveryError;

      const { data: groceryData, error: groceryError } = await supabase
        .from('grocery_items')
        .select('*');

      if (groceryError) throw groceryError;

      const bills: CustomerBills = {};

      deliveryData?.forEach(record => {
        const customerId = record.customer_id;
        const customerName = record.customers?.name || 'Unknown';
        const date = record.delivery_date;

        if (!bills[customerId]) {
          bills[customerId] = {
            customerName,
            bills: []
          };
        }

        const relatedGroceryItems = groceryData?.filter(
          item => item.delivery_record_id === record.id
        ) || [];

        const groceryItems = relatedGroceryItems.map(item => ({
          name: item.name,
          price: item.price
        }));

        const groceryTotal = groceryItems.reduce((sum, item) => sum + item.price, 0);
        const milkTotal = record.total_amount - groceryTotal;

        bills[customerId].bills.push({
          date,
          milkType: record.milk_types?.name || 'Unknown',
          quantity: Math.round(record.quantity * 1000),
          milkTotal,
          groceryItems,
          totalAmount: record.total_amount
        });
      });

      setCustomerBills(bills);
    } catch (error) {
      console.error('Error loading customer bills:', error);
    }
  };

  const generatePDF = async (customerId: string) => {
    const customerData = customerBills[customerId];
    if (!customerData) return;

    const customer = customers.find(c => c.id === customerId);
    const filteredBills = selectedDate 
      ? customerData.bills.filter(bill => bill.date === format(selectedDate, 'yyyy-MM-dd'))
      : customerData.bills;

    if (filteredBills.length === 0) {
      toast({
        title: "No Bills",
        description: "No bills found for the selected criteria",
        variant: "destructive"
      });
      return;
    }

    const totalAmount = filteredBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    
    const pdfContent = `
NARMADA DAIRY - CUSTOMER BILL
===============================

Customer: ${customerData.customerName}
Address: ${customer?.address || 'N/A'}
${selectedDate ? `Date: ${format(selectedDate, 'dd/MM/yyyy')}` : 'All Bills'}

BILL DETAILS:
=============

${filteredBills.map(bill => `
Date: ${format(new Date(bill.date), 'dd/MM/yyyy')}
${bill.quantity > 0 ? `Milk: ${bill.milkType} - ${bill.quantity}ml - ₹${bill.milkTotal}` : ''}
${bill.groceryItems.length > 0 ? `
Grocery Items:
${bill.groceryItems.map(item => `  • ${item.name} - ₹${item.price}`).join('\n')}` : ''}
Bill Total: ₹${bill.totalAmount}
----------------------------------------
`).join('')}

GRAND TOTAL: ₹${totalAmount}

Thank you for your business!
Narmada Dairy
    `;

    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${customerData.customerName}_Bill_${selectedDate ? format(selectedDate, 'dd-MM-yyyy') : 'All'}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Success",
      description: "Bill downloaded successfully",
    });
  };

  const getFilteredBills = () => {
    if (!selectedCustomer || !customerBills[selectedCustomer]) return [];
    
    const bills = customerBills[selectedCustomer].bills;
    if (!selectedDate) return bills;
    
    return bills.filter(bill => bill.date === format(selectedDate, 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Customer Bills</h2>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Customer
            </label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Date (Optional)
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end">
            <Button
              onClick={() => selectedCustomer && generatePDF(selectedCustomer)}
              disabled={!selectedCustomer}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Bills Display */}
      {selectedCustomer && customerBills[selectedCustomer] && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Bills for {customerBills[selectedCustomer].customerName}
              </h3>
              <Button
                variant="outline"
                onClick={() => setSelectedDate(undefined)}
                disabled={!selectedDate}
              >
                Clear Date Filter
              </Button>
            </div>
            
            {getFilteredBills().length === 0 ? (
              <p className="text-gray-500">No bills found for the selected criteria.</p>
            ) : (
              <div className="space-y-3">
                {getFilteredBills().map((bill, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">
                        {format(new Date(bill.date), 'dd/MM/yyyy')}
                      </h4>
                      <span className="text-lg font-bold text-green-600">
                        ₹{bill.totalAmount}
                      </span>
                    </div>
                    
                    {bill.quantity > 0 && (
                      <div className="mb-2">
                        <p className="text-sm text-gray-700">
                          <strong>Milk:</strong> {bill.milkType} - {bill.quantity}ml 
                          <span className="text-green-600 ml-2">₹{bill.milkTotal}</span>
                        </p>
                      </div>
                    )}
                    
                    {bill.groceryItems.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Grocery Items:</p>
                        <div className="space-y-1">
                          {bill.groceryItems.map((item, itemIndex) => (
                            <p key={itemIndex} className="text-sm text-gray-600 ml-2">
                              • {item.name} - <span className="text-green-600">₹{item.price}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-lg font-bold text-blue-900">
                    Total Amount: ₹{getFilteredBills().reduce((sum, bill) => sum + bill.totalAmount, 0)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
