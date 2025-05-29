import React, { useState } from 'react';
import { CustomerManagement } from '../components/CustomerManagement';
import { MilkTypesManagement } from '../components/MilkTypesManagement';
import { DeliveryRecords } from '../components/DeliveryRecords';
import { PaymentTracking } from '../components/PaymentTracking';
import { Dashboard } from '../components/Dashboard';
import { Users, Milk, Calendar, CreditCard, Home } from 'lucide-react';
const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const tabs = [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home
  }, {
    id: 'customers',
    label: 'Customers',
    icon: Users
  }, {
    id: 'milk-types',
    label: 'Milk Types',
    icon: Milk
  }, {
    id: 'delivery',
    label: 'Delivery Records',
    icon: Calendar
  }, {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard
  }];
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'customers':
        return <CustomerManagement />;
      case 'milk-types':
        return <MilkTypesManagement />;
      case 'delivery':
        return <DeliveryRecords />;
      case 'payments':
        return <PaymentTracking />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };
  return <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Milk className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Narmada dairy Milk Management</h1>
            </div>
            <div className="text-sm text-gray-500">
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
            return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>;
          })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>;
};
export default Index;