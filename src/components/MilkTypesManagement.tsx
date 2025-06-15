import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Milk } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MilkType {
  id: string;
  name: string;
  price_per_liter: number;
  description: string;
  created_at: string;
}

export const MilkTypesManagement = () => {
  const [milkTypes, setMilkTypes] = useState<MilkType[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMilkType, setEditingMilkType] = useState<MilkType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    pricePerLiter: '',
    description: ''
  });

  // Load milk types from Supabase on component mount
  useEffect(() => {
    loadMilkTypes();
  }, []);

  const loadMilkTypes = async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.pricePerLiter) {
      toast({
        title: "Error",
        description: "Name and price are required fields",
        variant: "destructive"
      });
      return;
    }

    const price = parseFloat(formData.pricePerLiter);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid price",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);

      if (editingMilkType) {
        // Update existing milk type
        const { error } = await supabase
          .from('milk_types')
          .update({
            name: formData.name.trim(),
            price_per_liter: price,
            description: formData.description.trim() || null
          })
          .eq('id', editingMilkType.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Milk type updated successfully"
        });
      } else {
        // Create new milk type
        const { error } = await supabase
          .from('milk_types')
          .insert({
            name: formData.name.trim(),
            price_per_liter: price,
            description: formData.description.trim() || null
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Milk type added successfully"
        });
      }

      // Reload milk types to get updated data
      await loadMilkTypes();
      
      // Reset form
      setFormData({ name: '', pricePerLiter: '', description: '' });
      setIsAddDialogOpen(false);
      setEditingMilkType(null);
    } catch (error) {
      console.error('Error saving milk type:', error);
      toast({
        title: "Error",
        description: "Failed to save milk type",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (milkType: MilkType) => {
    setEditingMilkType(milkType);
    setFormData({
      name: milkType.name,
      pricePerLiter: milkType.price_per_liter.toString(),
      description: milkType.description || ''
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (milkTypeId: string) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('milk_types')
        .delete()
        .eq('id', milkTypeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Milk type deleted successfully"
      });

      // Reload milk types
      await loadMilkTypes();
    } catch (error) {
      console.error('Error deleting milk type:', error);
      toast({
        title: "Error",
        description: "Failed to delete milk type",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Milk Types & Rates</h2>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Milk Type
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMilkType ? 'Edit Milk Type' : 'Add New Milk Type'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Milk Type Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Full Cream, Skimmed, Buffalo"
                  required
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  disabled={isLoading}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={isLoading}>
                  {isLoading ? 'Saving...' : (editingMilkType ? 'Update Milk Type' : 'Add Milk Type')}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingMilkType(null);
                    setFormData({ name: '', pricePerLiter: '', description: '' });
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

      {/* Milk Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <Card className="col-span-full p-8 text-center">
            <div className="text-gray-500">
              <p className="text-lg font-medium">Loading milk types...</p>
            </div>
          </Card>
        ) : milkTypes.length === 0 ? (
          <Card className="col-span-full p-8 text-center">
            <div className="text-gray-500">
              <Milk className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No milk types added yet</p>
              <p className="text-sm">Start by adding your first milk type and rate</p>
            </div>
          </Card>
        ) : (
          milkTypes.map((milkType) => (
            <Card key={milkType.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{milkType.name}</h3>
                  <p className="text-2xl font-bold text-green-600">₹{milkType.price_per_liter.toFixed(2)}/L</p>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(milkType)}
                    className="text-blue-600 hover:text-blue-900"
                    disabled={isLoading}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(milkType.id)}
                    className="text-red-600 hover:text-red-900"
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {milkType.description && (
                <p className="text-sm text-gray-600 mb-3">{milkType.description}</p>
              )}
              
              <div className="text-xs text-gray-400">
                Added on {new Date(milkType.created_at).toLocaleDateString()}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Summary Card */}
      {milkTypes.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{milkTypes.length}</p>
              <p className="text-sm text-gray-500">Total Milk Types</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                ₹{Math.min(...milkTypes.map(m => m.price_per_liter)).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Lowest Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                ₹{Math.max(...milkTypes.map(m => m.price_per_liter)).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Highest Rate</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
