
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Check, X, CreditCard } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  status: 'pending' | 'cleared';
  paymentMethod: string;
  notes: string;
}

export const PaymentTracking = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'cleared'>('all');
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    notes: ''
  });

  // Mock customers for demo
  const mockCustomers = [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
  ];

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingPayments = payments.filter(payment => payment.status === 'pending');
  const totalPending = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalCleared = payments.filter(p => p.status === 'cleared').reduce((sum, payment) => sum + payment.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
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

    const newPayment: Payment = {
      id: Date.now().toString(),
      customerId: formData.customerId,
      customerName: formData.customerName,
      amount,
      paymentDate: formData.paymentDate,
      status: 'pending',
      paymentMethod: formData.paymentMethod || 'Cash',
      notes: formData.notes
    };

    setPayments([...payments, newPayment]);
    toast({
      title: "Success",
      description: "Payment record added successfully"
    });

    setFormData({
      customerId: '',
      customerName: '',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: '',
      notes: ''
    });
    setIsAddDialogOpen(false);
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = mockCustomers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customerId,
      customerName: customer?.name || ''
    });
  };

  const markAsCleared = (paymentId: string) => {
    setPayments(payments.map(payment =>
      payment.id === paymentId
        ? { ...payment, status: 'cleared' as const }
        : payment
    ));
    toast({
      title: "Success",
      description: "Payment marked as cleared"
    });
  };

  const markAsPending = (paymentId: string) => {
    setPayments(payments.map(payment =>
      payment.id === paymentId
        ? { ...payment, status: 'pending' as const }
        : payment
    ));
    toast({
      title: "Success",
      description: "Payment marked as pending"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Payment Tracking</h2>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Payment Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customer">Customer *</Label>
                <Select onValueChange={handleCustomerSelect} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCustomers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
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

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                  Add Payment
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
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
              <p className="text-2xl font-bold text-red-600">₹{totalPending.toFixed(2)}</p>
              <p className="text-sm text-gray-500">{pendingPayments.length} customers</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Cleared Payments</p>
              <p className="text-2xl font-bold text-green-600">₹{totalCleared.toFixed(2)}</p>
              <p className="text-sm text-gray-500">{payments.filter(p => p.status === 'cleared').length} payments</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Payments</p>
              <p className="text-2xl font-bold text-blue-600">₹{(totalPending + totalCleared).toFixed(2)}</p>
              <p className="text-sm text-gray-500">{payments.length} records</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Card className="flex-1 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by customer name or payment method..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>
        
        <Card className="p-4">
          <Select value={statusFilter} onValueChange={(value: 'all' | 'pending' | 'cleared') => setStatusFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="pending">Pending Only</SelectItem>
              <SelectItem value="cleared">Cleared Only</SelectItem>
            </SelectContent>
          </Select>
        </Card>
      </div>

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No payment records found. Add your first payment record to get started.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ₹{payment.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.paymentMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge 
                        variant={payment.status === 'cleared' ? 'default' : 'destructive'}
                        className={payment.status === 'cleared' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                      >
                        {payment.status === 'cleared' ? 'Cleared' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {payment.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {payment.status === 'pending' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsCleared(payment.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsPending(payment.id)}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Undo
                        </Button>
                      )}
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
