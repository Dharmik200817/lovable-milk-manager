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
}

export const PendingPayments = ({ onViewCustomer }: PendingPaymentsProps) => {
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clearingCustomerId, setClearingCustomerId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    try {
      setIsLoading(true);
      
      // Query customer_balances table with customer names
      const { data, error } = await supabase
        .from('customer_balances')
        .select(`
          customer_id,
          pending_amount,
          customers!inner(name)
        `)
        .gt('pending_amount', 0)
        .order('pending_amount', { ascending: false });

      if (error) {
        console.error('Error loading pending payments:', error);
        throw error;
      }

      // Transform the data to match our interface
      const transformedData = data?.map(item => ({
        customer_id: item.customer_id,
        customer_name: item.customers.name,
        pending_amount: item.pending_amount
      })) || [];

      setPendingPayments(transformedData);
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

  const handleClearPayment = async (customerId: string) => {
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
      setClearingCustomerId(customerId);
      
      // Clear the pending amount for this customer
      const { error } = await supabase
        .from('customer_balances')
        .update({ pending_amount: 0 })
        .eq('customer_id', customerId);

      if (error) {
        console.error('Error clearing payment:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Payment cleared successfully",
        duration: 2000
      });

      // Reload the pending payments
      await loadPendingPayments();
      
      // Reset form
      setPassword('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error clearing payment:', error);
      toast({
        title: "Error",
        description: "Failed to clear payment",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setClearingCustomerId(null);
    }
  };

  const totalPendingAmount = pendingPayments.reduce((sum, payment) => sum + payment.pending_amount, 0);

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
                
                <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setClearingCustomerId(payment.customer_id)}
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
                        Are you sure you want to clear the pending payment for {payment.customer_name}? 
                        This will set their pending balance to ₹0.
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
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => {
                        setPassword('');
                        setClearingCustomerId(null);
                      }}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleClearPayment(clearingCustomerId!)}
                        disabled={clearingCustomerId === payment.customer_id && isLoading}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {clearingCustomerId === payment.customer_id && isLoading ? 'Clearing...' : 'Clear Payment'}
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
