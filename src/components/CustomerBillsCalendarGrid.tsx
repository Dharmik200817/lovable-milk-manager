import React from "react";
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
import { Button } from '@/components/ui/button';

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

interface CustomerBillsCalendarGridProps {
  selectedDate: Date;
  monthlyData: MonthlyData;
  customers: Customer[];
  selectedCustomer: string;
  pendingBalance: number;
}

export const CustomerBillsCalendarGrid = ({ selectedDate, monthlyData, customers, selectedCustomer, pendingBalance }: CustomerBillsCalendarGridProps) => {
  const daysInMonth = getDaysInMonth(selectedDate);
  const firstDayOfMonth = startOfMonth(selectedDate);
  const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sunday) to 6 (Saturday)
  const monthStartPadding = (firstDayOfWeek + 6) % 7; // Adjust to start from Monday

  const getDayData = (day: number) => {
    const date = format(addDays(firstDayOfMonth, day - 1), 'yyyy-MM-dd');
    return monthlyData[date] || {
      entries: [],
      totalMilkQuantity: 0,
      totalMilkAmount: 0,
      totalGroceryAmount: 0,
      hasDelivery: false
    };
  };

  const renderCalendarDays = () => {
    const totalCells = daysInMonth + monthStartPadding;
    const calendarDays = [];

    for (let i = 1; i <= totalCells; i++) {
      const day = i - monthStartPadding;
      const date = format(addDays(firstDayOfMonth, day - 1), 'yyyy-MM-dd');
      const dayData = day > 0 && day <= daysInMonth ? getDayData(day) : null;

      calendarDays.push(
        <td key={i} className="px-2 py-2">
          {day > 0 && day <= daysInMonth ? (
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium">{day}</span>
              {dayData?.hasDelivery && (
                <span className="text-xs text-blue-500">
                  {dayData.totalMilkQuantity} L
                </span>
              )}
            </div>
          ) : null}
        </td>
      );
    }

    const rows = [];
    for (let i = 0; i < totalCells; i += 7) {
      rows.push(
        <tr key={i}>
          {calendarDays.slice(i, i + 7)}
        </tr>
      );
    }

    return rows;
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl shadow-sm border bg-white mb-2">
      <table className="min-w-[600px] w-full text-xs sm:text-sm leading-tight">
        <thead>
          <tr>
            <th className="px-2 py-2">Mon</th>
            <th className="px-2 py-2">Tue</th>
            <th className="px-2 py-2">Wed</th>
            <th className="px-2 py-2">Thu</th>
            <th className="px-2 py-2">Fri</th>
            <th className="px-2 py-2">Sat</th>
            <th className="px-2 py-2">Sun</th>
          </tr>
        </thead>
        <tbody>
          {renderCalendarDays()}
        </tbody>
      </table>
    </div>
  );
};
