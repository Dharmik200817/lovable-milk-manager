import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Download, Trash2 } from 'lucide-react';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  address: string;
}

interface DeliveryRecord {
  delivery_date: string;
  notes: string;
  quantity: number;
  total_amount: number;
  milk_types: {
    name: string;
  };
  grocery_items: {
    name: string;
    price: number;
  }[];
}

interface MonthlyData {
  [date: string]: {
    morning: number;
    evening: number;
    morningGrocery: { items: Array<{name: string, price: number}>, total: number };
    eveningGrocery: { items: Array<{name: string, price: number}>, total: number };
    hasDelivery: boolean;
  };
}

export const CustomerBills = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [clearPasswordDialog, setClearPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingBalance, setPendingBalance] = useState(0);

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

  const loadPendingBalance = async () => {
    if (!selectedCustomer) return;
    
    try {
      // Calculate total delivery amount
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_records')
        .select('total_amount')
        .eq('customer_id', selectedCustomer);
      
      if (deliveryError) throw deliveryError;
      
      // Calculate total payments
      const customer = customers.find(c => c.id === selectedCustomer);
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('amount')
        .eq('customer_name', customer?.name);
      
      if (paymentError) throw paymentError;
      
      const totalDelivery = deliveryData?.reduce((sum, record) => sum + Number(record.total_amount), 0) || 0;
      const totalPayments = paymentData?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
      
      setPendingBalance(totalDelivery - totalPayments);
    } catch (error) {
      console.error('Error loading pending balance:', error);
    }
  };

  const loadMonthlyData = async () => {
    if (!selectedCustomer) return;

    try {
      setIsLoading(true);
      const startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const endDate = format(addDays(startOfMonth(selectedDate), getDaysInMonth(selectedDate) - 1), 'yyyy-MM-dd');

      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_records')
        .select(`
          delivery_date,
          notes,
          quantity,
          total_amount,
          milk_types(name)
        `)
        .eq('customer_id', selectedCustomer)
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate);

      if (deliveryError) throw deliveryError;

      const { data: groceryData, error: groceryError } = await supabase
        .from('grocery_items')
        .select(`
          name,
          price,
          delivery_records!inner(delivery_date, customer_id)
        `)
        .eq('delivery_records.customer_id', selectedCustomer)
        .gte('delivery_records.delivery_date', startDate)
        .lte('delivery_records.delivery_date', endDate);

      if (groceryError) throw groceryError;

      // Process data into monthly format
      const monthData: MonthlyData = {};

      deliveryData?.forEach(record => {
        const date = record.delivery_date;
        const isEvening = record.notes?.toLowerCase().includes('evening');
        const liters = record.quantity;

        if (!monthData[date]) {
          monthData[date] = {
            morning: 0,
            evening: 0,
            morningGrocery: { items: [], total: 0 },
            eveningGrocery: { items: [], total: 0 },
            hasDelivery: false
          };
        }

        monthData[date].hasDelivery = true;
        if (isEvening) {
          monthData[date].evening = liters;
        } else {
          monthData[date].morning = liters;
        }
      });

      // Add grocery data
      groceryData?.forEach(item => {
        const date = (item as any).delivery_records.delivery_date;
        if (monthData[date]) {
          // For now, add to morning grocery (we could enhance this to track timing)
          monthData[date].morningGrocery.items.push({
            name: item.name,
            price: item.price
          });
          monthData[date].morningGrocery.total += item.price;
        }
      });

      setMonthlyData(monthData);
    } catch (error) {
      console.error('Error loading monthly data:', error);
      toast({
        title: "Error",
        description: "Failed to load monthly data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadMonthlyData();
      loadPendingBalance();
    }
  }, [selectedCustomer, selectedDate]);

  const handleClearPayment = async () => {
    if (password !== '123') {
      toast({
        title: "Error",
        description: "Incorrect password",
        variant: "destructive"
      });
      setPassword('');
      return;
    }

    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (!customer) return;

      // Record a payment equal to the pending balance to clear it
      if (pendingBalance > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            customer_name: customer.name,
            amount: pendingBalance,
            payment_method: 'Balance Clear',
            payment_date: format(new Date(), 'yyyy-MM-dd')
          });

        if (paymentError) throw paymentError;

        toast({
          title: "Success",
          description: `Outstanding balance of ₹${pendingBalance.toFixed(2)} cleared for ${customer.name}`
        });
      } else {
        toast({
          title: "Info",
          description: "No outstanding balance to clear"
        });
      }

      setClearPasswordDialog(false);
      setPassword('');
      loadPendingBalance();
    } catch (error) {
      console.error('Error clearing balance:', error);
      toast({
        title: "Error",
        description: "Failed to clear balance",
        variant: "destructive"
      });
    }
  };

  const generatePDF = async () => {
    if (!selectedCustomer) return;

    const customer = customers.find(c => c.id === selectedCustomer);
    const monthName = format(selectedDate, 'MMMM yyyy');
    
    let totalMilk = 0;
    let totalGroceryAmount = 0;
    let totalMonthlyAmount = 0;
    
    Object.values(monthlyData).forEach(day => {
      totalMilk += day.morning + day.evening;
      totalGroceryAmount += day.morningGrocery.total + day.eveningGrocery.total;
    });

    // Calculate monthly milk amount (assuming milk price calculation)
    const milkRate = 60; // Default rate per liter
    totalMonthlyAmount = (totalMilk * milkRate) + totalGroceryAmount;

    const pdfContent = `
NARMADA DAIRY - MONTHLY BILL
=============================

Customer: ${customer?.name}
Address: ${customer?.address || 'N/A'}
Month: ${monthName}

DAILY BREAKDOWN:
================
Date  Morning  Evening  Grocery
${Array.from({ length: getDaysInMonth(selectedDate) }, (_, i) => {
  const day = i + 1;
  const dateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day), 'yyyy-MM-dd');
  const dayData = monthlyData[dateStr];
  
  if (!dayData?.hasDelivery) {
    return `${day.toString().padStart(2, '0')}    -        -        -`;
  }
  
  const morning = dayData.morning > 0 ? `${dayData.morning.toFixed(1)}L` : '-';
  const evening = dayData.evening > 0 ? `${dayData.evening.toFixed(1)}L` : '-';
  const groceryTotal = dayData.morningGrocery.total + dayData.eveningGrocery.total;
  const grocery = groceryTotal > 0 ? `₹${groceryTotal}` : '-';
  
  return `${day.toString().padStart(2, '0')}    ${morning.padEnd(8)}${evening.padEnd(9)}${grocery}`;
}).join('\n')}

SUMMARY:
========
Total Milk: ${totalMilk.toFixed(1)} Liters
Milk Amount: ₹${(totalMilk * milkRate).toFixed(2)}
Grocery Amount: ₹${totalGroceryAmount.toFixed(2)}
Total Monthly Amount: ₹${totalMonthlyAmount.toFixed(2)}
Previous Balance: ₹${pendingBalance.toFixed(2)}
Grand Total: ₹${(totalMonthlyAmount + pendingBalance).toFixed(2)}

Thank you for your business!
Narmada Dairy
    `;

    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${customer?.name}_${monthName.replace(' ', '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Success",
      description: "Monthly bill downloaded successfully"
    });
  };

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(selectedDate);
    const monthName = format(selectedDate, 'MMMM / yyyy');
    
    // Calculate totals
    let totalMilk = 0;
    let totalGrocery = 0;
    let totalMilkAmount = 0;
    const milkRate = 60; // Rate per liter
    
    Object.values(monthlyData).forEach(day => {
      totalMilk += day.morning + day.evening;
      totalGrocery += day.morningGrocery.total + day.eveningGrocery.total;
    });
    
    totalMilkAmount = totalMilk * milkRate;
    const totalMonthlyAmount = totalMilkAmount + totalGrocery;
    const grandTotal = totalMonthlyAmount + pendingBalance;

    return (
      <div className="bg-white rounded-lg overflow-hidden border max-w-6xl">
        {/* Header */}
        <div className="bg-blue-500 text-white text-center py-3">
          <h3 className="text-lg font-semibold">{customers.find(c => c.id === selectedCustomer)?.name}</h3>
          <p className="text-sm">{monthName}</p>
        </div>
        
        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-4 p-4">
          {/* Left Column: Days 1-15 */}
          <div className="space-y-2">
            <h4 className="text-center font-medium text-gray-700 mb-3">Days 1-15</h4>
            
            {/* Table Header */}
            <div className="grid grid-cols-4 bg-gray-100 text-xs font-medium text-gray-700 rounded-t-lg">
              <div className="p-2 text-center border-r">Date</div>
              <div className="p-2 text-center border-r">Morning(L)</div>
              <div className="p-2 text-center border-r">Evening(L)</div>
              <div className="p-2 text-center">Grocery(₹)</div>
            </div>
            
            {/* Days 1-15 */}
            <div className="border border-gray-200 rounded-b-lg">
              {Array.from({ length: 15 }, (_, i) => {
                const day = i + 1;
                const dateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day), 'yyyy-MM-dd');
                const dayData = monthlyData[dateStr];
                
                const groceryItems = dayData ? [...dayData.morningGrocery.items, ...dayData.eveningGrocery.items] : [];
                const groceryTotal = dayData ? dayData.morningGrocery.total + dayData.eveningGrocery.total : 0;
                const groceryDescription = groceryItems.length > 0 ? groceryItems.map(item => `${item.name}: ₹${item.price}`).join(', ') : '';
                
                return (
                  <div key={day} className="grid grid-cols-4 border-b last:border-b-0 hover:bg-gray-50">
                    <div className={cn("p-2 text-center border-r text-sm", dayData?.hasDelivery ? "bg-blue-50 font-medium" : "")}>
                      {day.toString().padStart(2, '0')}
                    </div>
                    <div className="p-2 text-center border-r text-sm">
                      {dayData?.morning > 0 ? `${dayData.morning.toFixed(1)}L` : '-'}
                    </div>
                    <div className="p-2 text-center border-r text-sm">
                      {dayData?.evening > 0 ? `${dayData.evening.toFixed(1)}L` : '-'}
                    </div>
                    <div className="p-2 text-center text-sm" title={groceryDescription}>
                      {groceryTotal > 0 ? `₹${groceryTotal}` : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Days 16-31 */}
          <div className="space-y-2">
            <h4 className="text-center font-medium text-gray-700 mb-3">Days 16-31</h4>
            
            {/* Table Header */}
            <div className="grid grid-cols-4 bg-gray-100 text-xs font-medium text-gray-700 rounded-t-lg">
              <div className="p-2 text-center border-r">Date</div>
              <div className="p-2 text-center border-r">Morning(L)</div>
              <div className="p-2 text-center border-r">Evening(L)</div>
              <div className="p-2 text-center">Grocery(₹)</div>
            </div>
            
            {/* Days 16-31 */}
            <div className="border border-gray-200 rounded-b-lg">
              {Array.from({ length: Math.max(0, daysInMonth - 15) }, (_, i) => {
                const day = i + 16;
                if (day > daysInMonth) return null;
                
                const dateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day), 'yyyy-MM-dd');
                const dayData = monthlyData[dateStr];
                
                const groceryItems = dayData ? [...dayData.morningGrocery.items, ...dayData.eveningGrocery.items] : [];
                const groceryTotal = dayData ? dayData.morningGrocery.total + dayData.eveningGrocery.total : 0;
                const groceryDescription = groceryItems.length > 0 ? groceryItems.map(item => `${item.name}: ₹${item.price}`).join(', ') : '';
                
                return (
                  <div key={day} className="grid grid-cols-4 border-b last:border-b-0 hover:bg-gray-50">
                    <div className={cn("p-2 text-center border-r text-sm", dayData?.hasDelivery ? "bg-blue-50 font-medium" : "")}>
                      {day.toString().padStart(2, '0')}
                    </div>
                    <div className="p-2 text-center border-r text-sm">
                      {dayData?.morning > 0 ? `${dayData.morning.toFixed(1)}L` : '-'}
                    </div>
                    <div className="p-2 text-center border-r text-sm">
                      {dayData?.evening > 0 ? `${dayData.evening.toFixed(1)}L` : '-'}
                    </div>
                    <div className="p-2 text-center text-sm" title={groceryDescription}>
                      {groceryTotal > 0 ? `₹${groceryTotal}` : '-'}
                    </div>
                  </div>
                );
              }).filter(Boolean)}
              
              {/* Fill empty rows if month has less than 31 days */}
              {Array.from({ length: Math.max(0, 31 - daysInMonth) }, (_, i) => (
                <div key={`empty-${i}`} className="grid grid-cols-4 border-b last:border-b-0">
                  <div className="p-2 text-center border-r text-sm text-gray-300">-</div>
                  <div className="p-2 text-center border-r text-sm">-</div>
                  <div className="p-2 text-center border-r text-sm">-</div>
                  <div className="p-2 text-center text-sm">-</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Balance Calculations Section */}
        <div className="bg-gray-50 p-6 border-t">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Monthly Summary & Balance</h3>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Left side - Monthly totals */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Total Milk</span>
                <span className="text-lg font-bold text-blue-600">{totalMilk.toFixed(1)} L</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Milk Amount (@₹{milkRate}/L)</span>
                <span className="text-lg font-bold text-blue-600">₹{totalMilkAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Grocery Amount</span>
                <span className="text-lg font-bold text-green-600">₹{totalGrocery.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b-2 border-gray-400">
                <span className="text-base font-semibold text-gray-700">Total Monthly Amount</span>
                <span className="text-xl font-bold text-purple-600">₹{totalMonthlyAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Right side - Balance calculations */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Previous Balance</span>
                <span className="text-lg font-bold text-red-600">₹{pendingBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Current Month</span>
                <span className="text-lg font-bold text-purple-600">₹{totalMonthlyAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 bg-yellow-50 rounded-lg px-3 border-2 border-yellow-300">
                <span className="text-lg font-bold text-gray-800">GRAND TOTAL</span>
                <span className="text-2xl font-bold text-orange-600">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Customer Bills</h2>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Customer
            </label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Month
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
                  {selectedDate ? format(selectedDate, "MMMM yyyy") : <span>Pick a month</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end">
            <Button
              onClick={generatePDF}
              disabled={!selectedCustomer || isLoading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Bill
            </Button>
          </div>

          <div className="flex items-end">
            <Dialog open={clearPasswordDialog} onOpenChange={setClearPasswordDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={!selectedCustomer || isLoading || pendingBalance <= 0}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Balance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear Outstanding Balance</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    This will clear the outstanding balance of ₹{pendingBalance.toFixed(2)} for this customer by recording a payment. Enter password to confirm:
                  </p>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleClearPayment();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleClearPayment} variant="destructive" className="flex-1">
                      Clear Balance
                    </Button>
                    <Button
                      onClick={() => {
                        setClearPasswordDialog(false);
                        setPassword('');
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Card>

      {/* Monthly Calendar View */}
      {selectedCustomer && (
        <div className="flex justify-center">
          {isLoading ? (
            <Card className="p-8">
              <p className="text-center text-gray-500">Loading monthly data...</p>
            </Card>
          ) : (
            renderCalendarGrid()
          )}
        </div>
      )}
    </div>
  );
};
