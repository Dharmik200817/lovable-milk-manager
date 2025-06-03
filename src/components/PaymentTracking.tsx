
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Calendar as CalendarIcon, Search, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Payment {
  id: string;
  customer_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  created_at: string;
}

interface CustomerBalance {
  customer_id: string;
  customer_name: string;
  pending_amount: number;
}

interface PaymentTrackingProps {
  onNavigateToDelivery?: (customerId: string) => void;
}

export const PaymentTracking = ({ onNavigateToDelivery }: PaymentTrackingProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customerBalances, setCustomerBalances] = useState<CustomerBalance[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    amount: '',
    paymentDate: new Date(),
    paymentMethod: 'Cash'
  });

  useEffect(() => {
    loadPayments();
    loadCustomerBalances();
    loadCustomers();
  }, []);

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomerBalances = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_balances_view')
        .select('*')
        .gt('pending_amount', 0)
        .order('pending_amount', { ascending: false });

      if (error) {
        console.error('Error loading customer balances:', error);
        // Fallback to manual calculation if view doesn't exist
        const { data: deliveryData, error: deliveryError } = await supabase
          .from('delivery_records')
          .select(`
            customer_id,
            total_amount,
            customers(name)
          `);

        if (deliveryError) throw deliveryError;

        const { data: paymentData, error: paymentError } = await supabase
          .from('payments')
          .select('customer_name, amount');

        if (paymentError) throw paymentError;

        // Calculate balances manually
        const balances: { [key: string]: { name: string; amount: number } } = {};
        
        deliveryData?.forEach(record => {
          const customerId = record.customer_id;
          const customerName = record.customers?.name || 'Unknown';
          
          if (!balances[customerId]) {
            balances[customerId] = { name: customerName, amount: 0 };
          }
          balances[customerId].amount += record.total_amount;
        });

        paymentData?.forEach(payment => {
          const customer = Object.entries(balances).find(([_, data]) => data.name === payment.customer_name);
          if (customer) {
            customer[1].amount -= payment.amount;
          }
        });

        const formattedBalances = Object.entries(balances)
          .filter(([_, data]) => data.amount > 0)
          .map(([customerId, data]) => ({
            customer_id: customerId,
            customer_name: data.name,
            pending_amount: data.amount
          }));

        setCustomerBalances(formattedBalances);
        return;
      }

      const formattedBalances = data?.map(balance => ({
        customer_id: balance.customer_id || '',
        customer_name: balance.customer_name || 'Unknown',
        pending_amount: balance.pending_amount || 0
      })) || [];

      setCustomerBalances(formattedBalances);
    } catch (error) {
      console.error('Error loading customer balances:', error);
      toast({
        title: "Error",
        description: "Failed to load customer balances",
        variant: "destructive"
      });
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          customer_name: formData.customerName,
          amount: Math.ceil(amount),
          payment_date: format(formData.paymentDate, 'yyyy-MM-dd'),
          payment_method: formData.paymentMethod
        });

      if (paymentError) {
        console.error('Payment error:', paymentError);
        throw paymentError;
      }

      // Update customer balance
      const customer = customers.find(c => c.name === formData.customerName);
      if (customer) {
        const { data: existingBalance } = await supabase
          .from('customer_balances')
          .select('pending_amount')
          .eq('customer_id', customer.id)
          .maybeSingle();

        const newPendingAmount = Math.max(0, Math.ceil((existingBalance?.pending_amount || 0) - amount));

        const { error: balanceError } = await supabase
          .from('customer_balances')
          .upsert({
            customer_id: customer.id,
            pending_amount: newPendingAmount,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'customer_id'
          });

        if (balanceError) {
          console.error('Balance update error:', balanceError);
          throw balanceError;
        }
      }

      toast({
        title: "Success",
        description: "Payment recorded successfully"
      });

      await loadPayments();
      await loadCustomerBalances();
      
      setFormData({
        customerName: '',
        amount: '',
        paymentDate: new Date(),
        paymentMethod: 'Cash'
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPayments = payments.filter(payment =>
    payment.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.payment_method.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.payment_date.includes(searchTerm)
  );

  const todaysPayments = payments.filter(payment => 
    payment.payment_date === format(new Date(), 'yyyy-MM-dd')
  );

  const handleViewRecords = (customerName: string) => {
    const customer = customers.find(c => c.name === customerName);
    if (customer && onNavigateToDelivery) {
      onNavigateToDelivery(customer.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Payment Tracking</h2>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customer">Customer *</Label>
                <Select value={formData.customerName} onValueChange={(value) => setFormData({ ...formData, customerName: value })} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
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
                  step="1"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g., 500"
                  required
                />
              </div>

              <div>
                <Label>Payment Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.paymentDate ? format(formData.paymentDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.paymentDate}
                      onSelect={(date) => date && setFormData({ ...formData, paymentDate: date })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="method">Payment Method *</Label>
                <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={isLoading}>
                  {isLoading ? 'Recording...' : 'Record Payment'}
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

      {/* Pending Payments Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding Balances</h3>
        {customerBalances.length === 0 ? (
          <p className="text-gray-500">No pending payments found.</p>
        ) : (
          <div className="space-y-3">
            {customerBalances.map((balance) => (
              <div key={balance.customer_id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{balance.customer_name}</p>
                  <p className="text-sm text-gray-600">Pending: ₹{Math.ceil(balance.pending_amount)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewRecords(balance.customer_name)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Records
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Today's Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{todaysPayments.length}</p>
            <p className="text-sm text-gray-500">Payments Received</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              ₹{Math.ceil(todaysPayments.reduce((sum, payment) => sum + payment.amount, 0))}
            </p>
            <p className="text-sm text-gray-500">Total Amount</p>
          </div>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by customer name, payment method, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>
      </Card>

      {/* Payments Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No payments found. Record your first payment to get started.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(payment.payment_date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ₹{Math.ceil(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.payment_method}
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
