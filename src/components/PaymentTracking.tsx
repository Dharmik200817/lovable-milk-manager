
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Check, X, CreditCard } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Payment {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
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
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    isCustomAmount: false,
    pendingAmount: 0
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
        payment_method: payment.payment_method
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
      console.error('Error loading customers with balances:', error);
    }
  };

  const filteredPayments = payments.filter(payment =>
    payment.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.payment_method.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const customersWithPendingBalance = customers.filter(c => c.pending_amount > 0);
  const totalPendingAmount = customersWithPendingBalance.reduce((sum, customer) => sum + customer.pending_amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId || !formData.amount) {
      toast({
        title: "Error",
        description: "Customer and amount are required fields",
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

    if (!formData.isCustomAmount && amount > formData.pendingAmount) {
      toast({
        title: "Error",
        description: "Payment amount cannot be greater than pending amount",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Insert payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          customer_id: formData.customerId,
          amount,
          payment_date: formData.paymentDate,
          payment_method: formData.paymentMethod || 'Cash'
        });

      if (paymentError) throw paymentError;

      // Update customer balance
      const newPendingAmount = Math.max(0, formData.pendingAmount - amount);
      
      const { error: balanceError } = await supabase
        .from('customer_balances')
        .update({
          pending_amount: newPendingAmount,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', formData.customerId);

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
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        isCustomAmount: false,
        pendingAmount: 0
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error recording payment:', error);
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
      pendingAmount: customer?.pending_amount || 0,
      amount: formData.isCustomAmount ? formData.amount : (customer?.pending_amount || 0).toString()
    });
  };

  const handleCustomAmountToggle = (isCustom: boolean) => {
    setFormData({
      ...formData,
      isCustomAmount: isCustom,
      amount: isCustom ? '' : formData.pendingAmount.toString()
    });
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
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - ₹{customer.pending_amount.toFixed(2)} pending
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.customerId && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">
                    Pending Amount: ₹{formData.pendingAmount.toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-4 mb-2">
                  <Label>Payment Amount *</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={!formData.isCustomAmount ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCustomAmountToggle(false)}
                      disabled={!formData.customerId}
                    >
                      Full Amount
                    </Button>
                    <Button
                      type="button"
                      variant={formData.isCustomAmount ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCustomAmountToggle(true)}
                    >
                      Custom
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={formData.isCustomAmount ? undefined : formData.pendingAmount}
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter amount"
                  required
                  disabled={!formData.customerId}
                />
              </div>

              <div>
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
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

      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <X className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending Payments</p>
              <p className="text-2xl font-bold text-red-600">₹{totalPendingAmount.toFixed(2)}</p>
              <p className="text-sm text-gray-500">{customersWithPendingBalance.length} customers</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Payments</p>
              <p className="text-2xl font-bold text-green-600">₹{totalPayments.toFixed(2)}</p>
              <p className="text-sm text-gray-500">{payments.length} payments</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-600">₹{(totalPayments + totalPendingAmount).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Collected + Pending</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by customer name or payment method..."
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
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
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
                    No payment records found. Record your first payment to get started.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ₹{payment.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <Badge variant="outline">{payment.payment_method}</Badge>
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
