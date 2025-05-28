
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Plus, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

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
  milkType: string;
  quantity: number;
  pricePerLiter: number;
  groceryItems: GroceryItem[];
}

export const BulkDeliveryEntry = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([]);

  // Mock data for demo
  const mockCustomers = [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
    { id: '3', name: 'Bob Johnson' },
  ];

  const mockMilkTypes = [
    { name: 'Full Cream', price: 55 },
    { name: 'Skimmed', price: 50 },
    { name: 'Toned', price: 52 },
  ];

  const addNewEntry = () => {
    const newEntry: BulkEntry = {
      customerId: '',
      customerName: '',
      milkType: '',
      quantity: 0,
      pricePerLiter: 0,
      groceryItems: []
    };
    setBulkEntries([...bulkEntries, newEntry]);
  };

  const updateEntry = (index: number, field: keyof BulkEntry, value: string | number) => {
    const updatedEntries = [...bulkEntries];
    if (field === 'customerId') {
      const customer = mockCustomers.find(c => c.id === value);
      updatedEntries[index] = {
        ...updatedEntries[index],
        customerId: value as string,
        customerName: customer?.name || ''
      };
    } else if (field === 'milkType') {
      const milk = mockMilkTypes.find(m => m.name === value);
      updatedEntries[index] = {
        ...updatedEntries[index],
        milkType: value as string,
        pricePerLiter: milk?.price || 0
      };
    } else if (field === 'quantity') {
      updatedEntries[index] = { ...updatedEntries[index], quantity: parseFloat(value as string) || 0 };
    } else if (field === 'pricePerLiter') {
      updatedEntries[index] = { ...updatedEntries[index], pricePerLiter: parseFloat(value as string) || 0 };
    } else {
      updatedEntries[index] = { ...updatedEntries[index], [field]: value };
    }
    setBulkEntries(updatedEntries);
  };

  const removeEntry = (index: number) => {
    setBulkEntries(bulkEntries.filter((_, i) => i !== index));
  };

  const addGroceryItem = (entryIndex: number) => {
    const updatedEntries = [...bulkEntries];
    const newGroceryItem: GroceryItem = {
      id: Date.now().toString(),
      name: '',
      quantity: 0,
      unit: '',
      price: 0,
      description: ''
    };
    updatedEntries[entryIndex].groceryItems.push(newGroceryItem);
    setBulkEntries(updatedEntries);
  };

  const updateGroceryItem = (entryIndex: number, itemIndex: number, field: keyof GroceryItem, value: string | number) => {
    const updatedEntries = [...bulkEntries];
    if (field === 'quantity') {
      updatedEntries[entryIndex].groceryItems[itemIndex] = {
        ...updatedEntries[entryIndex].groceryItems[itemIndex],
        quantity: parseFloat(value as string) || 0
      };
    } else if (field === 'price') {
      updatedEntries[entryIndex].groceryItems[itemIndex] = {
        ...updatedEntries[entryIndex].groceryItems[itemIndex],
        price: parseFloat(value as string) || 0
      };
    } else {
      updatedEntries[entryIndex].groceryItems[itemIndex] = {
        ...updatedEntries[entryIndex].groceryItems[itemIndex],
        [field]: value
      };
    }
    setBulkEntries(updatedEntries);
  };

  const removeGroceryItem = (entryIndex: number, itemIndex: number) => {
    const updatedEntries = [...bulkEntries];
    updatedEntries[entryIndex].groceryItems = updatedEntries[entryIndex].groceryItems.filter((_, i) => i !== itemIndex);
    setBulkEntries(updatedEntries);
  };

  const handleSaveAll = () => {
    if (bulkEntries.length === 0) {
      toast({
        title: "Error",
        description: "No entries to save",
        variant: "destructive"
      });
      return;
    }

    // Validate entries
    for (let i = 0; i < bulkEntries.length; i++) {
      const entry = bulkEntries[i];
      if (!entry.customerId || !entry.milkType || entry.quantity <= 0 || entry.pricePerLiter <= 0) {
        toast({
          title: "Error",
          description: `Entry ${i + 1}: Please fill in all required fields for milk delivery`,
          variant: "destructive"
        });
        return;
      }
    }

    // Here you would save to database
    console.log('Saving bulk entries:', { date: selectedDate, entries: bulkEntries });
    
    toast({
      title: "Success",
      description: `Saved ${bulkEntries.length} delivery entries for ${format(selectedDate, 'PPP')}`
    });

    setBulkEntries([]);
  };

  const calculateTotal = (entry: BulkEntry) => {
    const milkTotal = entry.quantity * entry.pricePerLiter;
    const groceryTotal = entry.groceryItems.reduce((sum, item) => {
      return sum + (item.quantity * item.price);
    }, 0);
    return milkTotal + groceryTotal;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Bulk Delivery Entry</h2>
        <div className="flex gap-3">
          <Button onClick={addNewEntry} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
          <Button onClick={handleSaveAll} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            Save All
          </Button>
        </div>
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
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      {/* Bulk Entries */}
      <div className="space-y-4">
        {bulkEntries.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500 mb-4">No entries yet. Add your first entry to get started.</p>
            <Button onClick={addNewEntry} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Add First Entry
            </Button>
          </Card>
        ) : (
          bulkEntries.map((entry, entryIndex) => (
            <Card key={entryIndex} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Entry #{entryIndex + 1}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(entryIndex)}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Milk Delivery Section */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <Label>Customer *</Label>
                  <Select onValueChange={(value) => updateEntry(entryIndex, 'customerId', value)}>
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
                  <Label>Milk Type *</Label>
                  <Select onValueChange={(value) => updateEntry(entryIndex, 'milkType', value)}>
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
                  <Label>Quantity (L) *</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={entry.quantity || ''}
                    onChange={(e) => updateEntry(entryIndex, 'quantity', e.target.value)}
                    placeholder="e.g., 2.5"
                  />
                </div>

                <div>
                  <Label>Price per Liter (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={entry.pricePerLiter || ''}
                    onChange={(e) => updateEntry(entryIndex, 'pricePerLiter', e.target.value)}
                    placeholder="e.g., 55.00"
                  />
                </div>
              </div>

              {/* Grocery Items Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Grocery Items (Optional)</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addGroceryItem(entryIndex)}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>

                {entry.groceryItems.length > 0 && (
                  <div className="space-y-3">
                    {entry.groceryItems.map((item, itemIndex) => (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Label className="text-xs">Item Name</Label>
                          <Input
                            value={item.name}
                            onChange={(e) => updateGroceryItem(entryIndex, itemIndex, 'name', e.target.value)}
                            placeholder="Item name"
                            size="sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.quantity || ''}
                            onChange={(e) => updateGroceryItem(entryIndex, itemIndex, 'quantity', e.target.value)}
                            placeholder="Qty"
                            size="sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Unit</Label>
                          <Input
                            value={item.unit}
                            onChange={(e) => updateGroceryItem(entryIndex, itemIndex, 'unit', e.target.value)}
                            placeholder="kg, pcs, etc"
                            size="sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Price (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price || ''}
                            onChange={(e) => updateGroceryItem(entryIndex, itemIndex, 'price', e.target.value)}
                            placeholder="Price"
                            size="sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => updateGroceryItem(entryIndex, itemIndex, 'description', e.target.value)}
                            placeholder="Optional"
                            size="sm"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeGroceryItem(entryIndex, itemIndex)}
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
              {(entry.quantity && entry.pricePerLiter) && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">
                    Total Amount: ₹{calculateTotal(entry).toFixed(2)}
                  </p>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
