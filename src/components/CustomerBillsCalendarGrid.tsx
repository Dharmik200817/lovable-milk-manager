
import React from "react";
import { format, getDaysInMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface GroceryItem {
  name: string;
  price: number;
  description?: string;
}

interface DailyEntry {
  id: string;
  time: string;
  milkQuantity: number;
  milkAmount: number;
  milkType: string;
  grocery: {
    items: GroceryItem[];
    total: number;
  };
}

interface DayData {
  entries: DailyEntry[];
  totalMilkQuantity: number;
  totalMilkAmount: number;
  totalGroceryAmount: number;
  hasDelivery: boolean;
}

interface MonthlyData {
  [date: string]: DayData;
}

interface Props {
  selectedDate: Date;
  monthlyData: MonthlyData;
  customers: { id: string; name: string }[];
  selectedCustomer: string;
  pendingBalance: number;
}

export const CustomerBillsCalendarGrid: React.FC<Props> = ({
  selectedDate,
  monthlyData,
  customers,
  selectedCustomer,
  pendingBalance
}) => {
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
        {/* Days 1–15 */}
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
                    <div className="p-2 text-center border-r text-sm">{entry.time}</div>
                    <div className="p-2 text-center border-r text-sm">{entry.milkQuantity > 0 ? `${entry.milkQuantity}` : '-'}</div>
                    <div className="p-2 text-center text-sm" title={groceryDescription}>
                      {groceryTotal > 0 ? <div className="cursor-help">{groceryTotal.toFixed(2)}</div> : '-'}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        </div>
        {/* Days 16–31 */}
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
                    <div className="p-2 text-center border-r text-sm">{entry.time}</div>
                    <div className="p-2 text-center border-r text-sm">{entry.milkQuantity > 0 ? `${entry.milkQuantity}` : '-'}</div>
                    <div className="p-2 text-center text-sm group relative" title={groceryDescription}>
                      {groceryTotal > 0 ? <div className="cursor-help">{groceryTotal.toFixed(2)}</div> : '-'}
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
    </div>
  );
};
