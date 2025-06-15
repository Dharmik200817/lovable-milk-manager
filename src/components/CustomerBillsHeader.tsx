
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
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "MMMM yyyy") : <span>Pick a month</span>}
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
          onClick={() => {
            const customer = customers.find(c => c.id === selectedCustomer);
            if (customer) sendWhatsAppBill(customer);
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
  );
};
