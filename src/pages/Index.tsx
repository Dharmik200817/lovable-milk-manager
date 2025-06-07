
import React, { useState, useEffect } from 'react';
import { CustomerManagement } from '../components/CustomerManagement';
import { MilkTypesManagement } from '../components/MilkTypesManagement';
import { DeliveryRecords } from '../components/DeliveryRecords';
import { PaymentTracking } from '../components/PaymentTracking';
import { Dashboard } from '../components/Dashboard';
import { CustomerBills } from '../components/CustomerBills';
import { Users, Milk, Calendar, CreditCard, Home, Receipt, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [highlightCustomerId, setHighlightCustomerId] = useState<string | undefined>();
  const [selectedCustomerForBill, setSelectedCustomerForBill] = useState<string | undefined>();
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Milk className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!user) {
    return null;
  }

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users
    },
    {
      id: 'milk-types',
      label: 'Milk Types',
      icon: Milk
    },
    {
      id: 'delivery',
      label: 'Delivery Records',
      icon: Calendar
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: CreditCard
    },
    {
      id: 'customer-bills',
      label: 'Customer Bills',
      icon: Receipt
    }
  ];

  const handleNavigateToDelivery = (customerId?: string) => {
    setHighlightCustomerId(customerId);
    setActiveTab('delivery');
  };

  const handleViewRecords = (customerId: string) => {
    setSelectedCustomerForBill(customerId);
    setActiveTab('customer-bills');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'customers':
        return <CustomerManagement onViewRecords={handleViewRecords} />;
      case 'milk-types':
        return <MilkTypesManagement />;
      case 'delivery':
        return <DeliveryRecords highlightCustomerId={highlightCustomerId} />;
      case 'payments':
        return <PaymentTracking onNavigateToDelivery={handleNavigateToDelivery} />;
      case 'customer-bills':
        return <CustomerBills preSelectedCustomerId={selectedCustomerForBill} onViewRecords={handleViewRecords} />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  // Clear highlight when switching tabs
  const handleTabChange = (tabId: string) => {
    if (tabId !== 'delivery') {
      setHighlightCustomerId(undefined);
    }
    if (tabId !== 'customer-bills') {
      setSelectedCustomerForBill(undefined);
    }
    setActiveTab(tabId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Milk className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Narmada dairy Milk Management</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Welcome, {user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
