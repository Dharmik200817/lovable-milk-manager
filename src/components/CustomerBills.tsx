import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Download, Trash2, FileText, MessageCircle } from 'lucide-react';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import { generatePDFBlob, uploadPdfAndGetUrl, BillCustomer, BillMonthlyData } from "@/utils/pdfUtils";
import { buildWhatsAppBillMessage } from "@/utils/whatsappMessage";
import { saveAs } from "file-saver";
import { CustomerBillsHeader } from "./CustomerBillsHeader";
import { CustomerBillsCalendarGrid } from "./CustomerBillsCalendarGrid";
import { CustomerBillsSummary } from "./CustomerBillsSummary";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMobile } from '@/hooks/use-mobile'; // custom hook: returns true if mobile

// Ensure Customer includes address (as in DB/table)
interface Customer {
  id: string;
  name: string;
  address: string;
  phone_number?: string;
}

interface DeliveryRecord {
  id: string;
  delivery_date: string;
  notes: string;
  quantity: number;
  total_amount: number;
  price_per_liter: number;
  milk_types: {
    name: string;
  };
  grocery_items?: {
    name: string;
    price: number;
    description: string;
  }[];
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

const BILLS_BUCKET = "bills";

export const CustomerBills = ({ preSelectedCustomerId, onViewRecords }: CustomerBillsProps) => {
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

  // Fix the typing here for sendWhatsAppBill - always pass a complete Customer (with address)
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

      // Get the public PDF link (upload if needed)
      const pdfUrl = await uploadPdfAndGetUrl({
        customer,
        selectedDate,
        pdfBlob,
      });
      if (!pdfUrl) throw new Error("Could not upload PDF for WhatsApp message.");

      // Build WhatsApp message body
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

  const generatePDF = async () => {
    if (!selectedCustomer) return;
    try {
      const pdfBlob = await generatePDFBlob({
        customer: customers.find(c => c.id === selectedCustomer),
        selectedDate,
        monthlyData,
        pendingBalance,
      });
      if (!pdfBlob) throw new Error('Could not generate PDF');
      saveAs(pdfBlob, `${customers.find(c => c.id === selectedCustomer)?.name.replace(/\s+/g, '_')}_${format(selectedDate, 'MMMM_yyyy')}.pdf`);
      toast({
        title: "Success",
        description: "Monthly bill downloaded successfully as PDF",
        duration: 2000
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF bill",
        variant: "destructive",
        duration: 2000
      });
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

  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;

  const {
    totalMilk,
    totalMilkAmount,
    totalGroceryAmount,
    totalMonthlyAmount,
    grandTotal,
  } = computeSummaryValues();

  return (
    <div className="relative min-h-[70vh]">
      <div className={isMobile
        ? "flex items-center justify-between px-2 pt-4 pb-2"
        : "flex items-center justify-between"}>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Customer Bills</h2>
      </div>
      <Card className="p-3 sm:p-6 rounded-2xl shadow-md border border-gray-100 bg-white">
        <CustomerBillsHeader
          customers={customers}
          selectedCustomer={selectedCustomer}
          setSelectedCustomer={setSelectedCustomer}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          generatePDF={generatePDF}
          // Update how sendWhatsAppBill is passed:
          sendWhatsAppBill={(customerIdOrObj) => {
            // always pass a full Customer object to sendWhatsAppBill
            // if the param is just an id (string), find the customer
            let customer: Customer | undefined;
            if (typeof customerIdOrObj === "string") {
              customer = customers.find(c => c.id === customerIdOrObj);
            } else {
              customer = customerIdOrObj;
            }
            // Ensure 'customer' includes 'address':
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
      {selectedCustomer && (
        <div className="mt-4 flex justify-center">
          {isLoading ? (
            <Card className="w-full max-w-2xl p-8 rounded-2xl shadow-sm border"> {/* mobile padding  */}
              <p className="text-center text-gray-500">Loading monthly data...</p>
            </Card>
          ) : (
            <div className="w-full">
              <Tabs defaultValue={isMobile ? "calendar" : "summary"}
                className="w-full">
                <TabsList className="w-full flex bg-gray-100 border rounded-xl mb-3 sticky top-0 z-20">
                  <TabsTrigger value="calendar" className="flex-1 text-xs sm:text-sm px-2">Details</TabsTrigger>
                  <TabsTrigger value="summary" className="flex-1 text-xs sm:text-sm px-2">Summary</TabsTrigger>
                </TabsList>
                <TabsContent value="calendar" className="w-full px-1 sm:px-2">
                  <div className="rounded-xl sm:rounded-2xl shadow-xs bg-white">
                    <CustomerBillsCalendarGrid
                      selectedDate={selectedDate}
                      monthlyData={monthlyData}
                      customers={customers}
                      selectedCustomer={selectedCustomer}
                      pendingBalance={pendingBalance}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="summary" className="px-1 sm:px-2">
                  {totalMonthlyAmount > 0 || pendingBalance > 0 ? (
                    <CustomerBillsSummary
                      totalMilk={totalMilk}
                      totalMilkAmount={totalMilkAmount}
                      totalGroceryAmount={totalGroceryAmount}
                      totalMonthlyAmount={totalMonthlyAmount}
                      pendingBalance={pendingBalance}
                      grandTotal={grandTotal}
                    />
                  ) : (
                    <div className="text-center text-gray-400 py-10">No records for this month</div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      )}
      {selectedCustomer && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-2xl border-t flex gap-2 sm:hidden">
          <Button
            size="lg"
            className="flex-1 rounded-xl shadow-md text-base"
            onClick={generatePDF}
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
