
import { format } from "date-fns";

// Utility to generate WhatsApp message for customer bill with optional pdfUrl
export function buildWhatsAppBillMessage({
  customer,
  selectedDate,
  monthlyData,
  pendingBalance,
  pdfUrl,
}: {
  customer: any;
  selectedDate: Date;
  monthlyData: any;
  pendingBalance: number;
  pdfUrl: string;
}) {
  let totalMilk = 0, totalGroceryAmount = 0, totalMilkAmount = 0;
  Object.values(monthlyData).forEach((day: any) => {
    totalMilk += day.totalMilkQuantity;
    totalGroceryAmount += day.totalGroceryAmount;
    totalMilkAmount += day.totalMilkAmount;
  });
  const totalMonthlyAmount = totalMilkAmount + totalGroceryAmount;
  const grandTotal = totalMonthlyAmount + pendingBalance;

  const monthName = format(selectedDate, "MMMM yyyy");

  return `🥛 *NARMADA DAIRY - Monthly Bill*

📋 *Customer*: ${customer.name}
📅 *Period*: ${monthName}

📊 *Bill Summary:*
• Total Milk: ${totalMilk.toFixed(1)} Liters
• Milk Amount: ${totalMilkAmount.toFixed(2)}
• Grocery Amount: ${totalGroceryAmount.toFixed(2)}
• Monthly Total: ${totalMonthlyAmount.toFixed(2)}
${pendingBalance > 0 ? `• Previous Balance: ${pendingBalance.toFixed(2)}` : ""}

💰 *TOTAL AMOUNT: ${Math.round(grandTotal)}*

📝 *Download PDF Bill*: ${pdfUrl}

Thank you for your business! 🙏
*NARMADA DAIRY*`;
}
