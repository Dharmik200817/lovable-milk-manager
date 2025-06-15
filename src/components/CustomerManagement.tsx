
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Eye, MessageCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  address: string;
  phone_number?: string;
  created_at: string;
}

interface CustomerManagementProps {
  onViewRecords?: (customerId: string) => void;
}

export const CustomerManagement = ({ onViewRecords }: CustomerManagementProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone_number: ''
  });

  // Load customers from Supabase on component mount
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error loading customers:', error);
        throw error;
      }
      
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.address && customer.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.phone_number && customer.phone_number.includes(searchTerm))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
        duration: 2000
      });
      return;
    }

    try {
      setIsLoading(true);

      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name.trim(),
            address: formData.address.trim() || null,
            phone_number: formData.phone_number.trim() || null
          })
          .eq('id', editingCustomer.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Customer updated successfully",
          duration: 2000
        });
      } else {
        // Create new customer
        const { data, error } = await supabase
          .from('customers')
          .insert({
            name: formData.name.trim(),
            address: formData.address.trim() || null,
            phone_number: formData.phone_number.trim() || null
          })
          .select()
          .single();

        if (error) throw error;

        // Initialize customer balance
        const { error: balanceError } = await supabase
          .from('customer_balances')
          .insert({
            customer_id: data.id,
            pending_amount: 0
          });

        if (balanceError) {
          console.error('Error creating customer balance:', balanceError);
        }

        toast({
          title: "Success",
          description: "Customer added successfully",
          duration: 2000
        });
      }

      // Reload customers to get updated data
      await loadCustomers();
      
      // Reset form
      setFormData({ name: '', address: '', phone_number: '' });
      setIsAddDialogOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: "Error",
        description: "Failed to save customer",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      address: customer.address || '',
      phone_number: customer.phone_number || ''
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer? This will also delete all their delivery records and payments.')) {
      return;
    }

    try {
      setIsLoading(true);
      
      // First, get the customer name for deletion of related records
      const { data: customerData, error: customerFetchError } = await supabase
        .from('customers')
        .select('name')
        .eq('id', customerId)
        .single();

      if (customerFetchError) throw customerFetchError;

      // Delete related records in the correct order
      
      // 1. Delete grocery items for this customer's delivery records
      const { error: groceryError } = await supabase
        .from('grocery_items')
        .delete()
        .in('delivery_record_id', 
          await supabase
            .from('delivery_records')
            .select('id')
            .eq('customer_id', customerId)
            .then(({ data }) => data?.map(d => d.id) || [])
        );

      if (groceryError) console.error('Error deleting grocery items:', groceryError);

      // 2. Delete delivery records
      const { error: deliveryError } = await supabase
        .from('delivery_records')
        .delete()
        .eq('customer_id', customerId);

      if (deliveryError) console.error('Error deleting delivery records:', deliveryError);

      // 3. Delete payments by customer name
      const { error: paymentsError } = await supabase
        .from('payments')
        .delete()
        .eq('customer_name', customerData.name);

      if (paymentsError) console.error('Error deleting payments:', paymentsError);

      // 4. Delete customer balance
      const { error: balanceError } = await supabase
        .from('customer_balances')
        .delete()
        .eq('customer_id', customerId);

      if (balanceError) console.error('Error deleting customer balance:', balanceError);

      // 5. Finally, delete the customer
      const { error: customerError } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (customerError) throw customerError;

      toast({
        title: "Success",
        description: "Customer and all related records deleted successfully",
        duration: 2000
      });

      // Reload customers
      await loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer. Please try again.",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendWhatsAppMessage = (customer: Customer) => {
    if (!customer.phone_number) {
      toast({
        title: "Error",
        description: "No phone number found for this customer",
        variant: "destructive",
        duration: 2000
      });
      return;
    }

    const message = `Hello ${customer.name}!\n\nThis is NARMADA DAIRY. We hope you're enjoying our fresh milk delivery service.\n\nIf you have any questions or need to discuss your account, please feel free to contact us.\n\nThank you for choosing NARMADA DAIRY! 🥛`;
    
    // Create WhatsApp URL
    const phoneNumber = customer.phone_number.replace(/\D/g, ''); // Remove all non-digits
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    // Open WhatsApp
    window.open(whatsappUrl, '_blank');

    toast({
      title: "Success",
      description: "WhatsApp opened with message",
      duration: 2000
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Customer Management</h2>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter customer name"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="Enter phone number (e.g., +919876543210)"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="address">Full Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter complete delivery address"
                  rows={3}
                  disabled={isLoading}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                  {isLoading ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Add Customer')}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingCustomer(null);
                    setFormData({ name: '', address: '', phone_number: '' });
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search customers by name, address, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>
      </Card>

      {/* Customer List */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No customers found. Add your first customer to get started.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.phone_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {customer.address || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {onViewRecords && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewRecords(customer.id)}
                            className="text-green-600 hover:text-green-900"
                            disabled={isLoading}
                            title="View Records"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {customer.phone_number && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendWhatsAppMessage(customer)}
                            className="text-green-600 hover:text-green-900"
                            disabled={isLoading}
                            title="Send WhatsApp Message"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          className="text-blue-600 hover:text-blue-900"
                          disabled={isLoading}
                          title="Edit Customer"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={isLoading}
                          title="Delete Customer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
