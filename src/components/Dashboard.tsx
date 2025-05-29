import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Users, Milk, Calendar, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

export const Dashboard = ({ onNavigate }: DashboardProps) => {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    milkTypes: 0,
    todaysDeliveries: 0,
    pendingPayments: 0,
    pendingAmount: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get total customers
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      // Get milk types
      const { count: milkTypeCount } = await supabase
        .from('milk_types')
        .select('*', { count: 'exact', head: true });

      // Get today's deliveries
      const today = new Date().toISOString().split('T')[0];
      const { count: deliveryCount } = await supabase
        .from('delivery_records')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_date', today);

      // Get pending payments
      const { data: balances } = await supabase
        .from('customer_balances')
        .select('pending_amount')
        .gt('pending_amount', 0);

      const pendingCustomers = balances?.length || 0;
      const totalPending = balances?.reduce((sum, balance) => sum + balance.pending_amount, 0) || 0;

      setStats({
        totalCustomers: customerCount || 0,
        milkTypes: milkTypeCount || 0,
        todaysDeliveries: deliveryCount || 0,
        pendingPayments: pendingCustomers,
        pendingAmount: totalPending
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const navigateToTab = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <Milk className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Milk Types</p>
              <p className="text-2xl font-bold text-gray-900">{stats.milkTypes}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Today's Deliveries</p>
              <p className="text-2xl font-bold text-gray-900">{stats.todaysDeliveries}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending Payments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingPayments}</p>
              <p className="text-xs text-gray-400">₹{stats.pendingAmount.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => navigateToTab('customers')}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600 mr-3" />
                <span className="font-medium">Add New Customer</span>
              </div>
            </button>
            <button 
              onClick={() => navigateToTab('delivery')}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-green-600 mr-3" />
                <span className="font-medium">Record Today's Delivery</span>
              </div>
            </button>
            <button 
              onClick={() => navigateToTab('payments')}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-yellow-600 mr-3" />
                <span className="font-medium">Mark Payment as Cleared</span>
              </div>
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {stats.todaysDeliveries > 0 ? (
              <div className="text-sm text-gray-600">
                <p>✅ {stats.todaysDeliveries} deliveries recorded today</p>
                {stats.pendingPayments > 0 && (
                  <p className="text-orange-600">⚠️ {stats.pendingPayments} customers have pending payments</p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No deliveries recorded today</p>
                <p className="text-sm">Start by recording deliveries in bulk mode</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
