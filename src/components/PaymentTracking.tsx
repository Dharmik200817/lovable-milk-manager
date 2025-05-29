
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Calendar as CalendarIcon, Search, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Payment {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  pending_amount: number;
}

export const PaymentTracking = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    amount: '',
    customAmount: '',
    paymentDate: new Date(),
    paymentMethod: 'Cash',
    maxPendingAmount: 0
  });

  useEffect(() => {
    loadPayments();
    loadCustomersWithBalances();
  }, []);

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          customers(name)
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const formattedPayments = data?.map(payment => ({
        id: payment.id,
        customer_id: payment.customer_id,
        customer_name: payment.customers?.name || 'Unknown',
        amount: payment.amount,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        created_at: payment.created_at
      })) || [];

      setPayments(formattedPayments);
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

  const loadCustomersWithBalances = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          customer_balances(pending_amount)
        `)
        .order('name');

      if (error) throw error;

      const customersWithBalances = data?.map(customer => ({
        id: customer.id,
        name: customer.name,
        pending_amount: customer.customer_balances?.[0]?.pending_amount || 0
      })) || [];

      setCustomers(customersWithBalances);
    } catch (error) {
      console.error('Error loading customers:', error);
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

  const totalPendingAmount = customers.reduce((sum, customer) => sum + customer.pending_amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive"
      });
      return;
    }

    const paymentAmount = useCustomAmount ? 
      parseFloat(formData.customAmount) : 
      parseFloat(formData.amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive"
      });
      return;
    }

    if (paymentAmount > formData.maxPendingAmount) {
      toast({
        title: "Error",
        description: "Payment amount cannot exceed pending amount",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);

      // Add payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          customer_id: formData.customerId,
          amount: paymentAmount,
          payment_date: format(formData.paymentDate, 'yyyy-MM-dd'),
          payment_method: formData.paymentMethod
        });

      if (paymentError) throw paymentError;

      // Update customer balance
      const newPendingAmount = formData.maxPendingAmount - paymentAmount;

      const { error: balanceError } = await supabase
        .from('customer_balances')
        .upsert({
          customer_id: formData.customerId,
          pending_amount: newPendingAmount,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'customer_id'
        });

      if (balanceError) throw balanceError;

      toast({
        title: "Success",
        description: "Payment recorded successfully"
      });

      // Reload data and reset form
      await loadPayments();
      await loadCustomersWithBalances();
      setFormData({
        customerId: '',
        customerName: '',
        amount: '',
        customAmount: '',
        paymentDate: new Date(),
        paymentMethod: 'Cash',
        maxPendingAmount: 0
      });
      setUseCustomAmount(false);
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error adding payment:', error);
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customerId,
      customerName: customer?.name || '',
      amount: customer?.pending_amount.toString() || '0',
      maxPendingAmount: customer?.pending_amount || 0
    });
    setUseCustomAmount(false);
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
                <Select onValueChange={handleCustomerSelect} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.filter(c => c.pending_amount > 0).map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - ₹{customer.pending_amount.toFixed(2)} pending
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.customerId && (
                <>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">
                      Pending Amount: ₹{formData.maxPendingAmount.toFixed(2)}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="fullPayment"
                        name="paymentType"
                        checked={!useCustomAmount}
                        onChange={() => setUseCustomAmount(false)}
                        className="rounded"
                      />
                      <Label htmlFor="fullPayment">Pay Full Amount (₹{formData.maxPendingAmount.toFixed(2)})</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="customPayment"
                        name="paymentType"
                        checked={useCustomAmount}
                        onChange={() => setUseCustomAmount(true)}
                        className="rounded"
                      />
                      <Label htmlFor="customPayment">Pay Custom Amount</Label>
                    </div>
                  </div>

                  {useCustomAmount && (
                    <div>
                      <Label htmlFor="customAmount">Custom Amount (₹) *</Label>
                      <Input
                        id="customAmount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={formData.maxPendingAmount}
                        value={formData.customAmount}
                        onChange={(e) => setFormData({ ...formData, customAmount: e.target.value })}
                        placeholder="Enter amount"
                        required
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select 
                  value={formData.paymentMethod} 
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Today's Collections</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{todaysPayments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Pending</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalPendingAmount.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{payments
                  .filter(p => new Date(p.payment_date).getMonth() === new Date().getMonth())
                  .reduce((sum, payment) => sum + payment.amount, 0)
                  .toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Customers with Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.filter(c => c.pending_amount > 0).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Outstanding Balances */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding Balances</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pending Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.filter(customer => customer.pending_amount > 0).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-gray-500">
                    No outstanding balances
                  </td>
                </tr>
              ) : (
                customers
                  .filter(customer => customer.pending_amount > 0)
                  .sort((a, b) => b.pending_amount - a.pending_amount)
                  .map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        ₹{customer.pending_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search payments by customer name, method, or date..."
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
                      ₹{payment.amount.toFixed(2)}
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
