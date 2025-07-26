
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AlertCircle, Eye, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PendingPayment {
  customer_id: string;
  customer_name: string;
  pending_amount: number;
}

interface PendingPaymentsProps {
  onViewCustomer?: (customerId: string) => void;
  onPaymentsCleared?: () => void;
}

export const PendingPayments = ({ onViewCustomer, onPaymentsCleared }: PendingPaymentsProps) => {
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clearingCustomerId, setClearingCustomerId] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    try {
      setIsLoading(true);
      
      // Calculate pending amounts by getting total deliveries minus total payments for each customer
      const { data, error } = await supabase
        .rpc('get_customer_pending_balances');

      if (error) {
        console.error('Error loading pending payments:', error);
        throw error;
      }

      const pendingCustomers = (data || []).filter(customer => customer.pending_amount > 0);
      
      setPendingPayments(pendingCustomers.map(customer => ({
        customer_id: customer.customer_id,
        customer_name: customer.customer_name,
        pending_amount: customer.pending_amount
      })));
    } catch (error) {
      console.error('Error loading pending payments:', error);
      toast({
        title: "Error",
        description: "Failed to load pending payments",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearPayment = async () => {
    if (!clearingCustomerId) return;
    
    if (!password) {
      toast({
        title: "Error",
        description: "Please enter the password",
        variant: "destructive",
        duration: 2000
      });
      return;
    }
    
    if (password !== '123') {
      toast({
        title: "Error",
        description: "Incorrect password",
        variant: "destructive",
        duration: 2000
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Get customer details for payment record
      const customer = pendingPayments.find(p => p.customer_id === clearingCustomerId);
      if (!customer) return;

      // First, add a payment record for the cleared amount
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          customer_name: customer.customer_name,
          amount: customer.pending_amount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'Balance Clear',
          notes: 'Cleared through admin'
        });

      if (paymentError) {
        console.error('Error adding payment record:', paymentError);
        throw paymentError;
      }

      // The payment will automatically update the customer balance via trigger
      // Wait a moment for the trigger to process
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({
        title: "Success",
        description: `Payment of ₹${customer.pending_amount.toFixed(2)} cleared for ${customer.customer_name}`,
        duration: 2000
      });

      // Reload the pending payments and notify parent components
      await loadPendingPayments();
      if (onPaymentsCleared) {
        onPaymentsCleared();
      }
      
      // Reset form
      setPassword('');
      setClearingCustomerId(null);
    } catch (error) {
      console.error('Error clearing payment:', error);
      toast({
        title: "Error",
        description: "Failed to clear payment",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDialogOpenChange = (open: boolean, customerId?: string) => {
    if (open && customerId) {
      setClearingCustomerId(customerId);
    } else {
      setClearingCustomerId(null);
      setPassword('');
    }
  };

  const totalPendingAmount = pendingPayments.reduce((sum, payment) => sum + payment.pending_amount, 0);
  const currentPayment = pendingPayments.find(p => p.customer_id === clearingCustomerId);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <AlertCircle className="h-5 w-5 text-orange-500 mr-2" />
          Pending Payments
        </h3>
        <div className="text-sm text-gray-600">
          Total: ₹{totalPendingAmount.toFixed(2)}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">
          Loading pending payments...
        </div>
      ) : pendingPayments.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No pending payments found.
        </div>
      ) : (
        <div className="space-y-3">
          {pendingPayments.map((payment) => (
            <div key={payment.customer_id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div>
                <div className="font-medium text-gray-900">{payment.customer_name}</div>
                <div className="text-sm text-gray-600">Pending: ₹{payment.pending_amount.toFixed(2)}</div>
              </div>
              <div className="flex gap-2">
                {onViewCustomer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewCustomer(payment.customer_id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                )}
                
                <AlertDialog 
                  open={clearingCustomerId === payment.customer_id} 
                  onOpenChange={(open) => handleDialogOpenChange(open, payment.customer_id)}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-900"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear Payment</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to clear the pending payment for {currentPayment?.customer_name}? 
                        This will add a payment record for ₹{currentPayment?.pending_amount.toFixed(2)} and clear their balance.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                      <Label htmlFor="password">Enter Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password to confirm"
                        className="mt-2"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleClearPayment();
                          }
                        }}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => handleDialogOpenChange(false)}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearPayment}
                        disabled={isLoading}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isLoading ? 'Clearing...' : 'Clear Payment'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
