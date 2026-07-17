import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { 
  Plus, 
  Pencil, 
  Trash2,
  Package,
  Search,
  X,
  Save,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { MOTORCYCLE_DATABASE as MOTORCYCLE_DATABASE_IMPORT } from '../../data/motorcycleDatabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOTORCYCLE_DATABASE = MOTORCYCLE_DATABASE_IMPORT;

const MOTORCYCLE_BRANDS = Object.keys(MOTORCYCLE_DATABASE).sort();

const AdminParts = () => {
  const { t } = useTranslation();
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    compatible_motorcycles: {}, // { brand: [model1, model2], ... }
    stock: '',
    sku: '',
    images: []
  });

  // Motorcycle wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModels, setSelectedModels] = useState({});

  // Category form state
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchCategories();
    fetchParts();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/parts/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchParts = async () => {
    try {
      const response = await axios.get(`${API}/parts/all`);
      setParts(response.data);
    } catch (error) {
      toast.error(t('messages.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  // Wizard functions
  const openWizard = () => {
    setSelectedModels({ ...formData.compatible_motorcycles });
    setWizardStep(1);
    setSelectedBrand(null);
    setWizardOpen(true);
  };

  const handleBrandSelect = (brand) => {
    setSelectedBrand(brand);
    setWizardStep(2);
  };

  const handleModelToggle = (model) => {
    if (!selectedBrand) return;
    
    setSelectedModels(prev => {
      const brandModels = prev[selectedBrand] || [];
      if (brandModels.includes(model)) {
        const newModels = brandModels.filter(m => m !== model);
        if (newModels.length === 0) {
          const { [selectedBrand]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [selectedBrand]: newModels };
      } else {
        return { ...prev, [selectedBrand]: [...brandModels, model] };
      }
    });
  };

  const handleSelectAllModels = () => {
    if (!selectedBrand) return;
    const allModels = MOTORCYCLE_DATABASE[selectedBrand] || [];
    const currentModels = selectedModels[selectedBrand] || [];
    
    if (currentModels.length === allModels.length) {
      // Deselect all
      const { [selectedBrand]: _, ...rest } = selectedModels;
      setSelectedModels(rest);
    } else {
      // Select all
      setSelectedModels(prev => ({ ...prev, [selectedBrand]: [...allModels] }));
    }
  };

  const handleSelectAllBrands = () => {
    const allSelected = MOTORCYCLE_BRANDS.every(brand => {
      const models = MOTORCYCLE_DATABASE[brand] || [];
      const selected = selectedModels[brand] || [];
      return selected.length === models.length;
    });
    
    if (allSelected) {
      setSelectedModels({});
    } else {
      const allModels = {};
      MOTORCYCLE_BRANDS.forEach(brand => {
        allModels[brand] = [...(MOTORCYCLE_DATABASE[brand] || [])];
      });
      setSelectedModels(allModels);
    }
  };

  const saveWizardSelection = () => {
    setFormData(prev => ({ ...prev, compatible_motorcycles: selectedModels }));
    setWizardOpen(false);
    toast.success('Motormodellen opgeslagen');
  };

  const getSelectedCount = () => {
    return Object.values(selectedModels).reduce((sum, models) => sum + models.length, 0);
  };

  const getBrandSelectedCount = (brand) => {
    return (selectedModels[brand] || []).length;
  };

  const openAddDialog = () => {
    setEditingPart(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: categories[0]?.id || '',
      compatible_motorcycles: {},
      stock: '0',
      sku: '',
      images: []
    });
    setDialogOpen(true);
  };

  const openEditDialog = (part) => {
    setEditingPart(part);
    // Convert old format to new format if needed
    let compatibleMotorcycles = part.compatible_motorcycles || {};
    if (part.compatible_brands && part.compatible_brands.length > 0 && Object.keys(compatibleMotorcycles).length === 0) {
      // Old format: just brands without models - convert
      part.compatible_brands.forEach(brand => {
        compatibleMotorcycles[brand] = MOTORCYCLE_DATABASE[brand] || [];
      });
    }
    
    setFormData({
      name: part.name,
      description: part.description || '',
      price: part.price.toString(),
      category_id: part.category_id,
      compatible_motorcycles: compatibleMotorcycles,
      stock: part.stock.toString(),
      sku: part.sku || '',
      images: part.images || []
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price || !formData.category_id) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    setSubmitting(true);
    try {
      // Convert compatible_motorcycles to compatible_brands for backward compatibility
      const compatibleBrands = Object.keys(formData.compatible_motorcycles);
      
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category_id: formData.category_id,
        compatible_brands: compatibleBrands,
        compatible_motorcycles: formData.compatible_motorcycles,
        stock: parseInt(formData.stock) || 0,
        sku: formData.sku,
        images: formData.images
      };

      if (editingPart) {
        await axios.put(`${API}/parts/${editingPart.id}`, payload);
        toast.success('Onderdeel bijgewerkt');
      } else {
        await axios.post(`${API}/parts`, payload);
        toast.success('Onderdeel aangemaakt');
      }

      setDialogOpen(false);
      fetchParts();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (partId) => {
    if (!window.confirm('Weet u zeker dat u dit onderdeel wilt verwijderen?')) return;

    try {
      await axios.delete(`${API}/parts/${partId}`);
      toast.success('Onderdeel verwijderd');
      fetchParts();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name) {
      toast.error('Vul een categorienaam in');
      return;
    }

    try {
      await axios.post(`${API}/parts/categories`, newCategory);
      toast.success('Categorie aangemaakt');
      setCategoryDialogOpen(false);
      setNewCategory({ name: '', description: '' });
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Weet u zeker dat u deze categorie wilt verwijderen?')) return;

    try {
      await axios.delete(`${API}/parts/categories/${categoryId}`);
      toast.success('Categorie verwijderd');
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const formDataUpload = new FormData();
    files.forEach(file => formDataUpload.append('files', file));

    try {
      const response = await axios.post(`${API}/upload/multiple`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...response.data.urls]
      }));
      toast.success('Afbeeldingen geüpload');
    } catch (error) {
      toast.error('Afbeeldingen uploaden mislukt');
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  };

  const filteredParts = parts.filter(part =>
    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requiredRole="admin">
      <div className="content-header">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
                {t('admin.partsManagement')}
              </h1>
              <p className="text-zinc-500 mt-1">{parts.length} {t('parts.inCatalog')}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setCategoryDialogOpen(true)}
                data-testid="add-category-btn"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                {t('parts.addCategory')}
              </Button>
              <Button 
                onClick={openAddDialog}
                className="bg-red-600 hover:bg-red-700"
                data-testid="add-part-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('parts.addPart')}
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <Input
              type="text"
              placeholder={t('parts.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Categories overview */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <Badge key={cat.id} variant="outline" className="flex items-center gap-1">
                {cat.name}
                <button 
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="ml-1 text-red-500 hover:text-red-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="content-body" data-testid="admin-parts">
        {filteredParts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
              <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                {t('parts.noParts')}
              </h3>
              <p className="text-zinc-500 mb-4">{t('parts.addFirstPart')}</p>
              <Button onClick={openAddDialog} className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                {t('parts.addPart')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredParts.map((part) => (
              <Card key={part.id} data-testid={`part-row-${part.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0">
                      {part.images?.[0] ? (
                        <img src={part.images[0]} alt={part.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-zinc-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-zinc-900">{part.name}</h3>
                          <p className="text-sm text-zinc-500">{part.sku && `Art.nr: ${part.sku} • `}{part.category_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-barlow text-xl font-bold text-red-600">{formatPrice(part.price)}</p>
                          <Badge className={part.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {t('parts.stock')}: {part.stock}
                          </Badge>
                        </div>
                      </div>

                      {/* Brands */}
                      {part.compatible_brands?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {part.compatible_brands.map(brand => (
                            <Badge key={brand} variant="outline" className="text-xs">{brand}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => openEditDialog(part)}
                        data-testid={`edit-part-${part.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(part.id)}
                        data-testid={`delete-part-${part.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Part Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {editingPart ? t('parts.editPart') : t('parts.addPart')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t('parts.partName')} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Bijv. Akrapovic Slip-On"
                  data-testid="part-name-input"
                />
              </div>

              <div>
                <Label>{t('parts.price')} (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  data-testid="part-price-input"
                />
              </div>

              <div>
                <Label>{t('parts.stock')} *</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                  placeholder="0"
                  data-testid="part-stock-input"
                />
              </div>

              <div>
                <Label>{t('parts.category')} *</Label>
                <Select 
                  value={formData.category_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger data-testid="part-category-select">
                    <SelectValue placeholder={t('parts.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('parts.articleNumber')}</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="AKR-001"
                  data-testid="part-sku-input"
                />
              </div>

              <div className="col-span-2">
                <Label>{t('parts.description')}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('parts.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Label>{t('parts.compatibleBrands')}</Label>
                <div className="mt-2 p-4 border-2 border-dashed border-zinc-300 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">
                        {Object.keys(formData.compatible_motorcycles).length > 0 ? (
                          <>
                            {Object.keys(formData.compatible_motorcycles).length} merken, {Object.values(formData.compatible_motorcycles).reduce((sum, m) => sum + m.length, 0)} modellen geselecteerd
                          </>
                        ) : (
                          'Geen motoren geselecteerd'
                        )}
                      </p>
                      {Object.keys(formData.compatible_motorcycles).length > 0 && (
                        <p className="text-sm text-zinc-500 mt-1">
                          {Object.keys(formData.compatible_motorcycles).slice(0, 4).join(', ')}
                          {Object.keys(formData.compatible_motorcycles).length > 4 && ` +${Object.keys(formData.compatible_motorcycles).length - 4} meer`}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={openWizard}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Kies Motoren
                    </Button>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <Label>{t('parts.images')}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="mt-2"
                />
                {formData.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.images.map((url, index) => (
                      <div key={index} className="relative w-20 h-20">
                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={submitting}
              data-testid="save-part-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {submitting ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {t('parts.addCategory')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>{t('parts.categoryName')} *</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Bijv. Banden"
                data-testid="category-name-input"
              />
            </div>
            <div>
              <Label>{t('parts.description')}</Label>
              <Input
                value={newCategory.description}
                onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschrijving (optioneel)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleCreateCategory}
              data-testid="save-category-btn"
            >
              {t('parts.addCategory')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Motorcycle Selection Wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {wizardStep === 1 ? 'Stap 1: Kies een merk' : `Stap 2: Kies modellen (${selectedBrand})`}
            </DialogTitle>
            <DialogDescription>
              {getSelectedCount()} modellen geselecteerd
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {wizardStep === 1 ? (
              /* Step 1: Brand Selection */
              <div className="space-y-2">
                {/* Select All Brands Button */}
                <button
                  onClick={handleSelectAllBrands}
                  className={`w-full p-4 rounded-lg border-2 text-left flex items-center justify-between transition-all ${
                    MOTORCYCLE_BRANDS.every(b => (selectedModels[b] || []).length === (MOTORCYCLE_DATABASE[b] || []).length)
                      ? 'border-red-500 bg-red-50'
                      : 'border-zinc-200 hover:border-red-300 hover:bg-red-50/50'
                  }`}
                >
                  <span className="font-semibold text-red-600">🏍️ Alle Merken & Modellen</span>
                  {MOTORCYCLE_BRANDS.every(b => (selectedModels[b] || []).length === (MOTORCYCLE_DATABASE[b] || []).length) && (
                    <Check className="w-5 h-5 text-red-600" />
                  )}
                </button>

                <div className="border-t border-zinc-200 my-4"></div>

                {/* Brand List */}
                {MOTORCYCLE_BRANDS.map(brand => {
                  const selectedCount = getBrandSelectedCount(brand);
                  const totalCount = (MOTORCYCLE_DATABASE[brand] || []).length;
                  
                  return (
                    <button
                      key={brand}
                      onClick={() => handleBrandSelect(brand)}
                      className={`w-full p-4 rounded-lg border-2 text-left flex items-center justify-between transition-all ${
                        selectedCount > 0
                          ? 'border-red-500 bg-red-50'
                          : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <span className="font-semibold text-zinc-900">{brand}</span>
                        <span className="text-sm text-zinc-500 ml-2">({totalCount} modellen)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedCount > 0 && (
                          <Badge className="bg-red-600">{selectedCount} geselecteerd</Badge>
                        )}
                        <ChevronRight className="w-5 h-5 text-zinc-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Step 2: Model Selection */
              <div className="space-y-2">
                {/* Select All Models Button */}
                <button
                  onClick={handleSelectAllModels}
                  className={`w-full p-4 rounded-lg border-2 text-left flex items-center justify-between transition-all ${
                    (selectedModels[selectedBrand] || []).length === (MOTORCYCLE_DATABASE[selectedBrand] || []).length
                      ? 'border-red-500 bg-red-50'
                      : 'border-zinc-200 hover:border-red-300 hover:bg-red-50/50'
                  }`}
                >
                  <span className="font-semibold text-red-600">✓ Alle types ({selectedBrand})</span>
                  {(selectedModels[selectedBrand] || []).length === (MOTORCYCLE_DATABASE[selectedBrand] || []).length && (
                    <Check className="w-5 h-5 text-red-600" />
                  )}
                </button>

                <div className="border-t border-zinc-200 my-4"></div>

                {/* Model List */}
                <div className="grid grid-cols-2 gap-2">
                  {(MOTORCYCLE_DATABASE[selectedBrand] || []).map(model => {
                    const isSelected = (selectedModels[selectedBrand] || []).includes(model);
                    
                    return (
                      <button
                        key={model}
                        onClick={() => handleModelToggle(model)}
                        className={`p-3 rounded-lg border-2 text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-red-500 bg-red-50'
                            : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        <span className={`text-sm ${isSelected ? 'font-semibold text-red-600' : 'text-zinc-700'}`}>
                          {model}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-red-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            {wizardStep === 2 && (
              <Button variant="outline" onClick={() => setWizardStep(1)}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Vorige
              </Button>
            )}
            <div className="flex-1"></div>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>
              Annuleren
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={saveWizardSelection}
            >
              <Check className="w-4 h-4 mr-2" />
              Opslaan ({getSelectedCount()} modellen)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminParts;
