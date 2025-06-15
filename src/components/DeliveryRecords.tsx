import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Search, Edit, Trash2, Download, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils"
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { generateDeliveryReport } from '@/utils/generate-delivery-report';
import { BulkDeliveryEntry } from './BulkDeliveryEntry';

interface DeliveryRecord {
  id: string;
  customer_id: string;
  delivery_date: string;
  milk_type_id: string;
  quantity: number;
  price_per_liter: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  customers: { name: string } | null;
  milk_types: { name: string } | null;
}

interface DeliveryRecordsProps {
  highlightCustomerId?: string;
}

export const DeliveryRecords = ({ highlightCustomerId }: DeliveryRecordsProps) => {
  const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DeliveryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [milkTypes, setMilkTypes] = useState<{ id: string; name: string; price_per_liter: number }[]>([]);
  const [formData, setFormData] = useState({
    customerId: '',
    deliveryDate: new Date(),
    milkType: '',
    quantity: '',
    notes: ''
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(true); // Start with bulk mode

  useEffect(() => {
    loadCustomers();
    loadMilkTypes();
    loadDeliveryRecords();
  }, [highlightCustomerId]);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
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

  const loadMilkTypes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('milk_types')
        .select('id, name, price_per_liter')
        .order('name');

      if (error) {
        console.error('Error loading milk types:', error);
        throw error;
      }

      setMilkTypes(data || []);
    } catch (error) {
      console.error('Error loading milk types:', error);
      toast({
        title: "Error",
        description: "Failed to load milk types",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeliveryRecords = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('delivery_records')
        .select('*, customers(name), milk_types(name)')
        .order('delivery_date', { ascending: false });

      if (highlightCustomerId) {
        query = query.eq('customer_id', highlightCustomerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading delivery records:', error);
        throw error;
      }

      setDeliveryRecords((data as any) || []);
    } catch (error) {
      console.error('Error loading delivery records:', error);
      toast({
        title: "Error",
        description: "Failed to load delivery records",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = deliveryRecords.filter(record => {
    const searchTermLower = searchTerm.toLowerCase();
    const customerNameLower = record.customers?.name?.toLowerCase() || '';
    const milkTypeLower = record.milk_types?.name?.toLowerCase() || '';

    const matchesSearchTerm =
      customerNameLower.includes(searchTermLower) ||
      milkTypeLower.includes(searchTermLower);

    const deliveryDate = new Date(record.delivery_date);
    const matchesDateRange = dateRange?.from ? (deliveryDate >= dateRange.from && (dateRange.to ? deliveryDate <= dateRange.to : true)) : true;

    return matchesSearchTerm && matchesDateRange;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId || !formData.milkType || !formData.quantity) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
        duration: 2000
      });
      return;
    }

    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
        duration: 2000
      });
      return;
    }

    const selectedCustomer = customers.find(c => c.id === formData.customerId);
    const selectedMilkType = milkTypes.find(m => m.id === formData.milkType);

    if (!selectedCustomer || !selectedMilkType) {
      toast({
        title: "Error",
        description: "Invalid customer or milk type selected",
        variant: "destructive",
        duration: 2000
      });
      return;
    }

    try {
      setIsLoading(true);

      const deliveryDate = format(formData.deliveryDate, 'yyyy-MM-dd');
      const pricePerLiter = selectedMilkType.price_per_liter;
      const totalAmount = quantity * pricePerLiter;

      if (editingRecord) {
        const { error } = await supabase
          .from('delivery_records')
          .update({
            customer_id: formData.customerId,
            delivery_date: deliveryDate,
            milk_type_id: formData.milkType,
            quantity: quantity,
            price_per_liter: pricePerLiter,
            total_amount: totalAmount,
            notes: formData.notes || null
          })
          .eq('id', editingRecord.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Delivery record updated successfully",
          duration: 2000
        });
      } else {
        const { error } = await supabase
          .from('delivery_records')
          .insert({
            customer_id: formData.customerId,
            delivery_date: deliveryDate,
            milk_type_id: formData.milkType,
            quantity: quantity,
            price_per_liter: pricePerLiter,
            total_amount: totalAmount,
            notes: formData.notes || null
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Delivery record added successfully",
          duration: 2000
        });
      }

      await loadDeliveryRecords();

      setFormData({ customerId: '', deliveryDate: new Date(), milkType: '', quantity: '', notes: '' });
      setIsAddDialogOpen(false);
      setEditingRecord(null);
    } catch (error) {
      console.error('Error saving delivery record:', error);
      toast({
        title: "Error",
        description: "Failed to save delivery record",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (record: DeliveryRecord) => {
    setEditingRecord(record);
    setFormData({
      customerId: record.customer_id,
      deliveryDate: new Date(record.delivery_date),
      milkType: record.milk_type_id,
      quantity: record.quantity.toString(),
      notes: record.notes || ''
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (recordId: string) => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('delivery_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Delivery record deleted successfully",
        duration: 2000
      });

      await loadDeliveryRecords();
    } catch (error) {
      console.error('Error deleting delivery record:', error);
      toast({
        title: "Error",
        description: "Failed to delete delivery record",
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDeliveryReport = () => {
    generateDeliveryReport(filteredRecords);
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Delivery Records</h2>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={!isBulkMode ? 'default' : 'outline'}
            onClick={() => setIsBulkMode(false)}
            disabled={isLoading}
          >
            Single Entry
          </Button>
          <Button
            variant={isBulkMode ? 'default' : 'outline'}
            onClick={() => setIsBulkMode(true)}
            disabled={isLoading}
          >
            Bulk Entry
          </Button>
        </div>
      </div>

      {isBulkMode ? (
        <BulkDeliveryEntry 
          onClose={() => setIsBulkMode(false)}
        />
      ) : (
        <>
          <div className="flex items-center justify-end space-x-2">
            <Button onClick={downloadDeliveryReport} disabled={isLoading} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Record
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingRecord ? 'Edit Delivery Record' : 'Add New Delivery Record'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="customerId">Customer *</Label>
                    <select
                      id="customerId"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed"
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                      required
                      disabled={isLoading}
                    >
                      <option value="" disabled>Select a customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="deliveryDate">Delivery Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.deliveryDate && "text-muted-foreground"
                          )}
                        >
                          {formData.deliveryDate ? (
                            format(formData.deliveryDate, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.deliveryDate}
                          onSelect={(date) => setFormData({ ...formData, deliveryDate: date })}
                          disabled={isLoading}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="milkType">Milk Type *</Label>
                    <select
                      id="milkType"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed"
                      value={formData.milkType}
                      onChange={(e) => setFormData({ ...formData, milkType: e.target.value })}
                      required
                      disabled={isLoading}
                    >
                      <option value="" disabled>Select a milk type</option>
                      {milkTypes.map(milkType => (
                        <option key={milkType.id} value={milkType.id}>{milkType.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity (Liters) *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="e.g., 1.5, 2, 5"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional notes for this delivery"
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={isLoading}>
                      {isLoading ? 'Saving...' : (editingRecord ? 'Update Record' : 'Add Record')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddDialogOpen(false);
                        setEditingRecord(null);
                        setFormData({ customerId: '', deliveryDate: new Date(), milkType: '', quantity: '', notes: '' });
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

          {/* Search and Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search records by customer or milk type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </Card>
            <Card className="p-4">
              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    disabled={isLoading}
                  >
                    Filter by Date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    disabled={isLoading}
                  />
                </PopoverContent>
              </Popover>
            </Card>
          </div>

          {/* Delivery Records List */}
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
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        Loading delivery records...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No delivery records found. Add your first record to get started.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{new Date(record.delivery_date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{record.customers?.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{record.milk_types?.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{record.quantity} L</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">₹{record.total_amount.toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(record)}
                              className="text-blue-600 hover:text-blue-900"
                              disabled={isLoading}
                              title="Edit Record"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(record.id)}
                              className="text-red-600 hover:text-red-900"
                              disabled={isLoading}
                              title="Delete Record"
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
        </>
      )}
    </div>
  );
};
