
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from '@/hooks/use-toast';

export const generateDeliveryReport = (records: any[]) => {
  if (!records || records.length === 0) {
    toast({
      title: "No Data",
      description: "There are no records to generate a report.",
      variant: "destructive",
    });
    return;
  }

  const doc = new jsPDF();
  doc.text("Delivery Report", 14, 16);
  
  const tableColumn = ["Date", "Customer", "Milk Type", "Qty (L)", "Amount (₹)"];
  const tableRows: any[][] = [];

  records.forEach(record => {
    const recordData = [
      new Date(record.delivery_date).toLocaleDateString(),
      record.customers?.name || 'N/A',
      record.milk_types?.name || 'N/A',
      record.quantity,
      record.total_amount.toFixed(2)
    ];
    tableRows.push(recordData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 20,
  });
  
  doc.save('delivery-report.pdf');
};
