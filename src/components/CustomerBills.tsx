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
      const groceryItems = morning
        ? morning.grocery.items.map((item, idx) =>
            <span key={idx}>
              {item.name}
              {item.price ? ` (${item.price})` : ""}
              {idx !== morning.grocery.items.length - 1 ? ', ' : ''}
            </span>
          )
        : null;

      rows.push(
        <tr key={dateStr} className="border-b last:border-b-0">
          <td className="p-1 sm:p-2 text-xs sm:text-sm text-gray-700">{readableDate}</td>
          <td className="p-1 sm:p-2 text-xs sm:text-sm text-blue-700">
            {morning
              ? `${(morning.milkQuantity || 0).toFixed(2)} L` +
                (morning.milkType ? ` (${morning.milkType})` : "")
              : <span className="text-gray-300">–</span>}
          </td>
          <td className="p-1 sm:p-2 text-xs sm:text-sm text-green-700">
            {morning && morning.grocery.items.length > 0
              ? groceryItems
              : <span className="text-gray-300">–</span>
            }
          </td>
        </tr>
      );
    }
    return rows;
  };

  return (
    <div className="relative min-h-[70vh] flex flex-col items-center">
      <div className="w-full max-w-xl flex items-center justify-between px-2 pt-6 pb-2">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Customer Bills</h2>
      </div>
      <Card className="w-full max-w-xl bg-white shadow-xl rounded-2xl px-2 py-4 sm:px-6 sm:py-6 border border-gray-100 mb-4">
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
          handleClearPayment={async () => {
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
              toast({
                title: "Error",
                description: "Failed to clear balance",
                variant: "destructive",
                duration: 2000
              });
            }
          }}
        />
      </Card>
      {selectedCustomer && (
        <Card className="w-full max-w-xl bg-white shadow-lg rounded-2xl px-2 py-4 sm:px-4 mb-16 border border-gray-100">
          <table className="min-w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-700">
                <th className="rounded-l-lg p-2 font-semibold">Date</th>
                <th className="p-2 font-semibold">Morning</th>
                <th className="rounded-r-lg p-2 font-semibold">Grocery</th>
              </tr>
            </thead>
            <tbody>
              {buildTableRows()}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50">
                <td className="p-2 font-bold text-right">Total:</td>
                <td className="p-2 font-bold text-blue-800">
                  {totalMilk.toFixed(2)} L&nbsp;
                  <span className="text-xs text-gray-400 font-normal">(₹{totalMilkAmount.toFixed(2)})</span>
                </td>
                <td className="p-2 font-bold text-green-800">₹{totalGroceryAmount.toFixed(2)}</td>
              </tr>
              <tr className="bg-purple-50">
                <td className="p-2 font-bold text-right rounded-bl-lg">Monthly:</td>
                <td className="p-2 font-bold text-purple-700" colSpan={2}>₹{totalMonthlyAmount.toFixed(2)}</td>
              </tr>
              {pendingBalance > 0 && (
                <tr className="bg-orange-50">
                  <td className="p-2 text-right font-semibold">Previous Balance:</td>
                  <td className="p-2 font-semibold text-red-700" colSpan={2}>₹{pendingBalance.toFixed(2)}</td>
                </tr>
              )}
              <tr className="bg-yellow-100">
                <td className="p-2 font-bold text-right rounded-bl-2xl">Grand Total:</td>
                <td className="p-2 font-bold text-orange-700" colSpan={2}>₹{grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {selectedCustomer && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-2xl border-t flex gap-2 sm:hidden">
          <Button
            size="lg"
            className="flex-1 rounded-xl shadow-md text-base"
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
            <Download className="w-5 h-5 mr-1" />
            Download
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 rounded-xl shadow-md text-base"
            disabled={!customers.find(c => c.id === selectedCustomer)?.phone_number}
            onClick={() => {
              const customer = customers.find(c => c.id === selectedCustomer);
              if (customer) sendWhatsAppBill(customer);
            }}>
            <MessageCircle className="w-5 h-5 mr-1" />
            WhatsApp
          </Button>
          <Button
            size="lg"
            variant="destructive"
            className="flex-1 rounded-xl shadow-md text-base"
            onClick={() => setClearPasswordDialog(true)}
          >
            <Trash2 className="w-5 h-5 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};

export { CustomerBills };
