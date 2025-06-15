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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [clearPasswordDialog, setClearPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingBalance, setPendingBalance] = useState(0);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);

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
      const customer = customers.find(c => c.id === selectedCustomer);
      if (!customer) return;

      const currentMonthStart = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      
      const { data: previousDeliveryData, error: deliveryError } = await supabase
        .from('delivery_records')
        .select('total_amount')
        .eq('customer_id', selectedCustomer)
        .lt('delivery_date', currentMonthStart);
      
      if (deliveryError) throw deliveryError;
      
      const { data: previousPaymentData, error: paymentError } = await supabase
        .from('payments')
        .select('amount')
        .eq('customer_name', customer.name)
        .lt('payment_date', currentMonthStart);
      
      if (paymentError) throw paymentError;
      
      const totalPreviousDelivery = previousDeliveryData?.reduce((sum, record) => sum + Number(record.total_amount), 0) || 0;
      const totalPreviousPayments = previousPaymentData?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
      
      const actualPreviousBalance = Math.max(0, totalPreviousDelivery - totalPreviousPayments);
      setPendingBalance(actualPreviousBalance);
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
        .lte('delivery_date', endDate);

      if (deliveryError) throw deliveryError;

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

      const monthData: MonthlyData = {};

      deliveryData?.forEach(record => {
        const date = record.delivery_date;
        const entryTime = record.notes?.toLowerCase().includes('evening') ? 'Evening' : 'Morning';
        const milkQuantity = record.quantity;
        const milkAmount = record.quantity * record.price_per_liter;
        
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
          description: `Outstanding balance of ${pendingBalance.toFixed(2)} cleared for ${customer.name}`,
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
      loadPendingBalance();
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
    return { totalMilk, totalMilkAmount, totalGroceryAmount, totalMonthlyAmount, grandTotal };
  };

  const {
    totalMilk,
    totalMilkAmount,
    totalGroceryAmount,
    totalMonthlyAmount,
    grandTotal,
  } = computeSummaryValues();

  const buildTableRows = () => {
    const daysInMonth = getDaysInMonth(selectedDate);
    const firstDay = startOfMonth(selectedDate);
    const rows: any[] = [];
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = addDays(firstDay, d - 1);
      const dateStr = format(dateObj, "yyyy-MM-dd");
      const readableDate = format(dateObj, "dd MMM");
      const dayData = monthlyData[dateStr];
      
      const morning = dayData?.entries.find(e =>
        e.time.toLowerCase().includes('morning')
      );
      const evening = dayData?.entries.find(e =>
        e.time.toLowerCase().includes('evening')
      );
      
      const groceryItems = morning?.grocery.items.length > 0 
        ? morning.grocery.items.map((item, idx) =>
            <span key={idx} className="text-xs">
              {item.name}
              {item.price ? ` (₹${item.price})` : ""}
              {idx !== morning.grocery.items.length - 1 ? ', ' : ''}
            </span>
          )
        : <span className="text-gray-400 text-xs">–</span>;

      rows.push(
        <TableRow key={dateStr}>
          <TableCell className="p-1 sm:p-2 text-xs font-medium">{readableDate}</TableCell>
          <TableCell className="p-1 sm:p-2 text-xs text-blue-700">
            {morning
              ? `${(morning.milkQuantity || 0).toFixed(1)}L` +
                (morning.milkType ? ` (${morning.milkType.substring(0, 3)})` : "")
              : <span className="text-gray-400">–</span>}
          </TableCell>
          <TableCell className="p-1 sm:p-2 text-xs text-purple-700">
            {evening
              ? `${(evening.milkQuantity || 0).toFixed(1)}L` +
                (evening.milkType ? ` (${evening.milkType.substring(0, 3)})` : "")
              : <span className="text-gray-400">–</span>}
          </TableCell>
          <TableCell className="p-1 sm:p-2 text-xs text-green-700">
            {groceryItems}
          </TableCell>
        </TableRow>
      );
    }
    return rows;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-4">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 pt-4 sm:pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Customer Bills</h2>
        </div>
        
        {/* Header Card */}
        <Card className="bg-white shadow-sm rounded-lg px-3 py-4 sm:px-6 sm:py-6 border border-gray-200 mb-4">
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

        {/* Main Table Card */}
        {selectedCustomer && (
          <Card className="bg-white shadow-sm rounded-lg border border-gray-200 mb-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs sm:text-sm font-semibold text-gray-700 p-2 sm:p-3">Date</TableHead>
                    <TableHead className="text-xs sm:text-sm font-semibold text-blue-700 p-2 sm:p-3">Morning</TableHead>
                    <TableHead className="text-xs sm:text-sm font-semibold text-purple-700 p-2 sm:p-3">Evening</TableHead>
                    <TableHead className="text-xs sm:text-sm font-semibold text-green-700 p-2 sm:p-3">Grocery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buildTableRows()}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-gray-50 border-t-2">
                    <TableCell className="p-2 font-bold text-xs sm:text-sm">Total:</TableCell>
                    <TableCell className="p-2 font-bold text-blue-800 text-xs sm:text-sm">
                      {totalMilk.toFixed(1)}L
                      <div className="text-xs text-gray-500">(₹{totalMilkAmount.toFixed(2)})</div>
                    </TableCell>
                    <TableCell className="p-2 text-xs sm:text-sm">–</TableCell>
                    <TableCell className="p-2 font-bold text-green-800 text-xs sm:text-sm">₹{totalGroceryAmount.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-blue-50">
                    <TableCell className="p-2 font-bold text-xs sm:text-sm">Monthly:</TableCell>
                    <TableCell className="p-2 font-bold text-blue-700 text-xs sm:text-sm" colSpan={3}>₹{totalMonthlyAmount.toFixed(2)}</TableCell>
                  </TableRow>
                  {pendingBalance > 0 && (
                    <TableRow className="bg-orange-50">
                      <TableCell className="p-2 font-semibold text-xs sm:text-sm">Previous:</TableCell>
                      <TableCell className="p-2 font-semibold text-red-700 text-xs sm:text-sm" colSpan={3}>₹{pendingBalance.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-yellow-100">
                    <TableCell className="p-2 font-bold text-xs sm:text-sm">Grand Total:</TableCell>
                    <TableCell className="p-2 font-bold text-orange-700 text-sm sm:text-base" colSpan={3}>₹{grandTotal.toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Fixed Mobile Actions */}
      {selectedCustomer && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-sm border-t shadow-lg px-2 py-2 sm:hidden">
          <div className="flex gap-2 max-w-md mx-auto">
            <Button
              size="sm"
              className="flex-1 rounded-lg text-xs h-10"
              onClick={async () => {
                if (!selectedCustomer) return;
                const pdfBlob = await generatePDFBlob({
                  customer: customers.find(c => c.id === selectedCustomer),
                  selectedDate,
                  monthlyData,
                  pendingBalance,
                });
                if (!pdfBlob) {
                  toast({ title: "Error", description: "PDF generation failed", variant: "destructive" });
                  return;
                }
                saveAs(pdfBlob, `${customers.find(c => c.id === selectedCustomer)?.name.replace(/\s+/g, '_')}_${format(selectedDate, 'MMMM_yyyy')}.pdf`);
              }}
              disabled={isLoading}
            >
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 rounded-lg text-xs h-10"
              disabled={!customers.find(c => c.id === selectedCustomer)?.phone_number}
              onClick={() => {
                const customer = customers.find(c => c.id === selectedCustomer);
                if (customer) sendWhatsAppBill(customer);
              }}
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              WhatsApp
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 rounded-lg text-xs h-10"
              onClick={() => setClearPasswordDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export { CustomerBills };
