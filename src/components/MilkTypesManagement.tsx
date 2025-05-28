import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Milk } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MilkType {
  id: string;
  name: string;
  pricePerLiter: number;
  description: string;
  createdDate: string;
}

export const MilkTypesManagement = () => {
  const [milkTypes, setMilkTypes] = useState<MilkType[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMilkType, setEditingMilkType] = useState<MilkType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    pricePerLiter: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.pricePerLiter) {
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

    if (editingMilkType) {
      setMilkTypes(milkTypes.map(milkType =>
        milkType.id === editingMilkType.id
          ? { 
              ...milkType, 
              name: formData.name,
              pricePerLiter: price,
              description: formData.description
            }
          : milkType
      ));
      toast({
        title: "Success",
        description: "Milk type updated successfully"
      });
    } else {
      const newMilkType: MilkType = {
        id: Date.now().toString(),
        name: formData.name,
        pricePerLiter: price,
        description: formData.description,
        createdDate: new Date().toISOString().split('T')[0]
      };
      setMilkTypes([...milkTypes, newMilkType]);
      toast({
        title: "Success",
        description: "Milk type added successfully"
      });
    }

    setFormData({ name: '', pricePerLiter: '', description: '' });
    setIsAddDialogOpen(false);
    setEditingMilkType(null);
  };

  const handleEdit = (milkType: MilkType) => {
    setEditingMilkType(milkType);
    setFormData({
      name: milkType.name,
      pricePerLiter: milkType.pricePerLiter.toString(),
      description: milkType.description
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (milkTypeId: string) => {
    setMilkTypes(milkTypes.filter(milkType => milkType.id !== milkTypeId));
    toast({
      title: "Success",
      description: "Milk type deleted successfully"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Milk Types & Rates</h2>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
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
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                  {editingMilkType ? 'Update Milk Type' : 'Add Milk Type'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingMilkType(null);
                    setFormData({ name: '', pricePerLiter: '', description: '' });
                  }}
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
        {milkTypes.length === 0 ? (
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
                  <p className="text-2xl font-bold text-green-600">₹{milkType.pricePerLiter.toFixed(2)}/L</p>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(milkType)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(milkType.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {milkType.description && (
                <p className="text-sm text-gray-600 mb-3">{milkType.description}</p>
              )}
              
              <div className="text-xs text-gray-400">
                Added on {new Date(milkType.createdDate).toLocaleDateString()}
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
                ₹{Math.min(...milkTypes.map(m => m.pricePerLiter)).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Lowest Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                ₹{Math.max(...milkTypes.map(m => m.pricePerLiter)).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Highest Rate</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
