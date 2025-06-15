
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils"
import { format } from 'date-fns';
import { CalendarIcon, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
}

interface PaymentEntry {
  customerId: string;
  customerName: string;
  amount: string;
  paymentMethod: string;
  notes: string;
}

interface BulkPaymentEntryProps {
  onClose: () => void;
  onPaymentsSaved: () => void;
}

export const BulkPaymentEntry = ({ onClose, onPaymentsSaved }: BulkPaymentEntryProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0);
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (error) throw error;

      setCustomers(data || []);
      setEntries(data ? data.map(c => ({
        customerId: c.id,
        customerName: c.name,
        amount: '',
        paymentMethod: 'Cash',
        notes: ''
      })) : []);
    } catch (error: any) {
      console.error("Error loading customers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load customers."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  const handleEntryChange = (field: keyof PaymentEntry, value: string) => {
    setEntries(prevEntries => {
      const newEntries = [...prevEntries];
      newEntries[currentEntryIndex] = {
        ...newEntries[currentEntryIndex],
        [field]: value
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
        description: "Please select a payment date.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const paymentDate = format(selectedDate, 'yyyy-MM-dd');
      
      // Filter entries that have an amount
      const paymentsToInsert = entries
        .filter(entry => entry.amount && parseFloat(entry.amount) > 0)
        .map(entry => ({
          customer_name: entry.customerName,
          amount: parseFloat(entry.amount),
          payment_date: paymentDate,
          payment_method: entry.paymentMethod,
          notes: entry.notes.trim() || null
        }));

      if (paymentsToInsert.length === 0) {
        toast({
          title: "Error",
          description: "No valid payment entries found. Please enter amounts for at least one customer.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('payments')
        .insert(paymentsToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${paymentsToInsert.length} payment(s) saved successfully!`,
      });
      
      onPaymentsSaved();
      onClose();
    } catch (error: any) {
      console.error("Error saving payments:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save payments.",
      });
    } finally {
      setIsSaving(false);
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
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Bulk Payment Entry</h2>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Select Payment Date</h3>
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
            Payment Entry - {currentEntry.customerName}
          </h3>
          <div className="hidden sm:block space-x-2">
            <Button variant="outline" size="sm" onClick={handleSubmit} disabled={isSaving || isLoading}>
              {isSaving ? 'Saving...' : 'Save Payments'}
            </Button>
            <Button variant="destructive" size="sm" onClick={onClose} disabled={isSaving || isLoading}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={currentEntry.amount}
              onChange={(e) => handleEntryChange('amount', e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Input
              id="paymentMethod"
              placeholder="e.g., Cash, UPI, Card"
              value={currentEntry.paymentMethod}
              onChange={(e) => handleEntryChange('paymentMethod', e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Optional notes"
              value={currentEntry.notes}
              onChange={(e) => handleEntryChange('notes', e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>
      </Card>

      <div className="sm:hidden fixed bottom-0 left-0 w-full bg-gray-50 border-t p-4 flex justify-around">
        <Button className="w-1/2 mx-1" onClick={handleSubmit} disabled={isSaving || isLoading}>
          {isSaving ? 'Saving...' : 'Save Payments'}
        </Button>
        <Button variant="destructive" className="w-1/2 mx-1" onClick={onClose} disabled={isSaving || isLoading}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
