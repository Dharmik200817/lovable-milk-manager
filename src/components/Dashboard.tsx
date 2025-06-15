import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Users, Milk, Calendar, CreditCard } from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

interface SummaryData {
  totalCustomers: number;
  totalMilkTypes: number;
  totalDeliveries: number;
  totalPayments: number;
}

export const Dashboard = ({ onNavigate }: DashboardProps) => {
  const [summary, setSummary] = useState<SummaryData>({
    totalCustomers: 0,
    totalMilkTypes: 0,
    totalDeliveries: 0,
    totalPayments: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSummaryData();
  }, []);

  const loadSummaryData = async () => {
    setIsLoading(true);
    try {
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id', { count: 'exact' });

      const { data: milkTypes, error: milkTypesError } = await supabase
        .from('milk_types')
        .select('id', { count: 'exact' });

      const { data: deliveries, error: deliveriesError } = await supabase
        .from('delivery_records')
        .select('id', { count: 'exact' });

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('id', { count: 'exact' });

      if (customersError || milkTypesError || deliveriesError || paymentsError) {
        console.error('Error fetching data:', customersError, milkTypesError, deliveriesError, paymentsError);
        throw new Error('Failed to load summary data');
      }

      setSummary({
        totalCustomers: customers ? customers.length : 0,
        totalMilkTypes: milkTypes ? milkTypes.length : 0,
        totalDeliveries: deliveries ? deliveries.length : 0,
        totalPayments: payments ? payments.length : 0
      });
    } catch (error) {
      console.error('Error loading summary data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Dashboard</h2>
      </div>

      {isLoading ? (
        <Card className="p-6 text-center">
          <p className="text-gray-500">Loading dashboard data...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-bold text-blue-600">{summary.totalCustomers}</div>
                <div className="text-sm text-gray-500">Total Customers</div>
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
            <Button variant="link" className="justify-start p-0" onClick={() => onNavigate('customers')}>
              View Customers <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-bold text-green-600">{summary.totalMilkTypes}</div>
                <div className="text-sm text-gray-500">Milk Types</div>
              </div>
              <Milk className="h-8 w-8 text-green-400" />
            </div>
            <Button variant="link" className="justify-start p-0" onClick={() => onNavigate('milk-types')}>
              View Milk Types <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-bold text-orange-600">{summary.totalDeliveries}</div>
                <div className="text-sm text-gray-500">Deliveries</div>
              </div>
              <Calendar className="h-8 w-8 text-orange-400" />
            </div>
            <Button variant="link" className="justify-start p-0" onClick={() => onNavigate('delivery')}>
              View Deliveries <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-bold text-purple-600">{summary.totalPayments}</div>
                <div className="text-sm text-gray-500">Payments</div>
              </div>
              <CreditCard className="h-8 w-8 text-purple-400" />
            </div>
            <Button variant="link" className="justify-start p-0" onClick={() => onNavigate('payments')}>
              View Payments <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
