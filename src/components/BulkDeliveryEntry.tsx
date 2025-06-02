
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Plus, Trash2, ArrowRight, RotateCcw } from 'lucide-react';
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
  total: number;
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

interface CustomerBill {
  date: string;
  milkType: string;
  quantity: number;
  milkTotal: number;
  groceryItems: { name: string; price: number }[];
  totalAmount: number;
}

interface CustomerBills {
  [customerId: string]: {
    customerName: string;
    bills: CustomerBill[];
  };
}

export const BulkDeliveryEntry = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [milkTypes, setMilkTypes] = useState<MilkType[]>([]);
  const [customerMemory, setCustomerMemory] = useState<CustomerMemory>({});
  const [currentCustomerIndex, setCurrentCustomerIndex] = useState(0);
  const [customerBills, setCustomerBills] = useState<CustomerBills>({});
  const [selectedCustomerForBill, setSelectedCustomerForBill] = useState<string>('');
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
    loadCustomerBills();
  }, []);

  useEffect(() => {
    // Auto-select customer in secondary mode
    if (customers.length > 0) {
      const customer = customers[currentCustomerIndex];
      if (customer) {
        updateEntry('customerId', customer.id);
      }
    }
  }, [currentCustomerIndex, customers]);

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
            quantity: Math.round(record.quantity * 1000)
          };
        }
      });
      
      setCustomerMemory(memory);
    } catch (error) {
      console.error('Error loading customer memory:', error);
    }
  };

  const loadCustomerBills = async () => {
    try {
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_records')
        .select(`
          *,
          customers(name),
          milk_types(name)
        `)
        .order('delivery_date', { ascending: false });

      if (deliveryError) throw deliveryError;

      const { data: groceryData, error: groceryError } = await supabase
        .from('grocery_items')
        .select('*');

      if (groceryError) throw groceryError;

      const bills: CustomerBills = {};

      deliveryData?.forEach(record => {
        const customerId = record.customer_id;
        const customerName = record.customers?.name || 'Unknown';
        const date = record.delivery_date;

        if (!bills[customerId]) {
          bills[customerId] = {
            customerName,
            bills: []
          };
        }

        // Get grocery items for this delivery
        const relatedGroceryItems = groceryData?.filter(
          item => item.delivery_record_id === record.id
        ) || [];

        const groceryItems = relatedGroceryItems.map(item => ({
          name: item.name,
          price: item.price
        }));

        const groceryTotal = groceryItems.reduce((sum, item) => sum + item.price, 0);
        const milkTotal = record.total_amount - groceryTotal;

        bills[customerId].bills.push({
          date,
          milkType: record.milk_types?.name || 'Unknown',
          quantity: Math.round(record.quantity * 1000),
          milkTotal,
          groceryItems,
          totalAmount: record.total_amount
        });
      });

      setCustomerBills(bills);
    } catch (error) {
      console.error('Error loading customer bills:', error);
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
      total: 0
    };
    setCurrentEntry({
      ...currentEntry,
      groceryItems: [...currentEntry.groceryItems, newGroceryItem]
    });
  };

  const updateGroceryItem = (itemIndex: number, field: keyof GroceryItem, value: string | number) => {
    const updatedItems = [...currentEntry.groceryItems];
    if (field === 'total') {
      const numericValue = typeof value === 'string' ? Math.ceil(parseFloat(value) || 0) : Math.ceil(value);
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        total: numericValue
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
      const liters = currentEntry.quantity / 1000;
      milkTotal = liters * currentEntry.pricePerLiter;
    }
    
    const groceryTotal = currentEntry.groceryItems.reduce((sum, item) => {
      return sum + item.total;
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
      
      if (!currentEntry.isGroceryOnly && currentEntry.quantity > 0) {
        const totalAmount = calculateTotal();
        const quantityInLiters = currentEntry.quantity / 1000;
        
        const { data: deliveryData, error: deliveryError } = await supabase
          .from('delivery_records')
          .insert({
            customer_id: currentEntry.customerId,
            milk_type_id: currentEntry.milkTypeId,
            quantity: quantityInLiters,
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

      if (currentEntry.groceryItems.length > 0) {
        const groceryItemsToInsert = currentEntry.groceryItems
          .filter(item => item.name && item.total > 0)
          .map(item => ({
            delivery_record_id: deliveryRecordId,
            name: item.name,
            quantity: 1,
            unit: 'item',
            price: Math.ceil(item.total),
            description: ''
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

      if (!currentEntry.isGroceryOnly && currentEntry.milkTypeId && currentEntry.quantity > 0) {
        setCustomerMemory(prev => ({
          ...prev,
          [currentEntry.customerId]: {
            milkTypeId: currentEntry.milkTypeId,
            quantity: currentEntry.quantity
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
      
      // Move to next customer and cycle back to first after last
      const nextIndex = (currentCustomerIndex + 1) % customers.length;
      setCurrentCustomerIndex(nextIndex);
      
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

      // Reload customer bills to show updated data
      loadCustomerBills();
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

      {/* Current Customer Display */}
      <Card className="p-4">
        <div className="text-sm text-blue-600">
          Current Customer: {customers[currentCustomerIndex]?.name} ({currentCustomerIndex + 1}/{customers.length})
        </div>
      </Card>

      {/* Current Entry Form */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-blue-600">
            Entry Form - {currentEntry.customerName}
          </h3>
          <div className="flex gap-2">
            <Button
              onClick={resetForm}
              variant="outline"
              className="text-orange-600 hover:text-orange-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Form
            </Button>
            <Button
              onClick={handleNext}
              className="bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Save & Next
            </Button>
          </div>
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
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-xs">Item Name (Description)</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateGroceryItem(itemIndex, 'name', e.target.value)}
                      placeholder="Item description"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Total Price (₹)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={item.total || ''}
                      onChange={(e) => updateGroceryItem(itemIndex, 'total', e.target.value)}
                      placeholder="Total price"
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
        {((!currentEntry.isGroceryOnly && currentEntry.quantity && currentEntry.pricePerLiter) || currentEntry.groceryItems.some(item => item.total)) && (
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

      {/* Customer Bills Section */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Customer Bills</h3>
          <div>
            <Label>Select Customer to View Bills:</Label>
            <Select value={selectedCustomerForBill} onValueChange={setSelectedCustomerForBill}>
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
        </div>

        {selectedCustomerForBill && customerBills[selectedCustomerForBill] && (
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">
              Bills for {customerBills[selectedCustomerForBill].customerName}
            </h4>
            
            {customerBills[selectedCustomerForBill].bills.length === 0 ? (
              <p className="text-gray-500">No bills found for this customer.</p>
            ) : (
              <div className="space-y-3">
                {customerBills[selectedCustomerForBill].bills.map((bill, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-gray-900">
                        {format(new Date(bill.date), 'dd/MM/yyyy')}
                      </h5>
                      <span className="text-lg font-bold text-green-600">
                        ₹{bill.totalAmount}
                      </span>
                    </div>
                    
                    {bill.quantity > 0 && (
                      <div className="mb-2">
                        <p className="text-sm text-gray-700">
                          <strong>Milk:</strong> {bill.milkType} - {bill.quantity}ml 
                          <span className="text-green-600 ml-2">₹{bill.milkTotal}</span>
                        </p>
                      </div>
                    )}
                    
                    {bill.groceryItems.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Grocery Items:</p>
                        <div className="space-y-1">
                          {bill.groceryItems.map((item, itemIndex) => (
                            <p key={itemIndex} className="text-sm text-gray-600 ml-2">
                              • {item.name} - <span className="text-green-600">₹{item.price}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
