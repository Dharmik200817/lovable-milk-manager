import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Calendar as CalendarIcon, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  address: string;
}

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
  total_payments: number;
  pending_amount: number;
}

interface PaymentTrackingProps {
  onNavigateToDelivery?: (customerId?: string) => void;
}

export const PaymentTracking: React.FC<PaymentTrackingProps> = ({ onNavigateToDelivery }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [outstandingBalances, setOutstandingBalances] = useState<CustomerBalance[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [clearPasswordDialog, setClearPasswordDialog] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    amount: '',
    payment_method: 'Cash',
    payment_date: new Date()
  });

  useEffect(() => {
    loadCustomers();
    loadPayments();
    loadOutstandingBalances();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive"
      });
    }
  };

  const loadPayments = async () => {
    try {
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
    }
  };

  const loadOutstandingBalances = async () => {
    try {
      setIsLoading(true);
      
      // Load all customers first
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name');
      
      if (customersError) throw customersError;
      
      // Load delivery records with customer info
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_records')
        .select(`
          customer_id,
          total_amount,
          customers!inner(name)
        `);
      
      if (deliveryError) throw deliveryError;
      
      // Load payments
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('customer_name, amount');
      
      if (paymentError) throw paymentError;
      
      // Calculate balances for each customer
      const balances: CustomerBalance[] = [];
      
      customersData?.forEach(customer => {
        const customerDeliveries = deliveryData?.filter(d => d.customer_id === customer.id) || [];
        const customerPayments = paymentData?.filter(p => p.customer_name === customer.name) || [];
        
        const totalDelivery = customerDeliveries.reduce((sum, d) => sum + Number(d.total_amount || 0), 0);
        const totalPayments = customerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const pendingAmount = totalDelivery - totalPayments;
        
        if (pendingAmount > 0) {
          balances.push({
            customer_id: customer.id,
            customer_name: customer.name,
            total_payments: totalPayments,
            pending_amount: pendingAmount
          });
        }
      });
      
      setOutstandingBalances(balances);
    } catch (error) {
      console.error('Error loading outstanding balances:', error);
      toast({
        title: "Error",
        description: "Failed to load outstanding balances",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_name.trim() || !formData.amount.trim()) {
      toast({
        title: "Error",
        description: "Customer name and amount are required",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('payments')
        .insert({
          customer_name: formData.customer_name.trim(),
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          payment_date: format(formData.payment_date, 'yyyy-MM-dd')
        })
        .select()
        .single();

      if (error) {
        console.error('Payment insertion error:', error);
        throw error;
      }

      console.log('Payment recorded successfully:', data);

      toast({
        title: "Success",
        description: "Payment recorded successfully"
      });

      // Reset form
      setFormData({
        customer_name: '',
        amount: '',
        payment_method: 'Cash',
        payment_date: new Date()
      });
      
      setIsAddDialogOpen(false);
      
      // Reload data
      await loadPayments();
      await loadOutstandingBalances();
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

  const handleClearPayment = async (customerName: string, pendingAmount: number) => {
    if (password !== '123') {
      toast({
        title: "Error",
        description: "Incorrect password",
        variant: "destructive"
      });
      setPassword('');
      return;
    }

    try {
      setIsLoading(true);
      
      // Record a payment equal to the pending amount to clear the balance
      const { error } = await supabase
        .from('payments')
        .insert({
          customer_name: customerName,
          amount: pendingAmount,
          payment_method: 'Balance Clear',
          payment_date: format(new Date(), 'yyyy-MM-dd')
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Outstanding balance of ₹${pendingAmount.toFixed(2)} cleared for ${customerName}`
      });

      setClearPasswordDialog(null);
      setPassword('');
      await loadPayments();
      await loadOutstandingBalances();
    } catch (error) {
      console.error('Error clearing balance:', error);
      toast({
        title: "Error",
        description: "Failed to clear balance",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Select value={formData.customer_name} onValueChange={(value) => setFormData({ ...formData, customer_name: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
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
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter payment amount"
                  required
                />
              </div>

              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
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

              <div>
                <Label htmlFor="payment_date">Payment Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.payment_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.payment_date ? format(formData.payment_date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.payment_date}
                      onSelect={(date) => date && setFormData({ ...formData, payment_date: date })}
                      initialFocus
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

      {/* Outstanding Balances */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding Balances</h3>
          {isLoading ? (
            <p className="text-center text-gray-500 py-4">Loading outstanding balances...</p>
          ) : outstandingBalances.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No outstanding balances found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium text-gray-900">Customer</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-900">Total Payments</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-900">Outstanding</th>
                    <th className="text-center py-2 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingBalances.map((balance) => (
                    <tr key={balance.customer_id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{balance.customer_name}</td>
                      <td className="py-3 px-4 text-right">₹{balance.total_payments.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-red-600">
                        ₹{balance.pending_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRecords(balance.customer_name)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Records
                          </Button>
                          
                          <Dialog open={clearPasswordDialog === balance.customer_name} onOpenChange={(open) => {
                            setClearPasswordDialog(open ? balance.customer_name : null);
                            if (!open) setPassword('');
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Clear
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Clear Outstanding Balance for {balance.customer_name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-gray-600">
                                  This will clear the outstanding balance of ₹{balance.pending_amount.toFixed(2)} for {balance.customer_name} by recording a payment. Enter password to confirm:
                                </p>
                                <Input
                                  type="password"
                                  placeholder="Enter password"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleClearPayment(balance.customer_name, balance.pending_amount);
                                    }
                                  }}
                                />
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={() => handleClearPayment(balance.customer_name, balance.pending_amount)} 
                                    variant="destructive" 
                                    className="flex-1"
                                    disabled={isLoading}
                                  >
                                    {isLoading ? 'Clearing...' : 'Clear Balance'}
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setClearPasswordDialog(null);
                                      setPassword('');
                                    }}
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isLoading}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Payment History */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h3>
          {payments.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium text-gray-900">Customer</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-900">Amount</th>
                    <th className="text-center py-2 px-4 font-medium text-gray-900">Method</th>
                    <th className="text-center py-2 px-4 font-medium text-gray-900">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{payment.customer_name}</td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600">
                        ₹{Number(payment.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {payment.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">
                        {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
