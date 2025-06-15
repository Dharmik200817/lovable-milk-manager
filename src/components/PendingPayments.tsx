
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Eye } from 'lucide-react';
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
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
