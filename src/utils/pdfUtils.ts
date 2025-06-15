import { supabase } from "@/integrations/supabase/client";
import { format, getDaysInMonth } from 'date-fns';
import jsPDF from "jspdf";

// Define the strongly-typed interfaces used in the bill generation
export interface BillCustomer {
  id: string;
  name: string;
  address: string;
  phone_number?: string;
}

export interface BillGroceryItem {
  name: string;
  price: number;
  description?: string;
}

export interface BillDailyEntry {
  id: string;
  time: string; // "Morning", "Evening"
  milkQuantity: number;
  milkAmount: number;
  milkType: string;
  grocery: {
    items: BillGroceryItem[];
    total: number;
  };
}

export interface BillMonthlyData {
  [date: string]: {
    entries: BillDailyEntry[];
    totalMilkQuantity: number;
    totalMilkAmount: number;
    totalGroceryAmount: number;
    hasDelivery: boolean;
  };
}

// Utility to generate the bill PDF and return a blob
export async function generatePDFBlob({
  customer,
  selectedDate,
  monthlyData,
  pendingBalance,
  monthlyPayments = 0, // <-- NEW
}: {
  customer: BillCustomer;
  selectedDate: Date;
  monthlyData: BillMonthlyData;
  pendingBalance: number; // This is the previous pending, passed in by CustomerBills
  monthlyPayments?: number; // <-- NEW
}) {
  try {
    // Fetch previous payments made before current month
    const currentMonthStart = format(selectedDate, 'yyyy-MM-dd');
    const { data: previousPaymentsData } = await supabase
      .from('payments')
      .select('amount, payment_date, payment_method')
      .eq('customer_name', customer.name)
      .lt('payment_date', currentMonthStart)
      .order('payment_date', { ascending: false })
      .limit(5); // Show last 5 previous payments

    const monthName = format(selectedDate, 'MMMM yyyy');
    let totalMilk = 0, totalGroceryAmount = 0, totalMilkAmount = 0;
    Object.values(monthlyData).forEach(day => {
      totalMilk += day.totalMilkQuantity;
      totalGroceryAmount += day.totalGroceryAmount;
      totalMilkAmount += day.totalMilkAmount;
    });
    const totalMonthlyAmount = totalMilkAmount + totalGroceryAmount;
    const totalOutstanding = totalMonthlyAmount + pendingBalance; // Combined outstanding
    const pendingAfterPayment = Math.max(0, totalOutstanding - (monthlyPayments || 0));

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
        pdf.text(morningQty>0?`${morningQty}L`:"-",55,y);
        pdf.text(eveningQty>0?`${eveningQty}L`:"-",85,y);
        pdf.text(totalQty>0?`${totalQty}L`:"-",115,y);
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
    if (y > 220) {pdf.addPage(); y = 20;} else {y += 15;}
    
    // Add previous payments section if any exist
    if (previousPaymentsData && previousPaymentsData.length > 0) {
      pdf.setFillColor(248,250,252); pdf.rect(20, y-5, pageWidth-40, 8, 'F');
      pdf.setTextColor(51,65,85); pdf.setFont("helvetica","bold"); pdf.setFontSize(12); 
      pdf.text("PREVIOUS PAYMENTS", 25, y);
      y += 10;
      
      pdf.setFont("helvetica","normal"); pdf.setFontSize(9);
      previousPaymentsData.forEach((payment, index) => {
        if (y > 260) { pdf.addPage(); y = 20; }
        const paymentDate = new Date(payment.payment_date).toLocaleDateString('en-IN');
        pdf.text(`${paymentDate} - ₹${payment.amount.toFixed(2)} (${payment.payment_method})`, 25, y);
        y += 6;
      });
      y += 10;
    }

    pdf.setFillColor(41,98,255); pdf.rect(20, y-5, pageWidth-40, 8, 'F');
    pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(12); pdf.text("BILL SUMMARY", 25, y);
    y += 15;
    pdf.setTextColor(51,65,85); pdf.setFont("helvetica","normal"); pdf.setFontSize(11);

    // Updated summary to show combined outstanding clearly
    const summaryItems=[
      [`Total Milk Quantity:`,`${totalMilk} Liters`],
      [`Milk Amount:`,`${totalMilkAmount.toFixed(2)}`],
      [`Grocery Amount:`,`${totalGroceryAmount.toFixed(2)}`],
      [`Current Month Total:`,`${totalMonthlyAmount.toFixed(2)}`]
    ];
    
    // Always show previous balance if any
    if (pendingBalance > 0) {
      summaryItems.push([`Previous Outstanding:`,`${pendingBalance.toFixed(2)}`]);
    }
    
    // Show combined total outstanding
    summaryItems.push([`Total Outstanding:`,`${totalOutstanding.toFixed(2)}`]);
    
    if (monthlyPayments > 0) {
      summaryItems.push([`Payment Received:`, `${monthlyPayments.toFixed(2)}`]);
      summaryItems.push([`Balance After Payment:`, `${pendingAfterPayment.toFixed(2)}`]);
    }
    
    summaryItems.forEach(([label,value])=>{
      pdf.text(label,25,y); pdf.text(value,120,y); y+=8;
    });
    y+=5;
    pdf.setFillColor(255,248,220); pdf.rect(20,y-8,pageWidth-40,15,'F');
    pdf.setDrawColor(41,98,255); pdf.setLineWidth(1); pdf.rect(20,y-8,pageWidth-40,15);
    pdf.setFont("helvetica","bold"); pdf.setFontSize(14);
    pdf.setTextColor(41,98,255);

    let totalDisplayValue = '';
    if (monthlyPayments > 0) {
      totalDisplayValue = `${Math.round(pendingAfterPayment)}`;
      pdf.text("BALANCE DUE:", 25, y);
    } else {
      totalDisplayValue = `${Math.round(totalOutstanding)}`;
      pdf.text("TOTAL OUTSTANDING:", 25, y);
    }
    pdf.text(totalDisplayValue, 120, y);

    y += 20;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, y, pageWidth-20, y);
    y += 10;
    pdf.setTextColor(100, 100, 100);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Thank you for your business!", pageWidth/2, y, {align: "center"});
    y += 8;
    pdf.setFont("helvetica", "bold");
    pdf.text("NARMADA DAIRY", pageWidth/2, y, {align: "center"});
    return pdf.output('blob');
  } catch (error) {
    return null;
  }
}
    
export async function uploadPdfAndGetUrl({
  customer,
  selectedDate,
  pdfBlob,
}: {
  customer: BillCustomer;
  selectedDate: Date;
  pdfBlob: Blob;
}) {
  const monthName = format(selectedDate, "MMMM yyyy");
  const fileName = `${customer.name.replace(/\s+/g, "_")}_${monthName.replace(/\s+/g, "_")}.pdf`;

  const { data, error } = await supabase.storage
    .from("bills")
    .upload(fileName, pdfBlob, {
      cacheControl: "3600",
      upsert: true,
      contentType: "application/pdf",
    });
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("bills")
    .getPublicUrl(fileName);

  if (!urlData?.publicUrl) throw new Error("Could not retrieve public URL for PDF.");
  return urlData.publicUrl;
}
