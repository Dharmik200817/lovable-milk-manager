import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils"
import { format } from 'date-fns';
import { CalendarIcon, ArrowRight, SkipForward, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Customer {
  id: string;
  name: string;
  address: string;
  phone_number?: string;
}

interface MilkType {
  id:string;
  name: string;
  price_per_liter: number;
}

interface GroceryItem {
  name: string;
  price: number;
}

interface DeliveryEntry {
  customerId: string;
  customerName: string;
  milkTypeId: string;
  quantityInMl: number;
  groceryItems: GroceryItem[];
}

interface BulkDeliveryEntryProps {
  onClose: () => void;
}

export const BulkDeliveryEntry = ({ onClose }: BulkDeliveryEntryProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [milkTypes, setMilkTypes] = useState<MilkType[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0);
  const [entries, setEntries] = useState<DeliveryEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deliveryTime, setDeliveryTime] = useState<'morning' | 'evening'>('morning');
  const [isGroceryOnly, setIsGroceryOnly] = useState(false);
  const [newGroceryItem, setNewGroceryItem] = useState<GroceryItem>({
    name: '',
    price: 0
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (customers.length > 0 && currentEntryIndex < customers.length) {
      loadPreviousRecord(customers[currentEntryIndex].id);
    }
  }, [currentEntryIndex, customers]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, address, phone_number')
        .order('name');

      if (customersError) throw customersError;

      const { data: milkTypesData, error: milkTypesError } = await supabase
        .from('milk_types')
        .select('id, name, price_per_liter')
        .order('name');

      if (milkTypesError) throw milkTypesError;

      setCustomers(customersData || []);
      setMilkTypes(milkTypesData || []);
      setEntries(customersData ? customersData.map(c => ({
        customerId: c.id,
        customerName: c.name,
        milkTypeId: milkTypesData?.[0]?.id || '',
        quantityInMl: 0,
        groceryItems: []
      })) : []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load customers and milk types."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreviousRecord = async (customerId: string) => {
    try {
      // Get the most recent delivery record for this customer
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_records')
        .select('milk_type_id, quantity, notes')
        .eq('customer_id', customerId)
        .order('delivery_date', { ascending: false })
        .limit(1);

      if (deliveryError) throw deliveryError;

      if (deliveryData && deliveryData.length > 0) {
        const lastDelivery = deliveryData[0];
        
        // Auto-fill milk type and quantity
        setEntries(prevEntries => {
          const newEntries = [...prevEntries];
          if (newEntries[currentEntryIndex]) {
            newEntries[currentEntryIndex].milkTypeId = lastDelivery.milk_type_id;
            newEntries[currentEntryIndex].quantityInMl = Math.round(lastDelivery.quantity * 1000);
          }
          return newEntries;
        });

        // Extract delivery time from notes if available
        if (lastDelivery.notes && lastDelivery.notes.includes('Delivery Time:')) {
          const timeMatch = lastDelivery.notes.match(/Delivery Time: (morning|evening)/);
          if (timeMatch) {
            setDeliveryTime(timeMatch[1] as 'morning' | 'evening');
          }
        }
      }
    } catch (error: any) {
      console.error("Error loading previous record:", error);
      // Don't show error toast for this as it's not critical
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };
  
  const handleMilkTypeChange = (milkTypeId: string) => {
    setEntries(prevEntries => {
      const newEntries = [...prevEntries];
      if (newEntries[currentEntryIndex]) {
        newEntries[currentEntryIndex].milkTypeId = milkTypeId;
      }
      return newEntries;
    });
  };

  const handleQuantityChange = (quantityInMl: number) => {
    setEntries(prevEntries => {
      const newEntries = [...prevEntries];
      if (newEntries[currentEntryIndex]) {
        newEntries[currentEntryIndex].quantityInMl = isNaN(quantityInMl) ? 0 : quantityInMl;
      }
      return newEntries;
    });
  };

  const addGroceryItem = () => {
    if (!newGroceryItem.name || newGroceryItem.price <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill grocery item name and price."
      });
      return;
    }

    setEntries(prevEntries => {
      const newEntries = [...prevEntries];
      if (newEntries[currentEntryIndex]) {
        newEntries[currentEntryIndex].groceryItems.push({...newGroceryItem});
      }
      return newEntries;
    });

    setNewGroceryItem({
      name: '',
      price: 0
    });
  };

  const removeGroceryItem = (index: number) => {
    setEntries(prevEntries => {
      const newEntries = [...prevEntries];
      if (newEntries[currentEntryIndex]) {
        newEntries[currentEntryIndex].groceryItems.splice(index, 1);
      }
      return newEntries;
    });
  };

  const updateGroceryItem = (index: number, field: keyof GroceryItem, value: any) => {
    setEntries(prevEntries => {
      const newEntries = [...prevEntries];
      if (newEntries[currentEntryIndex]) {
        (newEntries[currentEntryIndex].groceryItems[index] as any)[field] = value;
      }
      return newEntries;
    });
  };

  const goToNextCustomer = () => {
    if (currentEntryIndex < entries.length - 1) {
      setCurrentEntryIndex(currentEntryIndex + 1);
      setIsGroceryOnly(false);
      // Don't auto-advance date - let user control the date
    } else {
      // Instead of closing, show completion message and reset to first customer
      toast({ 
        title: "All entries complete!", 
        description: "Starting over from first customer.",
        duration: 3000
      });
      setCurrentEntryIndex(0);
      setIsGroceryOnly(false);
      // Reset date to today for new cycle
      setSelectedDate(new Date());
    }
  }

  const handleSkipCustomer = () => {
    goToNextCustomer();
  };

  const handleSaveAndNext = async () => {
    if (!selectedDate) {
      toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const entry = entries[currentEntryIndex];

    try {
        const deliveryDate = format(selectedDate, 'yyyy-MM-dd');
        let deliveryRecordId = null;

        // Calculate grocery total
        const groceryAmount = entry.groceryItems.reduce((sum, item) => sum + item.price, 0);

        // Save milk delivery if not grocery only
        if (!isGroceryOnly && entry.quantityInMl > 0 && entry.milkTypeId) {
            const milkType = milkTypes.find(mt => mt.id === entry.milkTypeId);
            if (milkType) {
                const quantityInLiters = entry.quantityInMl / 1000;
                const totalAmount = quantityInLiters * milkType.price_per_liter + groceryAmount;
                
                // Create notes with grocery info if there are grocery items
                let notes = `Delivery Time: ${deliveryTime}`;
                if (entry.groceryItems.length > 0) {
                    const groceryNames = entry.groceryItems.map(item => `${item.name} (₹${item.price})`).join(', ');
                    notes += ` | Grocery: ${groceryNames}`;
                }
                
                const deliveryRecord = {
                    customer_id: entry.customerId,
                    delivery_date: deliveryDate,
                    milk_type_id: entry.milkTypeId,
                    quantity: quantityInLiters,
                    price_per_liter: milkType.price_per_liter,
                    total_amount: totalAmount,
                    notes: notes
                };
                
                const { data, error } = await supabase
                    .from('delivery_records')
                    .insert([deliveryRecord])
                    .select()
                    .single();
                
                if (error) throw error;
                deliveryRecordId = data.id;
            }
        } else if (entry.groceryItems.length > 0) {
            // If grocery only, create a delivery record for grocery items
            const groceryNames = entry.groceryItems.map(item => `${item.name} (₹${item.price})`).join(', ');
            
            const deliveryRecord = {
                customer_id: entry.customerId,
                delivery_date: deliveryDate,
                milk_type_id: milkTypes[0]?.id || '', // Use first milk type as placeholder
                quantity: 0,
                price_per_liter: 0,
                total_amount: groceryAmount,
                notes: `Grocery Only - Delivery Time: ${deliveryTime} | Grocery: ${groceryNames}`
            };
            
            const { data, error } = await supabase
                .from('delivery_records')
                .insert([deliveryRecord])
                .select()
                .single();
            
            if (error) throw error;
            deliveryRecordId = data.id;
        }
        
        toast({
            title: `Saved for ${entry.customerName}`,
            description: "Moving to next customer.",
            duration: 1500,
        });

        // --- Change: DO NOT ADVANCE THE DATE. ---
        // Just go to next customer, but keep `selectedDate` the same.

        goToNextCustomer();

    } catch (error: any) {
        console.error("Error saving delivery record:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: `Failed to save for ${entry.customerName}.`,
        });
    } finally {
        setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading customers...</div>;
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No customers found. Please add customers first.</p>
      </div>
    );
  }

  const currentEntry = entries[currentEntryIndex];
  const selectedMilkType = milkTypes.find(mt => mt.id === currentEntry?.milkTypeId);
  const quantityInLiters = currentEntry?.quantityInMl / 1000 || 0;
  const milkAmount = quantityInLiters * (selectedMilkType?.price_per_liter || 0);
  const groceryAmount = currentEntry?.groceryItems.reduce((sum, item) => sum + item.price, 0) || 0;
  const totalAmount = milkAmount + groceryAmount;

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Label htmlFor="delivery-date">Delivery Date:</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="delivery-date"
                variant={"outline"}
                className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} disabled={isLoading} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </Card>
      
      <Card className="p-4">
          <div className="flex items-center justify-between">
              <p className="text-sm text-purple-700 font-medium">
                  Current Customer: {currentEntry?.customerName} ({currentEntryIndex + 1}/{entries.length})
              </p>
              <Button variant="outline" size="sm" onClick={onClose}>Switch to Manual</Button>
          </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-blue-600 mb-4">
          Entry Form - {currentEntry?.customerName}
        </h3>
        <div className="space-y-6">
            <div>
              <Label>Delivery Time</Label>
              <div className="flex gap-2 mt-2">
                  <Button variant={deliveryTime === 'morning' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryTime('morning')}>Morning</Button>
                  <Button variant={deliveryTime === 'evening' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryTime('evening')}>Evening</Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
                <Checkbox id="grocery" checked={isGroceryOnly} onCheckedChange={(checked) => setIsGroceryOnly(checked as boolean)} />
                <Label htmlFor="grocery">Grocery Only (No Milk)</Label>
            </div>
            
            <div className={cn("space-y-4", isGroceryOnly && "opacity-50 pointer-events-none")}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <Label htmlFor="milk-type">Milk Type *</Label>
                        <Select value={currentEntry?.milkTypeId} onValueChange={handleMilkTypeChange}>
                          <SelectTrigger id="milk-type">
                            <SelectValue placeholder="Select milk type" />
                          </SelectTrigger>
                          <SelectContent>
                            {milkTypes.map(mt => (
                              <SelectItem key={mt.id} value={mt.id}>{mt.name} - ₹{mt.price_per_liter}/L</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="quantity">Quantity (ml) *</Label>
                        <Input id="quantity" type="number" placeholder="e.g. 1500" value={currentEntry?.quantityInMl || ''} onChange={e => handleQuantityChange(parseInt(e.target.value))} />
                    </div>
                    <div>
                        <Label>Price per Liter (₹)</Label>
                        <Input value={selectedMilkType?.price_per_liter || ''} readOnly className="bg-gray-100" />
                    </div>
                </div>
                {milkAmount > 0 && (
                    <div className="bg-blue-50 p-3 rounded-md">
                        <p className="text-sm text-blue-800">
                            Milk Amount: ₹{milkAmount.toFixed(2)} ({quantityInLiters.toFixed(2)}L)
                        </p>
                    </div>
                )}
            </div>

            <div>
                <Label>Grocery Items (Optional)</Label>
                
                {/* Add new grocery item */}
                <div className="mt-2 border-dashed border-2 border-gray-300 p-4 rounded-md space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            placeholder="Item name"
                            value={newGroceryItem.name}
                            onChange={e => setNewGroceryItem({...newGroceryItem, name: e.target.value})}
                        />
                        <Input
                            type="number"
                            placeholder="Price (₹)"
                            value={newGroceryItem.price || ''}
                            onChange={e => setNewGroceryItem({...newGroceryItem, price: parseFloat(e.target.value) || 0})}
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={addGroceryItem} className="w-full">
                        <Plus className="mr-2 h-4 w-4"/>
                        Add Grocery Item
                    </Button>
                </div>

                {/* Display existing grocery items */}
                {currentEntry?.groceryItems.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <Label className="text-sm font-medium">Added Items:</Label>
                        {currentEntry.groceryItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                                <Input
                                    value={item.name}
                                    onChange={e => updateGroceryItem(index, 'name', e.target.value)}
                                    className="flex-1"
                                    placeholder="Item name"
                                />
                                <Input
                                    type="number"
                                    value={item.price}
                                    onChange={e => updateGroceryItem(index, 'price', parseFloat(e.target.value) || 0)}
                                    className="w-24"
                                    placeholder="Price"
                                />
                                <span className="text-sm font-medium w-16">₹{item.price.toFixed(2)}</span>
                                <Button variant="ghost" size="sm" onClick={() => removeGroceryItem(index)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        ))}
                        {groceryAmount > 0 && (
                            <div className="bg-green-50 p-3 rounded-md">
                                <p className="text-sm text-green-800">
                                    Grocery Amount: ₹{groceryAmount.toFixed(2)}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-blue-50 p-4 rounded-md text-center">
                <p className="font-bold text-lg text-blue-800">
                    Total Amount: ₹{totalAmount.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">
                    {milkAmount > 0 && `Milk: ₹${milkAmount.toFixed(2)}`}
                    {milkAmount > 0 && groceryAmount > 0 && " + "}
                    {groceryAmount > 0 && `Grocery: ₹${groceryAmount.toFixed(2)}`}
                </p>
            </div>
        </div>
        
        {/* Desktop buttons - hidden on mobile */}
        <div className="hidden md:flex gap-4 mt-6">
            <Button variant="outline" className="w-full" onClick={handleSkipCustomer} disabled={isSaving}>
                <SkipForward className="mr-2" /> Skip Customer
            </Button>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleSaveAndNext} disabled={isSaving}>
                {isSaving ? 'Saving...' : <><ArrowRight className="mr-2" /> Save & Next</>}
            </Button>
        </div>
      </Card>
      
      {/* Mobile fixed bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex gap-4 md:hidden z-50">
          <Button variant="outline" className="w-full" onClick={handleSkipCustomer} disabled={isSaving}>
              <SkipForward className="mr-2" /> Skip Customer
          </Button>
          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleSaveAndNext} disabled={isSaving}>
              {isSaving ? 'Saving...' : <><ArrowRight className="mr-2" /> Save & Next</>}
          </Button>
      </div>
    </div>
  );
};
