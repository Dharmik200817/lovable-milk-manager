
import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Trash2, FileText, MessageCircle } from "lucide-react";
import { format } from "date-fns";

// Update Customer interface to match the source of truth (must include address and phone_number)
interface Customer {
  id: string;
  name: string;
  address: string;
  phone_number?: string;
}

interface Props {
  customers: Customer[];
  selectedCustomer: string;
  setSelectedCustomer: (s: string) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  generatePDF: () => void;
  sendWhatsAppBill: (customer: Customer) => void;
  isUploadingPDF: boolean;
  isLoading: boolean;
  clearPasswordDialog: boolean;
  setClearPasswordDialog: (b: boolean) => void;
  password: string;
  setPassword: (v: string) => void;
  pendingBalance: number;
  handleClearPayment: () => void;
}

export const CustomerBillsHeader: React.FC<Props> = ({
  customers,
  selectedCustomer,
  setSelectedCustomer,
  selectedDate,
  setSelectedDate,
  generatePDF,
  sendWhatsAppBill,
  isUploadingPDF,
  isLoading,
  clearPasswordDialog,
  setClearPasswordDialog,
  password,
  setPassword,
  pendingBalance,
  handleClearPayment
}) => {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Customer and Date Selection Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            Customer
          </label>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="h-10 sm:h-10 text-xs sm:text-sm">
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map(customer => (
                <SelectItem key={customer.id} value={customer.id} className="text-xs sm:text-sm">
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            Month
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-10 sm:h-10 text-xs sm:text-sm"
              >
                <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                {selectedDate ? format(selectedDate, "MMM yyyy") : <span>Pick month</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={date => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Action Buttons Row - Desktop only */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-3 sm:gap-4">
        <Button
          onClick={generatePDF}
          disabled={!selectedCustomer || isLoading}
          className="w-full flex items-center justify-center text-xs sm:text-sm h-10"
        >
          <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden lg:inline">Download </span>PDF
        </Button>
        <Button
          onClick={() => {
            const customer = customers.find(c => c.id === selectedCustomer);
            if (!customer) {
              console.error("No customer found for selectedCustomer:", selectedCustomer);
            } else {
              sendWhatsAppBill(customer);
            }
          }}
          disabled={!selectedCustomer || isLoading || isUploadingPDF}
          className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-10"
        >
          <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden lg:inline">Send </span>WhatsApp
        </Button>
        <Dialog open={clearPasswordDialog} onOpenChange={setClearPasswordDialog}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={!selectedCustomer || isLoading || pendingBalance <= 0}
              className="w-full flex items-center justify-center text-xs sm:text-sm h-10"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Clear </span>Balance
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90vw] sm:w-full max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base">Clear Outstanding Balance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-gray-600">
                This will clear the outstanding balance of ₹{pendingBalance.toFixed(2)} for this customer by recording a payment. Enter password to confirm:
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
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleClearPayment} variant="destructive" className="flex-1 text-sm h-10">
                  Clear Balance
                </Button>
                <Button
                  onClick={() => {
                    setClearPasswordDialog(false);
                    setPassword('');
                  }}
                  variant="outline"
                  className="flex-1 text-sm h-10"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
