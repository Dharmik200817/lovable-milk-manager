import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
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
    morningGrocery: number;
    eveningGrocery: number;
    hasDelivery: boolean;
  };
}
export const CustomerBills = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({});
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    loadCustomers();
  }, []);
  useEffect(() => {
    if (selectedCustomer) {
      loadMonthlyData();
    }
  }, [selectedCustomer, selectedDate]);
  const loadCustomers = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('customers').select('*').order('name');
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
  const loadMonthlyData = async () => {
    if (!selectedCustomer) return;
    try {
      setIsLoading(true);
      const startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const endDate = format(addDays(startOfMonth(selectedDate), getDaysInMonth(selectedDate) - 1), 'yyyy-MM-dd');
      const {
        data: deliveryData,
        error: deliveryError
      } = await supabase.from('delivery_records').select(`
          delivery_date,
          notes,
          quantity,
          total_amount,
          milk_types(name)
        `).eq('customer_id', selectedCustomer).gte('delivery_date', startDate).lte('delivery_date', endDate);
      if (deliveryError) throw deliveryError;
      const {
        data: groceryData,
        error: groceryError
      } = await supabase.from('grocery_items').select(`
          name,
          price,
          delivery_records!inner(delivery_date, customer_id)
        `).eq('delivery_records.customer_id', selectedCustomer).gte('delivery_records.delivery_date', startDate).lte('delivery_records.delivery_date', endDate);
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
            morningGrocery: 0,
            eveningGrocery: 0,
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
          monthData[date].morningGrocery += item.price;
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
  const generatePDF = async () => {
    if (!selectedCustomer) return;
    const customer = customers.find(c => c.id === selectedCustomer);
    const monthName = format(selectedDate, 'MMMM yyyy');
    let totalMilk = 0;
    let totalAmount = 0;
    Object.values(monthlyData).forEach(day => {
      totalMilk += day.morning + day.evening;
      totalAmount += day.morningGrocery + day.eveningGrocery;
    });
    const pdfContent = `
      NARMADA DAIRY - MONTHLY BILL
      =============================
      
      Customer: ${customer?.name}
      Address: ${customer?.address || 'N/A'}
      Month: ${monthName}
      
      DAILY BREAKDOWN:
      ================
      
      ${Array.from({
      length: getDaysInMonth(selectedDate)
    }, (_, i) => {
      const day = i + 1;
      const dateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day), 'yyyy-MM-dd');
      const dayData = monthlyData[dateStr];
      if (!dayData?.hasDelivery) {
        return `${day.toString().padStart(2, '0')}  -    -`;
      }
      const morning = dayData.morning > 0 ? (dayData.morning * 1000).toFixed(0) : '-';
      const evening = dayData.evening > 0 ? (dayData.evening * 1000).toFixed(0) : '-';
      return `${day.toString().padStart(2, '0')}  ${morning}  ${evening}`;
    }).join('\n')}
      
      SUMMARY:
      ========
      Total Milk: ${(totalMilk * 1000).toFixed(0)}ml
      Total Amount: ₹${totalAmount}
      
      Thank you for your business!
      Narmada Dairy
    `;
    const blob = new Blob([pdfContent], {
      type: 'text/plain'
    });
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
    return <div className="bg-white rounded-lg overflow-hidden border">
        {/* Header */}
        <div className="bg-blue-500 text-white text-center py-3">
          <h3 className="text-lg font-semibold">{customers.find(c => c.id === selectedCustomer)?.name}</h3>
          <p className="text-sm">{monthName}</p>
        </div>
        
        {/* Calendar Grid Header */}
        <div className="grid grid-cols-6 bg-gray-100 text-xs font-medium text-gray-700">
          <div className="p-2 text-center border-r">Date</div>
          <div className="p-2 text-center border-r">Morning</div>
          <div className="p-2 text-center border-r">Evening</div>
          <div className="p-2 text-center border-r">Date</div>
          <div className="p-2 text-center border-r">Morning</div>
          <div className="p-2 text-center">Evening</div>
        </div>
        
        {/* Calendar Grid Body */}
        <div className="grid grid-cols-6 text-sm">
          {Array.from({
          length: Math.ceil(daysInMonth / 2)
        }, (_, rowIndex) => {
          const leftDay = rowIndex * 2 + 1;
          const rightDay = leftDay + 1;
          const leftData = monthlyData[format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), leftDay), 'yyyy-MM-dd')];
          const rightData = rightDay <= daysInMonth ? monthlyData[format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), rightDay), 'yyyy-MM-dd')] : null;
          return <React.Fragment key={rowIndex}>
                {/* Left side */}
                <div className={cn("p-2 text-center border-r border-b", leftData?.hasDelivery ? "bg-blue-50" : "")}>
                  {leftDay.toString().padStart(2, '0')}
                </div>
                <div className="p-2 text-center border-r border-b">
                  {leftData?.morning > 0 ? (leftData.morning * 1000).toFixed(0) : '-'}
                </div>
                <div className="p-2 text-center border-r border-b">
                  {leftData?.evening > 0 ? (leftData.evening * 1000).toFixed(0) : leftData?.hasDelivery ? 'X' : '-'}
                </div>
                
                {/* Right side */}
                <div className="">
                  {rightDay <= daysInMonth ? rightDay.toString().padStart(2, '0') : '-'}
                </div>
                <div className="p-2 text-center border-r border-b">
                  {rightData?.morning > 0 ? (rightData.morning * 1000).toFixed(0) : rightDay <= daysInMonth ? '-' : ''}
                </div>
                <div className="p-2 text-center border-b">
                  {rightData?.evening > 0 ? (rightData.evening * 1000).toFixed(0) : rightData?.hasDelivery ? 'X' : rightDay <= daysInMonth ? '-' : ''}
                </div>
              </React.Fragment>;
        })}
        </div>
      </div>;
  };
  return <div className="space-y-6">
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
                {customers.map(customer => <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Month
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "MMMM yyyy") : <span>Pick a month</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={date => date && setSelectedDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end">
            <Button onClick={generatePDF} disabled={!selectedCustomer || isLoading} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download Bill
            </Button>
          </div>
        </div>
      </Card>

      {/* Monthly Calendar View */}
      {selectedCustomer && <div className="flex justify-center">
          {isLoading ? <Card className="p-8">
              <p className="text-center text-gray-500">Loading monthly data...</p>
            </Card> : renderCalendarGrid()}
        </div>}
    </div>;
};