import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils"
import { format } from 'date-fns';
import { CalendarIcon, CheckCircle, Circle, Plus, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  address: string;
  phone_number?: string;
}

interface MilkType {
  id: string;
  name: string;
  price_per_liter: number;
}

interface DeliveryEntry {
  customerId: string;
  customerName: string;
  milkTypeEntries: {
    [milkTypeId: string]: number;
  };
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
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const { toast } = useToast()

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
        milkTypeEntries: {}
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

  const handleQuantityChange = (milkTypeId: string, quantity: number) => {
    setEntries(prevEntries => {
      const newEntries = [...prevEntries];
      newEntries[currentEntryIndex] = {
        ...newEntries[currentEntryIndex],
        milkTypeEntries: {
          ...newEntries[currentEntryIndex].milkTypeEntries,
          [milkTypeId]: quantity
        }
      };
      return newEntries;
    });
  };

  const handleNextEntry = () => {
    if (currentEntryIndex < entries.length - 1) {
      setCurrentEntryIndex(currentEntryIndex + 1);
    }
  };

  const handlePreviousEntry = () => {
    if (currentEntryIndex > 0) {
      setCurrentEntryIndex(currentEntryIndex - 1);
    }
  };

  const currentEntry = entries[currentEntryIndex];

  const handleSubmit = async () => {
    if (!selectedDate) {
      toast({
        title: "Error",
        description: "Please select a date for the deliveries.",
        variant: "destructive",
      })
      return;
    }

    setIsSaving(true);
    try {
      const deliveryDate = format(selectedDate, 'yyyy-MM-dd');
      const deliveryRecordsToInsert = entries.map(entry => {
        const milkTypeEntriesArray = Object.entries(entry.milkTypeEntries).map(([milkTypeId, quantity]) => ({
          milk_type_id: milkTypeId,
          quantity: quantity
        }));

        return {
          customer_id: entry.customerId,
          delivery_date: deliveryDate,
          milk_entries: milkTypeEntriesArray
        };
      });

      // Function to insert delivery records
      const insertDeliveryRecords = async () => {
        const { error } = await supabase
          .from('delivery_records')
          .insert(
            deliveryRecordsToInsert.map(record => ({
              customer_id: record.customer_id,
              delivery_date: record.delivery_date
            }))
          );

        if (error) {
          throw error;
        }
      };

      // Function to insert grocery items
      const insertGroceryItems = async () => {
        // Fetch delivery_record IDs for the given customer IDs and delivery date
        const { data: deliveryRecords, error: deliveryRecordsError } = await supabase
          .from('delivery_records')
          .select('id, customer_id')
          .in('customer_id', deliveryRecordsToInsert.map(record => record.customer_id))
          .eq('delivery_date', deliveryDate);

        if (deliveryRecordsError) {
          throw deliveryRecordsError;
        }

        if (!deliveryRecords || deliveryRecords.length === 0) {
          throw new Error('No delivery records found for the given customers and date.');
        }

        // Prepare grocery items for insertion
        const groceryItemsToInsert = [];
        for (const record of deliveryRecordsToInsert) {
          const deliveryRecord = deliveryRecords.find(dr => dr.customer_id === record.customer_id);
          if (deliveryRecord) {
            for (const milkEntry of record.milk_entries) {
              groceryItemsToInsert.push({
                delivery_record_id: deliveryRecord.id,
                milk_type_id: milkEntry.milk_type_id,
                quantity: milkEntry.quantity
              });
            }
          }
        }

        // Insert grocery items
        const { error: groceryItemsError } = await supabase
          .from('grocery_items')
          .insert(groceryItemsToInsert);

        if (groceryItemsError) {
          throw groceryItemsError;
        }
      };

      // Execute the database operations
      await insertDeliveryRecords();
      await insertGroceryItems();

      toast({
        title: "Success",
        description: "Delivery records saved successfully!",
      })
      onClose();
    } catch (error: any) {
      console.error("Error saving delivery records:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save delivery records.",
      })
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomerIds(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(customerId)) {
        newSelection.delete(customerId);
      } else {
        newSelection.add(customerId);
      }
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    setIsAllSelected(prev => !prev);
    setSelectedCustomerIds(prev => {
      if (!isAllSelected) {
        return new Set(customers.map(c => c.id));
      } else {
        return new Set();
      }
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedCustomerIds.size === 0) {
      toast({
        title: "Error",
        description: "No customers selected for deletion.",
        variant: "destructive",
      })
      return;
    }

    if (!window.confirm("Are you sure you want to delete the selected customers? This action cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    try {
      // Delete customers from Supabase
      const { error } = await supabase
        .from('customers')
        .delete()
        .in('id', Array.from(selectedCustomerIds));

      if (error) {
        throw error;
      }

      // Update state
      setCustomers(prevCustomers => prevCustomers.filter(c => !selectedCustomerIds.has(c.id)));
      setSelectedCustomerIds(new Set());
      setIsAllSelected(false);

      toast({
        title: "Success",
        description: "Selected customers deleted successfully!",
      })
    } catch (error: any) {
      console.error("Error deleting customers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete selected customers.",
      })
    } finally {
      setIsLoading(false);
    }
  };

  if (customers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No customers found. Please add customers first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Bulk Delivery Entry</h2>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Select Delivery Date</h3>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
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
                onSelect={handleDateSelect}
                disabled={isLoading}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Customer Information</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handlePreviousEntry} disabled={currentEntryIndex === 0 || isLoading}>
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              {currentEntryIndex + 1} / {entries.length}
            </span>
            <Button variant="outline" size="sm" onClick={handleNextEntry} disabled={currentEntryIndex === entries.length - 1 || isLoading}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-blue-600">
            Entry Form - {currentEntry.customerName}
          </h3>
          <div className="hidden sm:block space-x-2">
            <Button variant="outline" size="sm" onClick={handleSubmit} disabled={isSaving || isLoading}>
              {isSaving ? 'Saving...' : 'Save Delivery'}
            </Button>
            <Button variant="destructive" size="sm" onClick={onClose} disabled={isSaving || isLoading}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {milkTypes.map(milkType => (
            <div key={milkType.id} className="flex items-center space-x-2">
              <Label htmlFor={`milk-${milkType.id}`} className="w-24 text-right">
                {milkType.name}:
              </Label>
              <Input
                type="number"
                id={`milk-${milkType.id}`}
                placeholder="0"
                min="0"
                value={currentEntry.milkTypeEntries[milkType.id] || ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  handleQuantityChange(milkType.id, isNaN(value) ? 0 : value);
                }}
                disabled={isLoading}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="sm:hidden fixed bottom-0 left-0 w-full bg-gray-50 border-t p-4 flex justify-around">
        <Button className="w-1/2 mx-1" onClick={handleSubmit} disabled={isSaving || isLoading}>
          {isSaving ? 'Saving...' : 'Save Delivery'}
        </Button>
        <Button variant="destructive" className="w-1/2 mx-1" onClick={onClose} disabled={isSaving || isLoading}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
