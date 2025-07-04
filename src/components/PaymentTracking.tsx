import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from 'date-fns';
import { cn } from "@/lib/utils"
import { CalendarIcon, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PendingPayments } from './PendingPayments';

interface Payment {
  id: string;
  customer_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
}

interface PaymentTrackingProps {
  onNavigateToDelivery?: (customerId: string) => void;
}

const getInitialFormData = () => ({
  customer_name: '',
  amount: '',
  payment_date: new Date().toISOString(),
  payment_method: 'Cash',
  notes: ''
});

export const PaymentTracking = ({ onNavigateToDelivery }: PaymentTrackingProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(getInitialFormData());
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadPayments();
    loadCustomers();
  }, [refreshKey]);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');
      
      if (error) {
        console.error('Error loading customers:', error);
        throw error;
      }
      
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
        duration: 2000
      });
    }
  };

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });
      
      if (error) {
        console.error('Error loading payments:', error);
        throw error;
      }
      
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setFormData(getInitialFormData());
    setDate(new Date());
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      handleResetForm();
    }
    setIsAddDialogOpen(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_name.trim() || !formData.amount || !formData.payment_date || !formData.payment_method) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
        duration: 2000
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
        duration: 2000
      });
      return;
    }

    let payment_date_iso = formData.payment_date;
    if (payment_date_iso) {
      payment_date_iso = payment_date_iso.split("T")[0];
    }

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('payments')
        .insert({
          customer_name: formData.customer_name.trim(),
          amount: parseFloat(formData.amount),
          payment_date: payment_date_iso,
          payment_method: formData.payment_method,
          notes: formData.notes.trim() || null
        });

      if (error) {
        console.error('Error saving payment:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to save payment",
          variant: "destructive",
          duration: 2000
        });
        return;
      }

      toast({
        title: "Success",
        description: "Payment added successfully",
        duration: 2000
      });

      // Refresh both payments and pending payments
      setRefreshKey(prev => prev + 1);
      
      handleResetForm();
      setIsAddDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving payment:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save payment",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentsCleared = () => {
    // Refresh data when payments are cleared
    setRefreshKey(prev => prev + 1);
  };

  const findCustomerIdByName = (customerName: string) => {
    const customer = customers.find(c => c.name === customerName);
    return customer?.id || customerName;
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Payment Tracking</h2>
        
        <Dialog open={isAddDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Select
                  value={formData.customer_name}
                  onValueChange={(value) => setFormData({ ...formData, customer_name: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.name}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g., 550.00"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="payment_date">Payment Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(newDate) => {
                        setDate(newDate);
                        setFormData({ ...formData, payment_date: newDate?.toISOString() || '' });
                      }}
                      disabled={isLoading}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Input
                  id="payment_method"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  placeholder="e.g., Cash, UPI, Card"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes"
                  disabled={isLoading}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Add Payment'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Payments Section */}
      <PendingPayments 
        onViewCustomer={onNavigateToDelivery} 
        onPaymentsCleared={handlePaymentsCleared}
      />

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Payment History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No payments found. Add your first payment to get started.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payment.customer_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">₹{payment.amount.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment.payment_date
                          ? new Date(payment.payment_date).toLocaleDateString()
                          : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.payment_method}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {payment.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigateToDelivery ? onNavigateToDelivery(findCustomerIdByName(payment.customer_name)) : null}
                        className="text-blue-600 hover:text-blue-900"
                        disabled={isLoading}
                      >
                        Delivery
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
