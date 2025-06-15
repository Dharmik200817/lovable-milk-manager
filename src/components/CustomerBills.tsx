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
import { saveAs } from 'file-saver';

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

  const generatePDFBlob = async () => {
    if (!selectedCustomer) return null;
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (!customer) return null;
      const monthName = format(selectedDate, 'MMMM yyyy');
      let totalMilk = 0, totalGroceryAmount = 0, totalMilkAmount = 0;
      Object.values(monthlyData).forEach(day => {
        totalMilk += day.totalMilkQuantity;
        totalGroceryAmount += day.totalGroceryAmount;
        totalMilkAmount += day.totalMilkAmount;
      });
      const totalMonthlyAmount = totalMilkAmount + totalGroceryAmount;
      const grandTotal = totalMonthlyAmount + pendingBalance;
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      pdf.setFillColor(41,98,255); pdf.rect(0,0,pageWidth,35, 'F');
      pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold");
      pdf.setFontSize(18); pdf.text("NARMADA DAIRY", pageWidth/2,15,{align:"center"});
      pdf.setFontSize(14); pdf.text("MONTHLY BILL", pageWidth/2,25,{align:"center"});
      pdf.setTextColor(51,65,85);
      pdf.setFontSize(12); pdf.text("CUSTOMER DETAILS",20,45);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(11);
      pdf.text(`Name: ${customer.name}`,20,55);
      pdf.text(`Address: ${customer.address || 'N/A'}`,20,62);
      if (customer.phone_number) pdf.text(`Phone: ${customer.phone_number}`,20,69);
      pdf.text(`Bill Period: ${monthName}`,20,76);
      pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.5);
      pdf.line(20,82,pageWidth-20,82);
      pdf.setFont("helvetica","bold"); pdf.setFontSize(12); pdf.text("DAILY BREAKDOWN",20,92);
      pdf.setFillColor(248,250,252); pdf.rect(20,97,pageWidth-40,8, 'F');
      pdf.setTextColor(51,65,85); pdf.setFontSize(10); pdf.text("Date",25,102);
      pdf.text("Morning",55,102); pdf.text("Evening",85,102); pdf.text("Total Qty",115,102);
      pdf.text("Rate",145,102); pdf.text("Amount",165,102); pdf.text("Grocery",185,102);
      let y=112, daysInMonth = getDaysInMonth(selectedDate), rowCount=0;
      for (let day=1; day<=daysInMonth; day++) {
        const dateStr=format(new Date(selectedDate.getFullYear(),selectedDate.getMonth(),day),'yyyy-MM-dd'),
        dayData=monthlyData[dateStr];
        if(dayData?.hasDelivery){
          if(y>260){pdf.addPage();y=20;rowCount=0;}
          if(rowCount%2===0){pdf.setFillColor(250,250,250);pdf.rect(20,y-5,pageWidth-40,8, 'F');}
          let morningQty=0, eveningQty=0, totalDayAmount=0, averageRate=0, groceryTotal=0, groceryItems=[];
          dayData.entries.forEach(entry=>{
            if(entry.time==="Morning")morningQty+=entry.milkQuantity;
            else if(entry.time==="Evening")eveningQty+=entry.milkQuantity;
            totalDayAmount+=entry.milkAmount; groceryTotal+=entry.grocery.total;
            groceryItems.push(...entry.grocery.items);
          });
          const totalQty=morningQty+eveningQty;
          if(totalQty>0){averageRate=totalDayAmount/totalQty;}
          pdf.setFont("helvetica","normal"); pdf.setTextColor(51,65,85); pdf.setFontSize(9);
          pdf.text(day.toString().padStart(2,'0'),25,y);
          pdf.text(morningQty>0?`${morningQty.toFixed(1)}L`:"-",55,y);
          pdf.text(eveningQty>0?`${eveningQty.toFixed(1)}L`:"-",85,y);
          pdf.text(totalQty>0?`${totalQty.toFixed(1)}L`:"-",115,y);
          pdf.text(totalQty>0?`${Math.ceil(averageRate)}`:"-",145,y);
          pdf.text(totalDayAmount>0?`${totalDayAmount.toFixed(2)}`:"-",165,y);
          if(groceryItems.length>0){
            pdf.text(`${groceryTotal.toFixed(2)}`,185,y);
            groceryItems.forEach((item,i)=>{
              y+=4;if(y>260){pdf.addPage();y=20;rowCount=0;}
              const itemText=`- ${item.name}: ${item.price.toFixed(2)}`;
              pdf.setFontSize(7); pdf.text(itemText,185,y);
              if(item.description){y+=3;if(y>260){pdf.addPage();y=20;rowCount=0;}
                pdf.setFontSize(6); pdf.setTextColor(120,120,120);
                pdf.text(`  (${item.description})`,185,y); pdf.setTextColor(51,65,85);}
            }); pdf.setFontSize(9);
          } else {pdf.text("-",185,y);}
          y+=8;rowCount++;
        }
      }
      if(y>220){pdf.addPage();y=20;} else {y+=15;}
      pdf.setFillColor(41,98,255); pdf.rect(20,y-5,pageWidth-40,8, 'F');
      pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(12); pdf.text("BILL SUMMARY",25,y);
      y+=15;
      pdf.setTextColor(51,65,85); pdf.setFont("helvetica","normal"); pdf.setFontSize(11);
      const summaryItems=[
        [`Total Milk Quantity:`,`${totalMilk.toFixed(1)} Liters`],
        [`Milk Amount:`,`${totalMilkAmount.toFixed(2)}`],
        [`Grocery Amount:`,`${totalGroceryAmount.toFixed(2)}`],
        [`Monthly Total:`,`${totalMonthlyAmount.toFixed(2)}`]
      ];
      if(pendingBalance>0){
        summaryItems.push([`Previous Balance:`,`${pendingBalance.toFixed(2)}`]);
      }
      summaryItems.forEach(([label,value])=>{
        pdf.text(label,25,y); pdf.text(value,120,y); y+=8;
      });
      y+=5;
      pdf.setFillColor(255,248,220); pdf.rect(20,y-8,pageWidth-40,15,'F');
      pdf.setDrawColor(41,98,255); pdf.setLineWidth(1); pdf.rect(20,y-8,pageWidth-40,15);
      pdf.setFont("helvetica","bold"); pdf.setFontSize(14);
      pdf.setTextColor(41,98,255); pdf.text("TOTAL AMOUNT:",25,y); pdf.text(`${Math.round(grandTotal)}`,120,y);
      y+=20; pdf.setDrawColor(200,200,200); pdf.line(20,y,pageWidth-20,y); y+=10;
      pdf.setTextColor(100,100,100); pdf.setFont("helvetica","normal"); pdf.setFontSize(10);
      pdf.text("Thank you for your business!",pageWidth/2,y,{align:"center"}); y+=8;
      pdf.setFont("helvetica","bold"); pdf.text("NARMADA DAIRY",pageWidth/2,y,{align:"center"});
      return pdf.output('blob');
    } catch (error) {
      return null;
    }
  };

  const uploadPdfAndGetUrl = async (customer: Customer, monthName: string, pdfBlob: Blob) => {
    try {
      const fileName = `${customer.name.replace(/\s+/g,'_')}_${monthName.replace(/\s+/g,'_')}.pdf`;
      const { data, error } = await supabase
        .storage
        .from(BILLS_BUCKET)
        .upload(fileName, pdfBlob, { cacheControl: '3600', upsert: true, contentType: 'application/pdf' });
      if (error) throw error;

      const { data: publicUrlData } = supabase
        .storage
        .from(BILLS_BUCKET)
        .getPublicUrl(fileName);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }
      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('PDF upload error:', err);
      return null;
    }
  };

  const sendWhatsAppBill = async (customer: Customer) => {
    if (!customer.phone_number) {
      toast({
        title: "Error",
        description: "No phone number found for this customer",
        variant: "destructive",
        duration: 2000
      });
      return;
    }
    setIsUploadingPDF(true);
    try {
      const pdfBlob = await generatePDFBlob();
      if (!pdfBlob) throw new Error('Could not generate PDF');

      const monthName = format(selectedDate, 'MMMM yyyy');
      const publicUrl = await uploadPdfAndGetUrl(customer, monthName, pdfBlob);
      if (!publicUrl) throw new Error("Could not upload PDF for WhatsApp message.");

      let totalMilk = 0, totalGroceryAmount = 0, totalMilkAmount = 0;
      Object.values(monthlyData).forEach(day => {
        totalMilk += day.totalMilkQuantity;
        totalGroceryAmount += day.totalGroceryAmount;
        totalMilkAmount += day.totalMilkAmount;
      });
      const totalMonthlyAmount = totalMilkAmount + totalGroceryAmount;
      const grandTotal = totalMonthlyAmount + pendingBalance;
      const message = `🥛 *NARMADA DAIRY - Monthly Bill*

📋 *Customer*: ${customer.name}
📅 *Period*: ${monthName}

📊 *Bill Summary:*
• Total Milk: ${totalMilk.toFixed(1)} Liters
• Milk Amount: ${totalMilkAmount.toFixed(2)}
• Grocery Amount: ${totalGroceryAmount.toFixed(2)}
• Monthly Total: ${totalMonthlyAmount.toFixed(2)}
${pendingBalance > 0 ? `• Previous Balance: ${pendingBalance.toFixed(2)}` : ''}

💰 *TOTAL AMOUNT: ${Math.round(grandTotal)}*

📝 *Download PDF Bill*: ${publicUrl}

Thank you for your business! 🙏
*NARMADA DAIRY*`;

      const phoneNumber = customer.phone_number.replace(/\D/g, '');
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

      window.open(whatsappUrl, '_blank');

      toast({
        title: "WhatsApp Ready",
        description: "WhatsApp opened with bill and PDF link",
        duration: 3000
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to send WhatsApp bill. Try again.",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsUploadingPDF(false);
    }
  };

  const generatePDF = async () => {
    if (!selectedCustomer) return;
    try {
      const pdfBlob = await generatePDFBlob();
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

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(selectedDate);
    const monthName = format(selectedDate, 'MMMM / yyyy');
    
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

    const combineEntriesForTime = (entries: DailyEntry[]) => {
      const timeGroups: { [time: string]: DailyEntry } = {};
      
      entries.forEach(entry => {
        if (timeGroups[entry.time]) {
          timeGroups[entry.time].milkQuantity += entry.milkQuantity;
          timeGroups[entry.time].milkAmount += entry.milkAmount;
          timeGroups[entry.time].grocery.items.push(...entry.grocery.items);
          timeGroups[entry.time].grocery.total += entry.grocery.total;
        } else {
          timeGroups[entry.time] = { ...entry };
        }
      });
      
      return Object.values(timeGroups).sort((a, b) => {
        if (a.time === "Morning" && b.time !== "Morning") return -1;
        if (a.time !== "Morning" && b.time === "Morning") return 1;
        return 0;
      });
    };

    return (
      <div className="bg-white rounded-lg overflow-hidden border max-w-6xl">
        <div className="bg-blue-500 text-white text-center py-3">
          <h3 className="text-lg font-semibold">{customers.find(c => c.id === selectedCustomer)?.name}</h3>
          <p className="text-sm">{monthName}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 p-4">
          <div className="space-y-2">
            <h4 className="text-center font-medium text-gray-700 mb-3">Days 1-15</h4>
            
            <div className="grid grid-cols-4 bg-gray-100 text-xs font-medium text-gray-700 rounded-t-lg">
              <div className="p-2 text-center border-r">Date</div>
              <div className="p-2 text-center border-r">Time</div>
              <div className="p-2 text-center border-r">Qty(L)</div>
              <div className="p-2 text-center">Grocery</div>
            </div>
            
            <div className="border border-gray-200 rounded-b-lg">
              {Array.from({ length: 15 }, (_, i) => {
                const day = i + 1;
                const dateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day), 'yyyy-MM-dd');
                const dayData = monthlyData[dateStr];
                const actualDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                const formattedDate = format(actualDate, 'd MMM');
                
                if (!dayData || !dayData.hasDelivery) {
                  return (
                    <div key={day} className="grid grid-cols-4 border-b last:border-b-0">
                      <div className="p-2 text-center border-r text-sm">{formattedDate}</div>
                      <div className="p-2 text-center border-r text-sm">-</div>
                      <div className="p-2 text-center border-r text-sm">-</div>
                      <div className="p-2 text-center text-sm">-</div>
                    </div>
                  );
                }
                
                const combinedEntries = combineEntriesForTime(dayData.entries);
                
                return combinedEntries.map((entry, entryIndex) => {
                  const groceryItems = entry.grocery.items;
                  const groceryTotal = entry.grocery.total;
                  const groceryDescription = groceryItems.length > 0 
                    ? groceryItems.map(item => {
                        let desc = `${item.name}: ${item.price.toFixed(2)}`;
                        if (item.description) {
                          desc += ` (${item.description})`;
                        }
                        return desc;
                      }).join('\n')
                    : '';
                  
                  return (
                    <div 
                      key={`${day}-${entryIndex}`} 
                      className={cn(
                        "grid grid-cols-4 border-b last:border-b-0 hover:bg-gray-50",
                        entryIndex > 0 ? "border-t border-dashed border-gray-200" : ""
                      )}
                    >
                      <div className={cn(
                        "p-2 text-center border-r text-sm",
                        entryIndex === 0 ? "bg-blue-50 font-medium" : "bg-blue-50/30"
                      )}>
                        {entryIndex === 0 ? formattedDate : ""}
                      </div>
                      <div className="p-2 text-center border-r text-sm">
                        {entry.time}
                      </div>
                      <div className="p-2 text-center border-r text-sm">
                        {entry.milkQuantity > 0 ? `${entry.milkQuantity.toFixed(1)}` : '-'}
                      </div>
                      <div 
                        className="p-2 text-center text-sm" 
                        title={groceryDescription}
                      >
                        {groceryTotal > 0 ? (
                          <div className="cursor-help">
                            {groceryTotal.toFixed(2)}
                          </div>
                        ) : '-'}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-center font-medium text-gray-700 mb-3">Days 16-31</h4>
            
            <div className="grid grid-cols-4 bg-gray-100 text-xs font-medium text-gray-700 rounded-t-lg">
              <div className="p-2 text-center border-r">Date</div>
              <div className="p-2 text-center border-r">Time</div>
              <div className="p-2 text-center border-r">Qty(L)</div>
              <div className="p-2 text-center">Grocery</div>
            </div>
            
            <div className="border border-gray-200 rounded-b-lg">
              {Array.from({ length: Math.max(0, daysInMonth - 15) }, (_, i) => {
                const day = i + 16;
                if (day > daysInMonth) return null;
                
                const dateStr = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day), 'yyyy-MM-dd');
                const dayData = monthlyData[dateStr];
                const actualDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                const formattedDate = format(actualDate, 'd MMM');
                
                if (!dayData || !dayData.hasDelivery) {
                  return (
                    <div key={day} className="grid grid-cols-4 border-b last:border-b-0">
                      <div className="p-2 text-center border-r text-sm">{formattedDate}</div>
                      <div className="p-2 text-center border-r text-sm">-</div>
                      <div className="p-2 text-center border-r text-sm">-</div>
                      <div className="p-2 text-center text-sm">-</div>
                    </div>
                  );
                }
                
                const combinedEntries = combineEntriesForTime(dayData.entries);
                
                return combinedEntries.map((entry, entryIndex) => {
                  const groceryItems = entry.grocery.items;
                  const groceryTotal = entry.grocery.total;
                  const groceryDescription = groceryItems.length > 0 
                    ? groceryItems.map(item => {
                        let desc = `${item.name}: ${item.price.toFixed(2)}`;
                        if (item.description) {
                          desc += ` (${item.description})`;
                        }
                        return desc;
                      }).join('\n')
                    : '';
                  
                  return (
                    <div 
                      key={`${day}-${entryIndex}`} 
                      className={cn(
                        "grid grid-cols-4 border-b last:border-b-0 hover:bg-gray-50",
                        entryIndex > 0 ? "border-t border-dashed border-gray-200" : ""
                      )}
                    >
                      <div className={cn(
                        "p-2 text-center border-r text-sm",
                        entryIndex === 0 ? "bg-blue-50 font-medium" : "bg-blue-50/30"
                      )}>
                        {entryIndex === 0 ? formattedDate : ""}
                      </div>
                      <div className="p-2 text-center border-r text-sm">
                        {entry.time}
                      </div>
                      <div className="p-2 text-center border-r text-sm">
                        {entry.milkQuantity > 0 ? `${entry.milkQuantity.toFixed(1)}` : '-'}
                      </div>
                      <div 
                        className="p-2 text-center text-sm group relative" 
                        title={groceryDescription}
                      >
                        {groceryTotal > 0 ? (
                          <div className="cursor-help">
                            {groceryTotal.toFixed(2)}
                          </div>
                        ) : '-'}
                      </div>
                    </div>
                  );
                });
              }).filter(Boolean)}
              
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

        {(totalMonthlyAmount > 0 || pendingBalance > 0) && (
          <div className="bg-gray-50 p-6 border-t">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Monthly Summary & Balance</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Total Milk</span>
                  <span className="text-lg font-bold text-blue-600">{totalMilk.toFixed(1)} L</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Milk Amount</span>
                  <span className="text-lg font-bold text-blue-600">{totalMilkAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Grocery Amount</span>
                  <span className="text-lg font-bold text-green-600">{totalGroceryAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b-2 border-gray-400">
                  <span className="text-base font-semibold text-gray-700">Total Monthly Amount</span>
                  <span className="text-xl font-bold text-purple-600">{totalMonthlyAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3">
                {pendingBalance > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-600">Previous Balance</span>
                    <span className="text-lg font-bold text-red-600">{pendingBalance.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Current Month</span>
                  <span className="text-lg font-bold text-purple-600">{totalMonthlyAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-3 bg-yellow-50 rounded-lg px-3 border-2 border-yellow-300">
                  <span className="text-lg font-bold text-gray-800">GRAND TOTAL</span>
                  <span className="text-2xl font-bold text-orange-600">{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Customer Bills</h2>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              className="w-full flex items-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              Download PDF Bill
            </Button>
          </div>

          <div className="flex items-end">
            <Button
              onClick={async () => {
                const customer = customers.find(c => c.id === selectedCustomer);
                if (customer) await sendWhatsAppBill(customer);
              }}
              disabled={!selectedCustomer || isLoading || isUploadingPDF}
              className="w-full flex items-center bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {isUploadingPDF ? 'Preparing...' : 'Send WhatsApp Bill'}
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
                    This will clear the outstanding balance of {pendingBalance.toFixed(2)} for this customer by recording a payment. Enter password to confirm:
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
