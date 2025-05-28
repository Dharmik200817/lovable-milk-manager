import React, { useState } from 'react';
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

interface DeliveryRecord {
  id: string;
  customerId: string;
  customerName: string;
  milkType: string;
  quantity: number;
  pricePerLiter: number;
  totalAmount: number;
  deliveryDate: string;
  notes: string;
}

export const DeliveryRecords = () => {
  const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    milkType: '',
    quantity: '',
    pricePerLiter: '',
    deliveryDate: new Date(),
    notes: ''
  });

  // Mock customers and milk types for demo
  const mockCustomers = [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
  ];

  const mockMilkTypes = [
    { name: 'Full Cream', price: 55 },
    { name: 'Skimmed', price: 50 },
  ];

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
    record.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.milkType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.deliveryDate.includes(searchTerm)
  );

  const todaysRecords = deliveryRecords.filter(record => 
    record.deliveryDate === new Date().toISOString().split('T')[0]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId || !formData.milkType || !formData.quantity || !formData.pricePerLiter) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const quantity = parseFloat(formData.quantity);
    const price = parseFloat(formData.pricePerLiter);

    if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price <= 0) {
      toast({
        title: "Error",
        description: "Please enter valid quantity and price",
        variant: "destructive"
      });
      return;
    }

    const newRecord: DeliveryRecord = {
      id: Date.now().toString(),
      customerId: formData.customerId,
      customerName: formData.customerName,
      milkType: formData.milkType,
      quantity,
      pricePerLiter: price,
      totalAmount: quantity * price,
      deliveryDate: formData.deliveryDate.toISOString().split('T')[0],
      notes: formData.notes
    };

    setDeliveryRecords([...deliveryRecords, newRecord]);
    toast({
      title: "Success",
      description: "Delivery record added successfully"
    });

    setFormData({
      customerId: '',
      customerName: '',
      milkType: '',
      quantity: '',
      pricePerLiter: '',
      deliveryDate: new Date(),
      notes: ''
    });
    setIsAddDialogOpen(false);
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = mockCustomers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customerId,
      customerName: customer?.name || ''
    });
  };

  const handleMilkTypeSelect = (milkType: string) => {
    const milk = mockMilkTypes.find(m => m.name === milkType);
    setFormData({
      ...formData,
      milkType,
      pricePerLiter: milk?.price.toString() || ''
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
            <Button className="bg-blue-600 hover:bg-blue-700">
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
                    {mockCustomers.map((customer) => (
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
                    {mockMilkTypes.map((milk) => (
                      <SelectItem key={milk.name} value={milk.name}>
                        {milk.name} - ₹{milk.price}/L
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity (Liters) *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="e.g., 2.5"
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">Price per Liter (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pricePerLiter}
                  onChange={(e) => setFormData({ ...formData, pricePerLiter: e.target.value })}
                  placeholder="e.g., 55.00"
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
                      {formData.deliveryDate ? format(formData.deliveryDate, "PPP") : <span>Pick a date</span>}
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
                    Total Amount: ₹{(parseFloat(formData.quantity) * parseFloat(formData.pricePerLiter)).toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                  Add Delivery
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
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
              {todaysRecords.reduce((sum, record) => sum + record.quantity, 0).toFixed(1)}L
            </p>
            <p className="text-sm text-gray-500">Total Quantity</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              ₹{todaysRecords.reduce((sum, record) => sum + record.totalAmount, 0).toFixed(2)}
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
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No delivery records found. Add your first delivery record to get started.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.deliveryDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.milkType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.quantity}L
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{record.pricePerLiter.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ₹{record.totalAmount.toFixed(2)}
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
