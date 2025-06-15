
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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 sm:py-4 gap-2 sm:gap-4">
            {/* Logo and Title */}
            <div className="flex items-center w-full sm:w-auto">
              <Milk className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2 sm:mr-3 flex-shrink-0" />
              <h1 className="text-sm sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                Narmada Dairy Milk Management
              </h1>
            </div>
            
            {/* User Info and Sign Out */}
            <div className="flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[150px] sm:max-w-none">
                {user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 h-8 sm:h-9"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8">
          {/* Scrollable navigation on mobile */}
          <div
            className="flex space-x-1 sm:space-x-4 overflow-x-auto no-scrollbar scrollbar-hide py-1 px-1 sm:px-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center flex-shrink-0
                    py-2 sm:py-3 px-2 sm:px-4 border-b-2 font-medium text-xs sm:text-sm
                    rounded-t-lg transition-colors min-h-[44px] sm:min-h-auto
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                  style={{ minWidth: 85 }}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-1 sm:px-4 lg:px-8 py-2 sm:py-4 lg:py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
