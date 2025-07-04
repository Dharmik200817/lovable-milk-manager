import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { generatePDFBlob, uploadPdfAndGetUrl } from "@/utils/pdfUtils";
import { buildWhatsAppBillMessage } from "@/utils/whatsappMessage";
import { saveAs } from "file-saver";
import { CustomerBillsHeader } from "./CustomerBillsHeader";
import { Download, MessageCircle, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

interface Customer {
  id: string;
  name: string;
  address: string;
  phone_number?: string;
}

interface DailyEntry {
  id: string;
  time: string; // "Morning" or "Evening" or specific time
  milkQuantity: number;
  milkAmount: number;
  milkType: string;
  grocery: { 
    items: Array<{name: string, price: number, description?: string}>;
    total: number;
  };
}

interface MonthlyData {
  [date: string]: {
    entries: DailyEntry[];
    totalMilkQuantity: number;
    totalMilkAmount: number;
    totalGroceryAmount: number;
    hasDelivery: boolean;
  };
}

interface CustomerBillsProps {
  preSelectedCustomerId?: string;
  onViewRecords?: (customerId: string) => void;
}

const CustomerBills: React.FC<CustomerBillsProps> = ({ preSelectedCustomerId }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(preSelectedCustomerId || '');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [clearPasswordDialog, setClearPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingBalance, setPendingBalance] = useState(0);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [monthlyPayments, setMonthlyPayments] = useState(0);

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

  const loadMonthlyPayments = async () => {
    if (!selectedCustomer) {
      setMonthlyPayments(0);
      return;
    }
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (!customer) {
        setMonthlyPayments(0);
        return;
      }
      const month = selectedDate.getMonth();
      const year = selectedDate.getFullYear();
      const startOfMonthStr = format(new Date(year, month, 1), 'yyyy-MM-dd');
      const endOfMonthStr = format(new Date(year, month+1, 0), 'yyyy-MM-dd');

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("amount")
        .eq("customer_name", customer.name)
        .gte("payment_date", startOfMonthStr)
        .lte("payment_date", endOfMonthStr);

      if (paymentsError) throw paymentsError;
      const total = paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      setMonthlyPayments(total);
    } catch (err) {
      setMonthlyPayments(0);
      console.error("Error loading payments for month:", err);
    }
  };

  const loadPendingBalance = async () => {
    if (!selectedCustomer) {
      setPendingBalance(0);
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (!customer) {
        setPendingBalance(0);
        return;
      }

      // Get the current balance from customer_balances table
      const { data: balanceData, error: balanceError } = await supabase
        .from('customer_balances')
        .select('pending_amount')
        .eq('customer_id', selectedCustomer)
        .single();
      
      if (balanceError && balanceError.code !== 'PGRST116') {
        console.error('Error loading balance:', balanceError);
        setPendingBalance(0);
        return;
      }
      
      const currentBalance = balanceData?.pending_amount || 0;
      
      // Get current month's deliveries and payments to calculate previous balance
      const currentMonthStart = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      
      const { data: currentMonthDeliveries, error: deliveryError } = await supabase
        .from('delivery_records')
        .select('total_amount')
        .eq('customer_id', selectedCustomer)
        .gte('delivery_date', currentMonthStart);
      
      if (deliveryError) {
        console.error('Error loading deliveries:', deliveryError);
        setPendingBalance(Math.max(0, currentBalance));
        return;
      }
      
      const { data: currentMonthPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('customer_name', customer.name)
        .gte('payment_date', currentMonthStart);
      
      if (paymentsError) {
        console.error('Error loading payments:', paymentsError);
        setPendingBalance(Math.max(0, currentBalance));
        return;
      }
      
      const currentMonthDeliveryTotal = currentMonthDeliveries?.reduce((sum, record) => sum + Number(record.total_amount), 0) || 0;
      const currentMonthPaymentTotal = currentMonthPayments?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
      
      // Previous balance = Current balance - current month deliveries + current month payments
      const previousBalance = Math.max(0, currentBalance - currentMonthDeliveryTotal + currentMonthPaymentTotal);
      
      setPendingBalance(previousBalance);
    } catch (error) {
      console.error('Error loading pending balance:', error);
      setPendingBalance(0);
    }
  };

  const loadMonthlyData = async () => {
    if (!selectedCustomer) {
      console.log('No customer selected, clearing monthly data');
      setMonthlyData({});
      return;
    }

    try {
      setIsLoading(true);
      
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');

      console.log('Loading data for:', { 
        selectedCustomer, 
        selectedDateFormatted: format(selectedDate, 'MMMM yyyy'),
        startDate, 
        endDate 
      });

      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_records')
        .select(`
          id,
          delivery_date,
          notes,
          quantity,
          total_amount,
          price_per_liter,
          milk_types(name)
        `)
        .eq('customer_id', selectedCustomer)
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate)
        .order('delivery_date');

      if (deliveryError) throw deliveryError;

      console.log('Delivery data loaded:', deliveryData);

      const { data: groceryData, error: groceryError } = await supabase
        .from('grocery_items')
        .select(`
          name,
          price,
          description,
          delivery_records!inner(id, delivery_date, customer_id)
        `)
        .eq('delivery_records.customer_id', selectedCustomer)
        .gte('delivery_records.delivery_date', startDate)
        .lte('delivery_records.delivery_date', endDate);

      if (groceryError) throw groceryError;

      console.log('Grocery data loaded:', groceryData);

      const monthData: MonthlyData = {};

      deliveryData?.forEach(record => {
        const date = record.delivery_date;
        const entryTime = record.notes?.toLowerCase().includes('evening') ? 'Evening' : 'Morning';
        const milkQuantity = record.quantity;
        const milkAmount = record.quantity * record.price_per_liter;
        
        console.log('Processing delivery record:', { date, entryTime, milkQuantity, milkAmount });
        
        if (!monthData[date]) {
          monthData[date] = {
            entries: [],
            totalMilkQuantity: 0,
            totalMilkAmount: 0,
            totalGroceryAmount: 0,
            hasDelivery: true
          };
        }

        monthData[date].entries.push({
          id: record.id,
          time: entryTime,
          milkQuantity: milkQuantity,
          milkAmount: milkAmount,
          milkType: record.milk_types?.name || 'Unknown',
          grocery: {
            items: [],
            total: 0
          }
        });

        monthData[date].totalMilkQuantity += milkQuantity;
        monthData[date].totalMilkAmount += milkAmount;
      });

      groceryData?.forEach(item => {
        const deliveryId = (item as any).delivery_records.id;
        const deliveryDate = (item as any).delivery_records.delivery_date;
        
        if (monthData[deliveryDate]) {
          const entry = monthData[deliveryDate].entries.find(e => e.id === deliveryId);
          
          if (entry) {
            entry.grocery.items.push({
              name: item.name,
              price: item.price,
              description: item.description || ''
            });
            entry.grocery.total += item.price;
            
            monthData[deliveryDate].totalGroceryAmount += item.price;
          }
        }
      });

      console.log('Final monthly data:', monthData);
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
    if (preSelectedCustomerId && customers.length > 0) {
      setSelectedCustomer(preSelectedCustomerId);
    }
  }, [preSelectedCustomerId, customers]);

  useEffect(() => {
    if (selectedCustomer) {
      console.log('Customer or date changed, reloading data for:', selectedCustomer);
      loadPendingBalance();
      loadMonthlyPayments();
      loadMonthlyData();
    }
  }, [selectedCustomer, selectedDate, customers]);

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

      if (pendingBalance > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            customer_name: customer.name,
            amount: pendingBalance,
            payment_method: 'Balance Clear',
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            notes: 'Cleared through admin'
          });

        if (paymentError) throw paymentError;

        toast({
          title: "Success",
          description: `Outstanding balance of ₹${pendingBalance.toFixed(2)} cleared for ${customer.name}`,
          duration: 2000
        });
      } else {
        toast({
          title: "Info",
          description: "No outstanding balance to clear",
          duration: 2000
        });
      }

      setClearPasswordDialog(false);
      setPassword('');
      
      // Reload data after clearing
      loadPendingBalance();
      loadMonthlyPayments();
    } catch (error) {
      console.error('Error clearing balance:', error);
      toast({
        title: "Error",
        description: "Failed to clear balance",
        variant: "destructive",
        duration: 2000
      });
    }
  };

  const sendWhatsAppBill = async (customer: Customer) => {
    if (!customer.phone_number) {
      toast({
        title: "Error",
        description: "No phone number found for this customer",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    setIsUploadingPDF(true);
    try {
      const pdfBlob = await generatePDFBlob({
        customer,
        selectedDate,
        monthlyData,
        pendingBalance,
        monthlyPayments
      });
      if (!pdfBlob) throw new Error("Could not generate PDF");

      const pdfUrl = await uploadPdfAndGetUrl({
        customer,
        selectedDate,
        pdfBlob,
      });
      if (!pdfUrl) throw new Error("Could not upload PDF for WhatsApp message.");

      const message = buildWhatsAppBillMessage({
        customer,
        selectedDate,
        monthlyData,
        pendingBalance,
        pdfUrl,
      });

      const phoneNumber = customer.phone_number.replace(/\D/g, "");
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

      window.open(whatsappUrl, "_blank");

      toast({
        title: "WhatsApp Ready",
        description: "WhatsApp opened with bill and PDF link.",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to send WhatsApp bill. Try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsUploadingPDF(false);
    }
  };

  const computeSummaryValues = () => {
    let totalMilk = 0;
    let totalGroceryAmount = 0;
    let totalMilkAmount = 0;
    Object.values(monthlyData).forEach(day => {
      totalMilk += day.totalMilkQuantity;
      totalGroceryAmount += day.totalGroceryAmount;
      totalMilkAmount += day.totalMilkAmount;
    });
    const totalMonthlyAmount = totalMilkAmount + totalGroceryAmount;
    const grandTotal = totalMonthlyAmount + pendingBalance;
    const pendingAfterPayment = Math.max(0, grandTotal - monthlyPayments);
    return { totalMilk, totalMilkAmount, totalGroceryAmount, totalMonthlyAmount, grandTotal, pendingAfterPayment };
  };

  const {
    totalMilk,
    totalMilkAmount,
    totalGroceryAmount,
    totalMonthlyAmount,
    grandTotal,
    pendingAfterPayment
  } = computeSummaryValues();

  const buildTableRows = () => {
    const daysInMonth = getDaysInMonth(selectedDate);
    const firstDay = startOfMonth(selectedDate);
    const rows: any[] = [];
    
    console.log('Building table rows for month:', format(selectedDate, 'MMMM yyyy'));
    console.log('Days in month:', daysInMonth);
    console.log('Monthly data keys:', Object.keys(monthlyData));
    
    const leftColumnDays = [];
    const rightColumnDays = [];
    
    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= 15) {
        leftColumnDays.push(d);
      } else {
        rightColumnDays.push(d);
      }
    }

    const maxRows = Math.max(leftColumnDays.length, rightColumnDays.length);
    
    for (let i = 0; i < maxRows; i++) {
      const leftDay = leftColumnDays[i];
      const rightDay = rightColumnDays[i];
      
      const getDataForDay = (day: number | undefined) => {
        if (!day) return { morning: '', evening: '', grocery: '' };
        
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const dateObj = new Date(year, month, day);
        const dateStr = format(dateObj, "yyyy-MM-dd");
        const dayData = monthlyData[dateStr];
        
        console.log(`Day ${day} (${dateStr}):`, dayData ? 'has data' : 'no data');
        
        if (!dayData || !dayData.hasDelivery) {
          return { morning: '', evening: '', grocery: '' };
        }
        
        let morningQty = 0;
        let eveningQty = 0;
        let groceryTotal = 0;
        
        dayData.entries.forEach(entry => {
          if (entry.time.toLowerCase().includes('morning')) {
            morningQty += entry.milkQuantity;
          } else if (entry.time.toLowerCase().includes('evening')) {
            eveningQty += entry.milkQuantity;
          } else {
            morningQty += entry.milkQuantity;
          }
          groceryTotal += entry.grocery.total;
        });
        
        const morningDisplay = morningQty > 0 ? `${morningQty.toFixed(1)}L` : '';
        const eveningDisplay = eveningQty > 0 ? `${eveningQty.toFixed(1)}L` : '';
        const groceryDisplay = groceryTotal > 0 ? `₹${groceryTotal.toFixed(0)}` : '';
        
        return { morning: morningDisplay, evening: eveningDisplay, grocery: groceryDisplay };
      };

      const leftData = getDataForDay(leftDay);
      const rightData = getDataForDay(rightDay);

      rows.push(
        <TableRow key={i} className="border-b">
          <TableCell className="text-center text-xs sm:text-sm font-medium p-1 sm:p-2 w-8 sm:w-12 border-r">
            {leftDay || ''}
          </TableCell>
          <TableCell className="text-center text-xs p-1 w-12 sm:w-16 border-r text-blue-600">
            {leftData.morning}
          </TableCell>
          <TableCell className="text-center text-xs p-1 w-12 sm:w-16 border-r text-purple-600">
            {leftData.evening}
          </TableCell>
          <TableCell className="text-center text-xs p-1 w-14 sm:w-20 border-r text-green-600">
            {leftData.grocery}
          </TableCell>
          <TableCell className="text-center text-xs sm:text-sm font-medium p-1 sm:p-2 w-8 sm:w-12 border-r">
            {rightDay || ''}
          </TableCell>
          <TableCell className="text-center text-xs p-1 w-12 sm:w-16 border-r text-blue-600">
            {rightData.morning}
          </TableCell>
          <TableCell className="text-center text-xs p-1 w-12 sm:w-16 border-r text-purple-600">
            {rightData.evening}
          </TableCell>
          <TableCell className="text-center text-xs p-1 w-14 sm:w-20 text-green-600">
            {rightData.grocery}
          </TableCell>
        </TableRow>
      );
    }
    return rows;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-4">
      <div className="max-w-6xl mx-auto px-2 sm:px-4 pt-2 sm:pt-6">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <h2 className="text-base sm:text-xl lg:text-2xl font-bold text-gray-900">Customer Bills</h2>
        </div>
        
        {/* Header Card */}
        <Card className="bg-white shadow-sm rounded-lg px-2 py-3 sm:px-6 sm:py-6 border border-gray-200 mb-2 sm:mb-4">
          <CustomerBillsHeader
            customers={customers}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            generatePDF={async () => {
              if (!selectedCustomer) return;
              const pdfBlob = await generatePDFBlob({
                customer: customers.find(c => c.id === selectedCustomer),
                selectedDate,
                monthlyData,
                pendingBalance,
                monthlyPayments
              });
              if (!pdfBlob) {
                toast({ title: "Error", description: "PDF generation failed", variant: "destructive" });
                return;
              }
              saveAs(pdfBlob, `${customers.find(c => c.id === selectedCustomer)?.name.replace(/\s+/g, '_')}_${format(selectedDate, 'MMMM_yyyy')}.pdf`);
            }}
            sendWhatsAppBill={(customerIdOrObj) => {
              let customer: Customer | undefined;
              if (typeof customerIdOrObj === "string") {
                customer = customers.find(c => c.id === customerIdOrObj);
              } else {
                customer = customerIdOrObj;
              }
              if (customer && typeof customer.address === "string" && customer.address.trim() !== "") {
                sendWhatsAppBill(customer);
              } else {
                toast({
                  title: "Error",
                  description: "Customer details not found or incomplete.",
                  variant: "destructive"
                });
              }
            }}
            isUploadingPDF={isUploadingPDF}
            isLoading={isLoading}
            clearPasswordDialog={clearPasswordDialog}
            setClearPasswordDialog={setClearPasswordDialog}
            password={password}
            setPassword={setPassword}
            pendingBalance={pendingBalance}
            handleClearPayment={handleClearPayment}
          />
        </Card>

        {/* Main Bill Card */}
        {selectedCustomer && (
          <Card className="bg-white shadow-sm rounded-lg border border-gray-200 mb-4">
            <div className="p-2 sm:p-4 lg:p-6">
              {/* Bill Header */}
              <div className="text-center mb-4 sm:mb-6 border-b-2 border-blue-500 pb-3 sm:pb-4">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-blue-600 mb-1 sm:mb-2">NARMADA DAIRY</h1>
                <h2 className="text-sm sm:text-lg lg:text-xl font-semibold text-gray-700">Monthly Bill</h2>
                <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-600">
                  <p className="font-medium text-sm sm:text-base">{customers.find(c => c.id === selectedCustomer)?.name}</p>
                  <p className="text-xs sm:text-sm">{format(selectedDate, 'MMMM yyyy')}</p>
                </div>
              </div>

              {/* Traditional Table Layout */}
              <div className="overflow-x-auto mb-4 sm:mb-6">
                <Table className="w-full border-2 border-gray-400 min-w-[300px]">
                  <TableHeader>
                    <TableRow className="bg-blue-50 border-b-2 border-gray-400">
                      <TableHead className="text-center text-xs sm:text-sm font-bold border-r border-gray-400 p-1 sm:p-2">Date</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm font-bold border-r border-gray-400 p-1">Morning</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm font-bold border-r border-gray-400 p-1">Evening</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm font-bold border-r border-gray-400 p-1">Grocery</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm font-bold border-r border-gray-400 p-1 sm:p-2">Date</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm font-bold border-r border-gray-400 p-1">Morning</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm font-bold border-r border-gray-400 p-1">Evening</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm font-bold p-1">Grocery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildTableRows()}
                  </TableBody>
                </Table>
              </div>

              {/* Summary Section */}
              <div className="border-t-2 border-gray-300 pt-3 sm:pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
                  <div className="bg-blue-50 p-2 sm:p-3 rounded">
                    <p className="text-xs text-gray-600">Total Milk</p>
                    <p className="text-sm sm:text-lg font-bold text-blue-600">{totalMilk.toFixed(1)}L</p>
                  </div>
                  <div className="bg-green-50 p-2 sm:p-3 rounded">
                    <p className="text-xs text-gray-600">Milk Amount</p>
                    <p className="text-sm sm:text-lg font-bold text-green-600">₹{totalMilkAmount.toFixed(0)}</p>
                  </div>
                  <div className="bg-purple-50 p-2 sm:p-3 rounded">
                    <p className="text-xs text-gray-600">Grocery</p>
                    <p className="text-sm sm:text-lg font-bold text-purple-600">₹{totalGroceryAmount.toFixed(0)}</p>
                  </div>
                  <div className="bg-yellow-50 p-2 sm:p-3 rounded border-2 border-yellow-400">
                    <p className="text-xs text-gray-600">Grand Total</p>
                    <p className="text-base sm:text-xl font-bold text-orange-600">₹{grandTotal.toFixed(0)}</p>
                  </div>
                </div>

                {/* Always show previous balance */}
                <div className="mt-3 text-center">
                  <div className="inline-block bg-red-50 px-3 sm:px-4 py-2 rounded border-2 border-red-200">
                    <p className="text-xs sm:text-sm text-gray-600">
                      Previous Balance: <span className="text-red-600 font-bold">₹{pendingBalance.toFixed(0)}</span>
                    </p>
                  </div>
                </div>

                {/* Show payments made this month IF any */}
                {monthlyPayments > 0 && (
                  <div className="mt-3 text-center">
                    <div className="inline-block bg-green-50 px-3 sm:px-4 py-2 rounded border-2 border-green-200">
                      <p className="text-xs sm:text-sm text-gray-600">
                        Payment Received: <span className="text-green-700 font-bold">₹{monthlyPayments.toFixed(0)}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* If payment is partial, show pending after payment */}
                {monthlyPayments > 0 && pendingAfterPayment > 0 && (
                  <div className="mt-3 text-center">
                    <div className="inline-block bg-yellow-50 px-3 sm:px-4 py-2 rounded border-2 border-yellow-400">
                      <p className="text-xs sm:text-sm text-gray-800 font-semibold">
                        Pending After Payment: <span className="text-orange-600 font-bold">₹{pendingAfterPayment.toFixed(0)}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* If the bill is fully paid, show a badge */}
                {monthlyPayments > 0 && pendingAfterPayment === 0 && (
                  <div className="mt-3 text-center">
                    <span className="inline-block bg-green-100 text-green-800 font-bold rounded px-4 py-2 border border-green-300">
                      Bill fully paid!
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Fixed Mobile Actions */}
      {selectedCustomer && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-sm border-t shadow-lg px-3 py-3 sm:hidden">
          <div className="flex gap-2 max-w-md mx-auto">
            <Button
              size="lg"
              className="flex-1 rounded-lg text-sm h-12 font-medium"
              onClick={async () => {
                if (!selectedCustomer) return;
                const pdfBlob = await generatePDFBlob({
                  customer: customers.find(c => c.id === selectedCustomer),
                  selectedDate,
                  monthlyData,
                  pendingBalance,
                  monthlyPayments
                });
                if (!pdfBlob) {
                  toast({ title: "Error", description: "PDF generation failed", variant: "destructive" });
                  return;
                }
                saveAs(pdfBlob, `${customers.find(c => c.id === selectedCustomer)?.name.replace(/\s+/g, '_')}_${format(selectedDate, 'MMMM_yyyy')}.pdf`);
              }}
              disabled={isLoading}
            >
              <Download className="w-5 h-5 mr-2" />
              PDF
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 rounded-lg text-sm h-12 font-medium bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              disabled={!customers.find(c => c.id === selectedCustomer)?.phone_number}
              onClick={() => {
                const customer = customers.find(c => c.id === selectedCustomer);
                if (customer) sendWhatsAppBill(customer);
              }}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              WhatsApp
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="flex-1 rounded-lg text-sm h-12 font-medium"
              onClick={() => setClearPasswordDialog(true)}
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export { CustomerBills };
