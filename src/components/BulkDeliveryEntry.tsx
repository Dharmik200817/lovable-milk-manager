
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
import { CalendarIcon, ArrowRight, SkipForward, Plus } from 'lucide-react';
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

interface DeliveryEntry {
  customerId: string;
  customerName: string;
  milkTypeId: string;
  quantityInMl: number;
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

  useEffect(() => {
    loadInitialData();
  }, []);

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
        quantityInMl: 0
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

  const goToNextCustomer = () => {
    if (currentEntryIndex < entries.length - 1) {
      setCurrentEntryIndex(currentEntryIndex + 1);
      setIsGroceryOnly(false);
    } else {
      toast({ title: "All entries complete!" });
      onClose();
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
        const quantityInLiters = entry.quantityInMl / 1000;

        if (!isGroceryOnly && quantityInLiters > 0 && entry.milkTypeId) {
            const milkType = milkTypes.find(mt => mt.id === entry.milkTypeId);
            if (milkType) {
                const totalAmount = quantityInLiters * milkType.price_per_liter;
                const deliveryRecord = {
                    customer_id: entry.customerId,
                    delivery_date: deliveryDate,
                    milk_type_id: entry.milkTypeId,
                    quantity: quantityInLiters,
                    price_per_liter: milkType.price_per_liter,
                    total_amount: totalAmount,
                    notes: `Delivery Time: ${deliveryTime}`
                };
                const { error } = await supabase.from('delivery_records').insert([deliveryRecord]);
                if (error) throw error;
            }
        }
        
        toast({
            title: `Saved for ${entry.customerName}`,
            description: "Moving to next customer.",
            duration: 1500,
        });
        
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
  const totalAmount = quantityInLiters * (selectedMilkType?.price_per_liter || 0);

  return (
    <div className="space-y-4">
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
            </div>

            <div>
                <Label>Grocery Items</Label>
                <div className="mt-2 text-center border-dashed border-2 border-gray-300 p-4 rounded-md">
                    <Button variant="outline" size="sm" disabled>
                        <Plus className="mr-2 h-4 w-4"/>
                        Add Item
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">Grocery tracking coming soon!</p>
                </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-md text-center">
                <p className="font-bold text-lg text-blue-800">
                    Total Amount: ₹{totalAmount.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">({currentEntry?.quantityInMl || 0}ml = {quantityInLiters.toFixed(2)}L)</p>
            </div>
        </div>
        <div className="flex gap-4 mt-6">
            <Button variant="outline" className="w-full" onClick={handleSkipCustomer} disabled={isSaving}>
                <SkipForward className="mr-2" /> Skip Customer
            </Button>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleSaveAndNext} disabled={isSaving}>
                {isSaving ? 'Saving...' : <><ArrowRight className="mr-2" /> Save & Next</>}
            </Button>
        </div>
      </Card>
    </div>
  );
};
