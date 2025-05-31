
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Plus, Trash2, ArrowRight, SkipForward } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  address: string;
}

interface MilkType {
  id: string;
  name: string;
  price_per_liter: number;
  description: string;
}

interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  description: string;
}

interface BulkEntry {
  customerId: string;
  customerName: string;
  milkTypeId: string;
  milkTypeName: string;
  quantity: number;
  pricePerLiter: number;
  groceryItems: GroceryItem[];
  isGroceryOnly: boolean;
}

interface CustomerMemory {
  [customerId: string]: {
    milkTypeId: string;
    quantity: number;
  };
}

export const BulkDeliveryEntry = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [milkTypes, setMilkTypes] = useState<MilkType[]>([]);
  const [customerMemory, setCustomerMemory] = useState<CustomerMemory>({});
  const [currentEntry, setCurrentEntry] = useState<BulkEntry>({
    customerId: '',
    customerName: '',
    milkTypeId: '',
    milkTypeName: '',
    quantity: 0,
    pricePerLiter: 0,
    groceryItems: [],
    isGroceryOnly: false
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadMilkTypes();
    loadCustomerMemory();
  }, []);

  const loadCustomers = async () => {
    try {
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
        variant: "destructive"
      });
    }
  };

  const loadMilkTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('milk_types')
        .select('*')
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
        variant: "destructive"
      });
    }
  };

  const loadCustomerMemory = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_records')
        .select('customer_id, milk_type_id, quantity')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const memory: CustomerMemory = {};
      data?.forEach(record => {
        if (!memory[record.customer_id]) {
          memory[record.customer_id] = {
            milkTypeId: record.milk_type_id,
            quantity: Math.round(record.quantity * 1000) // Convert liters to ml
          };
        }
      });
      
      setCustomerMemory(memory);
    } catch (error) {
      console.error('Error loading customer memory:', error);
    }
  };

  const updateEntry = (field: keyof BulkEntry, value: string | number | boolean) => {
    console.log('updateEntry called with:', field, value, typeof value);
    
    if (field === 'customerId') {
      const customer = customers.find(c => c.id === value);
      const memory = customerMemory[value as string];
      
      setCurrentEntry({
        ...currentEntry,
        customerId: value as string,
        customerName: customer?.name || '',
        milkTypeId: memory?.milkTypeId || '',
        milkTypeName: memory?.milkTypeId ? milkTypes.find(m => m.id === memory.milkTypeId)?.name || '' : '',
        quantity: memory?.quantity || 0,
        pricePerLiter: memory?.milkTypeId ? Math.ceil(milkTypes.find(m => m.id === memory.milkTypeId)?.price_per_liter || 0) : 0
      });
    } else if (field === 'milkTypeId') {
      const milk = milkTypes.find(m => m.id === value);
      const roundedPrice = Math.ceil(milk?.price_per_liter || 0);
      setCurrentEntry({
        ...currentEntry,
        milkTypeId: value as string,
        milkTypeName: milk?.name || '',
        pricePerLiter: roundedPrice
      });
    } else if (field === 'quantity') {
      // Ensure quantity is always a number
      const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : (typeof value === 'number' ? value : 0);
      console.log('Setting quantity to:', numericValue);
      setCurrentEntry({ 
        ...currentEntry, 
        quantity: numericValue
      });
    } else if (field === 'isGroceryOnly') {
      setCurrentEntry({ 
        ...currentEntry, 
        isGroceryOnly: value as boolean,
        milkTypeId: value ? '' : currentEntry.milkTypeId,
        milkTypeName: value ? '' : currentEntry.milkTypeName,
        quantity: value ? 0 : currentEntry.quantity,
        pricePerLiter: value ? 0 : currentEntry.pricePerLiter
      });
    } else {
      setCurrentEntry({ ...currentEntry, [field]: value });
    }
  };

  const addGroceryItem = () => {
    const newGroceryItem: GroceryItem = {
      id: Date.now().toString(),
      name: '',
      quantity: 0,
      unit: '',
      price: 0,
      description: ''
    };
    setCurrentEntry({
      ...currentEntry,
      groceryItems: [...currentEntry.groceryItems, newGroceryItem]
    });
  };

  const updateGroceryItem = (itemIndex: number, field: keyof GroceryItem, value: string | number) => {
    const updatedItems = [...currentEntry.groceryItems];
    if (field === 'quantity') {
      const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        quantity: numericValue
      };
    } else if (field === 'price') {
      const numericValue = typeof value === 'string' ? Math.ceil(parseFloat(value) || 0) : Math.ceil(value);
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        price: numericValue
      };
    } else {
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        [field]: value
      };
    }
    setCurrentEntry({
      ...currentEntry,
      groceryItems: updatedItems
    });
  };

  const removeGroceryItem = (itemIndex: number) => {
    setCurrentEntry({
      ...currentEntry,
      groceryItems: currentEntry.groceryItems.filter((_, i) => i !== itemIndex)
    });
  };

  const calculateTotal = () => {
    let milkTotal = 0;
    if (!currentEntry.isGroceryOnly && currentEntry.quantity && currentEntry.pricePerLiter) {
      const liters = currentEntry.quantity / 1000; // Convert ml to liters for calculation
      milkTotal = liters * currentEntry.pricePerLiter;
    }
    
    const groceryTotal = currentEntry.groceryItems.reduce((sum, item) => {
      return sum + (item.quantity * item.price);
    }, 0);
    
    return Math.ceil(milkTotal + groceryTotal);
  };

  const saveCurrentEntry = async () => {
    if (!currentEntry.customerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive"
      });
      return false;
    }

    if (!currentEntry.isGroceryOnly && (!currentEntry.milkTypeId || currentEntry.quantity <= 0)) {
      toast({
        title: "Error",
        description: "Please fill in milk details or select grocery only mode",
        variant: "destructive"
      });
      return false;
    }

    if (currentEntry.groceryItems.length === 0 && currentEntry.isGroceryOnly) {
      toast({
        title: "Error",
        description: "Please add at least one grocery item",
        variant: "destructive"
      });
      return false;
    }

    setIsLoading(true);
    try {
      let deliveryRecordId = null;
      
      // Save delivery record only if not grocery-only or if there's milk
      if (!currentEntry.isGroceryOnly && currentEntry.quantity > 0) {
        const totalAmount = calculateTotal();
        const quantityInLiters = currentEntry.quantity / 1000; // Convert ml to liters for storage
        
        const { data: deliveryData, error: deliveryError } = await supabase
          .from('delivery_records')
          .insert({
            customer_id: currentEntry.customerId,
            milk_type_id: currentEntry.milkTypeId,
            quantity: quantityInLiters, // Store in liters in database
            price_per_liter: currentEntry.pricePerLiter,
            total_amount: totalAmount,
            delivery_date: format(selectedDate, 'yyyy-MM-dd')
          })
          .select()
          .single();

        if (deliveryError) {
          console.error('Delivery error:', deliveryError);
          throw deliveryError;
        }

        deliveryRecordId = deliveryData.id;
      }

      // Insert grocery items
      if (currentEntry.groceryItems.length > 0) {
        const groceryItemsToInsert = currentEntry.groceryItems
          .filter(item => item.name && item.quantity > 0)
          .map(item => ({
            delivery_record_id: deliveryRecordId,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            price: Math.ceil(item.price),
            description: item.description || ''
          }));

        if (groceryItemsToInsert.length > 0) {
          const { error: groceryError } = await supabase
            .from('grocery_items')
            .insert(groceryItemsToInsert);

          if (groceryError) {
            console.error('Grocery error:', groceryError);
            throw groceryError;
          }
        }
      }

      // Update customer balance - store amount in rupees as whole numbers
      const totalAmount = calculateTotal();
      if (totalAmount > 0) {
        const { data: existingBalance } = await supabase
          .from('customer_balances')
          .select('pending_amount')
          .eq('customer_id', currentEntry.customerId)
          .maybeSingle();

        const newPendingAmount = Math.ceil((existingBalance?.pending_amount || 0) + totalAmount);

        const { error: balanceError } = await supabase
          .from('customer_balances')
          .upsert({
            customer_id: currentEntry.customerId,
            pending_amount: newPendingAmount,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'customer_id'
          });

        if (balanceError) {
          console.error('Balance error:', balanceError);
          throw balanceError;
        }
      }

      // Update customer memory - store quantity in ml
      if (!currentEntry.isGroceryOnly && currentEntry.milkTypeId && currentEntry.quantity > 0) {
        setCustomerMemory(prev => ({
          ...prev,
          [currentEntry.customerId]: {
            milkTypeId: currentEntry.milkTypeId,
            quantity: currentEntry.quantity // Store in ml
          }
        }));
      }

      return true;
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({
        title: "Error",
        description: "Failed to save delivery record",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    const saved = await saveCurrentEntry();
    if (saved) {
      toast({
        title: "Success",
        description: `Entry saved for ${currentEntry.customerName}`,
      });
      
      // Reset form for next entry
      setCurrentEntry({
        customerId: '',
        customerName: '',
        milkTypeId: '',
        milkTypeName: '',
        quantity: 0,
        pricePerLiter: 0,
        groceryItems: [],
        isGroceryOnly: false
      });
    }
  };

  const resetForm = () => {
    setCurrentEntry({
      customerId: '',
      customerName: '',
      milkTypeId: '',
      milkTypeName: '',
      quantity: 0,
      pricePerLiter: 0,
      groceryItems: [],
      isGroceryOnly: false
    });
  };

  if (customers.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500 mb-4">No customers found. Please add customers first.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Bulk Delivery Entry</h2>
      </div>

      {/* Date Selection */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Label>Delivery Date:</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      {/* Current Entry Form */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-blue-600">
            Entry Form
          </h3>
          <div className="flex gap-2">
            <Button
              onClick={resetForm}
              variant="outline"
              className="text-orange-600 hover:text-orange-700"
            >
              Reset Form
            </Button>
            <Button
              onClick={handleNext}
              className="bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Save Entry
            </Button>
          </div>
        </div>

        {/* Customer Selection */}
        <div className="mb-4">
          <Label>Customer *</Label>
          <Select value={currentEntry.customerId} onValueChange={(value) => updateEntry('customerId', value)}>
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

        {/* Grocery Only Toggle */}
        <div className="mb-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={currentEntry.isGroceryOnly}
              onChange={(e) => updateEntry('isGroceryOnly', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Grocery Only (No Milk)</span>
          </label>
        </div>

        {/* Milk Delivery Section */}
        {!currentEntry.isGroceryOnly && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label>Milk Type *</Label>
              <Select value={currentEntry.milkTypeId} onValueChange={(value) => updateEntry('milkTypeId', value)}>
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
              <Label>Quantity (ml) *</Label>
              <Input
                type="number"
                step="50"
                min="0"
                value={currentEntry.quantity || ''}
                onChange={(e) => updateEntry('quantity', e.target.value)}
                placeholder="e.g., 500"
              />
            </div>

            <div>
              <Label>Price per Liter (₹)</Label>
              <Input
                type="number"
                value={currentEntry.pricePerLiter || ''}
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>
        )}

        {/* Grocery Items Section */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Grocery Items</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={addGroceryItem}
              className="text-green-600 hover:text-green-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>

          {currentEntry.groceryItems.length > 0 && (
            <div className="space-y-3">
              {currentEntry.groceryItems.map((item, itemIndex) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-xs">Item Name</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateGroceryItem(itemIndex, 'name', e.target.value)}
                      placeholder="Item name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.quantity || ''}
                      onChange={(e) => updateGroceryItem(itemIndex, 'quantity', e.target.value)}
                      placeholder="Qty"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Input
                      value={item.unit}
                      onChange={(e) => updateGroceryItem(itemIndex, 'unit', e.target.value)}
                      placeholder="kg, pcs, etc"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Price (₹)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={item.price || ''}
                      onChange={(e) => updateGroceryItem(itemIndex, 'price', e.target.value)}
                      placeholder="Price"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateGroceryItem(itemIndex, 'description', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGroceryItem(itemIndex)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        {((!currentEntry.isGroceryOnly && currentEntry.quantity && currentEntry.pricePerLiter) || currentEntry.groceryItems.some(item => item.quantity && item.price)) && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              Total Amount: ₹{calculateTotal()}
              {!currentEntry.isGroceryOnly && currentEntry.quantity && (
                <span className="text-xs text-gray-600 ml-2">
                  ({currentEntry.quantity}ml = {(currentEntry.quantity / 1000).toFixed(2)}L)
                </span>
              )}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
