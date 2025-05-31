
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Calendar as CalendarIcon, Search, List, Grid } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { BulkDeliveryEntry } from './BulkDeliveryEntry';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryRecord {
  id: string;
  customer_id: string;
  customer_name: string;
  milk_type_name: string;
  quantity: number;
  price_per_liter: number;
  total_amount: number;
  delivery_date: string;
  notes: string;
}

interface Customer {
  id: string;
  name: string;
}

interface MilkType {
  id: string;
  name: string;
  price_per_liter: number;
}

export const DeliveryRecords = () => {
  const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [milkTypes, setMilkTypes] = useState<MilkType[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    milkTypeId: '',
    milkTypeName: '',
    quantity: '',
    pricePerLiter: '',
    deliveryDate: new Date(),
    notes: ''
  });

  useEffect(() => {
    loadDeliveryRecords();
    loadCustomers();
    loadMilkTypes();
  }, []);

  const loadDeliveryRecords = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('delivery_records')
        .select(`
          *,
          customers(name),
          milk_types(name)
        `)
        .order('delivery_date', { ascending: false });

      if (error) throw error;

      const formattedRecords = data?.map(record => ({
        id: record.id,
        customer_id: record.customer_id,
        customer_name: record.customers?.name || 'Unknown',
        milk_type_name: record.milk_types?.name || 'Unknown',
        quantity: record.quantity,
        price_per_liter: record.price_per_liter,
        total_amount: record.total_amount,
        delivery_date: record.delivery_date,
        notes: record.notes || ''
      })) || [];

      setDeliveryRecords(formattedRecords);
    } catch (error) {
      console.error('Error loading delivery records:', error);
      toast({
        title: "Error",
        description: "Failed to load delivery records",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadMilkTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('milk_types')
        .select('id, name, price_per_liter')
        .order('name');

      if (error) throw error;
      setMilkTypes(data || []);
    } catch (error) {
      console.error('Error loading milk types:', error);
    }
  };

  if (isBulkMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold text-gray-900">Delivery Records</h2>
            <div className="flex rounded-lg border">
              <Button
                variant={!isBulkMode ? "default" : "ghost"}
                onClick={() => setIsBulkMode(false)}
                className="rounded-r-none"
              >
                <List className="h-4 w-4 mr-2" />
                Single Entry
              </Button>
              <Button
                variant={isBulkMode ? "default" : "ghost"}
                onClick={() => setIsBulkMode(true)}
                className="rounded-l-none"
              >
                <Grid className="h-4 w-4 mr-2" />
                Bulk Entry
              </Button>
            </div>
          </div>
        </div>
        <BulkDeliveryEntry />
      </div>
    );
  }

  const filteredRecords = deliveryRecords.filter(record =>
    record.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.milk_type_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.delivery_date.includes(searchTerm)
  );

  const todaysRecords = deliveryRecords.filter(record => 
    record.delivery_date === format(new Date(), 'yyyy-MM-dd')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId || !formData.milkTypeId || !formData.quantity || !formData.pricePerLiter) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const quantityInMl = parseFloat(formData.quantity);
    const price = Math.ceil(parseFloat(formData.pricePerLiter));

    if (isNaN(quantityInMl) || quantityInMl <= 0 || isNaN(price) || price <= 0) {
      toast({
        title: "Error",
        description: "Please enter valid quantity and price",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      const quantityInLiters = quantityInMl / 1000; // Convert ml to liters for database storage
      const totalAmount = Math.ceil(quantityInLiters * price); // Store amount in rupees as whole numbers

      console.log('Submitting delivery record:', {
        customer_id: formData.customerId,
        milk_type_id: formData.milkTypeId,
        quantity: quantityInLiters,
        price_per_liter: price,
        total_amount: totalAmount,
        delivery_date: format(formData.deliveryDate, 'yyyy-MM-dd'),
        notes: formData.notes
      });

      const { error: deliveryError } = await supabase
        .from('delivery_records')
        .insert({
          customer_id: formData.customerId,
          milk_type_id: formData.milkTypeId,
          quantity: quantityInLiters, // Store in liters in database
          price_per_liter: price,
          total_amount: totalAmount, // Store in rupees as whole numbers
          delivery_date: format(formData.deliveryDate, 'yyyy-MM-dd'),
          notes: formData.notes || null
        });

      if (deliveryError) {
        console.error('Delivery record error:', deliveryError);
        throw deliveryError;
      }

      // Update customer balance - add amount in rupees as whole numbers
      const { data: existingBalance } = await supabase
        .from('customer_balances')
        .select('pending_amount')
        .eq('customer_id', formData.customerId)
        .maybeSingle();

      const newPendingAmount = Math.ceil((existingBalance?.pending_amount || 0) + totalAmount);

      const { error: balanceError } = await supabase
        .from('customer_balances')
        .upsert({
          customer_id: formData.customerId,
          pending_amount: newPendingAmount,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'customer_id'
        });

      if (balanceError) {
        console.error('Balance update error:', balanceError);
        throw balanceError;
      }

      toast({
        title: "Success",
        description: "Delivery record added successfully"
      });

      await loadDeliveryRecords();
      setFormData({
        customerId: '',
        customerName: '',
        milkTypeId: '',
        milkTypeName: '',
        quantity: '',
        pricePerLiter: '',
        deliveryDate: new Date(),
        notes: ''
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error adding delivery record:', error);
      toast({
        title: "Error",
        description: "Failed to add delivery record. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customerId,
      customerName: customer?.name || ''
    });
  };

  const handleMilkTypeSelect = (milkTypeId: string) => {
    const milkType = milkTypes.find(m => m.id === milkTypeId);
    setFormData({
      ...formData,
      milkTypeId,
      milkTypeName: milkType?.name || '',
      pricePerLiter: Math.ceil(milkType?.price_per_liter || 0).toString()
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold text-gray-900">Delivery Records</h2>
          <div className="flex rounded-lg border">
            <Button
              variant={!isBulkMode ? "default" : "ghost"}
              onClick={() => setIsBulkMode(false)}
              className="rounded-r-none"
            >
              <List className="h-4 w-4 mr-2" />
              Single Entry
            </Button>
            <Button
              variant={isBulkMode ? "default" : "ghost"}
              onClick={() => setIsBulkMode(true)}
              className="rounded-l-none"
            >
              <Grid className="h-4 w-4 mr-2" />
              Bulk Entry
            </Button>
          </div>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Delivery
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Delivery Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customer">Customer *</Label>
                <Select onValueChange={handleCustomerSelect} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="milkType">Milk Type *</Label>
                <Select onValueChange={handleMilkTypeSelect} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select milk type" />
                  </SelectTrigger>
                  <SelectContent>
                    {milkTypes.map((milk) => (
                      <SelectItem key={milk.id} value={milk.id}>
                        {milk.name} - ₹{Math.ceil(milk.price_per_liter)}/L
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity (ml) *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="50"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="e.g., 500"
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">Price per Liter (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.pricePerLiter}
                  onChange={(e) => setFormData({ ...formData, pricePerLiter: e.target.value })}
                  placeholder="e.g., 55"
                  required
                />
              </div>

              <div>
                <Label>Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.deliveryDate ? format(formData.deliveryDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.deliveryDate}
                      onSelect={(date) => date && setFormData({ ...formData, deliveryDate: date })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
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

              {formData.quantity && formData.pricePerLiter && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium">
                    Total Amount: ₹{Math.ceil((parseFloat(formData.quantity) / 1000) * Math.ceil(parseFloat(formData.pricePerLiter)))}
                    <span className="text-xs text-gray-600 ml-2">
                      ({formData.quantity}ml = {(parseFloat(formData.quantity) / 1000).toFixed(2)}L)
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add Delivery'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today's Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{todaysRecords.length}</p>
            <p className="text-sm text-gray-500">Deliveries</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {Math.round(todaysRecords.reduce((sum, record) => sum + record.quantity, 0) * 1000)}ml
            </p>
            <p className="text-sm text-gray-500">Total Quantity</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              ₹{Math.ceil(todaysRecords.reduce((sum, record) => sum + record.total_amount, 0))}
            </p>
            <p className="text-sm text-gray-500">Total Amount</p>
          </div>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by customer name, milk type, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>
      </Card>

      {/* Records Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Milk Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Loading delivery records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No delivery records found. Add your first delivery record to get started.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(record.delivery_date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.milk_type_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.round(record.quantity * 1000)}ml
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{Math.ceil(record.price_per_liter)}/L
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ₹{Math.ceil(record.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {record.notes || '-'}
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
