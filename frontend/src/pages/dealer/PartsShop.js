import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2,
  Package,
  Truck,
  MapPin,
  Filter,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PartsShop = () => {
  const { t } = useTranslation();
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands] = useState(['Yamaha', 'Honda', 'Kawasaki', 'Ducati', 'Triumph', 'KTM', 'Suzuki', 'BMW']);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [needsShipping, setNeedsShipping] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchParts();
  }, []);

  useEffect(() => {
    fetchParts();
  }, [selectedCategory, selectedBrand, searchTerm]);

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
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.append('category_id', selectedCategory);
      if (selectedBrand && selectedBrand !== 'all') params.append('brand', selectedBrand);
      if (searchTerm) params.append('search', searchTerm);
      params.append('in_stock_only', 'true');
      
      const response = await axios.get(`${API}/parts?${params.toString()}`);
      setParts(response.data);
    } catch (error) {
      console.error('Failed to fetch parts:', error);
      toast.error(t('messages.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (part) => {
    setCart(prev => {
      const existing = prev.find(item => item.part_id === part.id);
      if (existing) {
        return prev.map(item => 
          item.part_id === part.id 
            ? { ...item, quantity: Math.min(item.quantity + 1, part.stock) }
            : item
        );
      }
      return [...prev, { 
        part_id: part.id, 
        part_name: part.name, 
        price: part.price, 
        quantity: 1,
        max_stock: part.stock
      }];
    });
    toast.success(`${part.name} ${t('parts.addedToCart')}`);
  };

  const updateCartQuantity = (partId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(partId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.part_id === partId 
        ? { ...item, quantity: Math.min(quantity, item.max_stock) }
        : item
    ));
  };

  const removeFromCart = (partId) => {
    setCart(prev => prev.filter(item => item.part_id !== partId));
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = needsShipping ? 9.95 : 0;
    return { subtotal, shipping, total: subtotal + shipping };
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error(t('parts.cartEmpty'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/parts/order`, {
        items: cart.map(item => ({
          part_id: item.part_id,
          quantity: item.quantity,
          price: item.price
        })),
        needs_shipping: needsShipping,
        notes: ''
      });

      toast.success(t('parts.orderSuccess'));
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="content-header">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
                {t('parts.shopTitle')}
              </h1>
              <p className="text-zinc-500 mt-1">{parts.length} {t('parts.available')}</p>
            </div>
            
            {/* Cart Button */}
            <Button 
              onClick={() => setCartOpen(true)}
              className="bg-red-600 hover:bg-red-700 relative"
              data-testid="cart-btn"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              {t('parts.cart')}
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-zinc-900 text-white">
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                type="text"
                placeholder={t('parts.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="parts-search"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48" data-testid="category-filter">
                <SelectValue placeholder={t('parts.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('parts.allCategories')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Brand Filter */}
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="w-full md:w-48" data-testid="brand-filter">
                <SelectValue placeholder={t('parts.allBrands')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('parts.allBrands')}</SelectItem>
                {brands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="content-body" data-testid="parts-shop">
        {parts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
              <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                {t('parts.noPartsFound')}
              </h3>
              <p className="text-zinc-500">{t('parts.tryDifferentFilter')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {parts.map((part) => (
              <Card key={part.id} className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`part-card-${part.id}`}>
                <div className="aspect-square relative bg-zinc-100">
                  {part.images?.[0] ? (
                    <img 
                      src={part.images[0]} 
                      alt={part.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-zinc-300" />
                    </div>
                  )}
                  {/* Category badge */}
                  <Badge className="absolute top-2 left-2 bg-zinc-900 text-white">
                    {part.category_name}
                  </Badge>
                  {/* Stock indicator */}
                  {part.stock <= 3 && (
                    <Badge className="absolute top-2 right-2 bg-amber-500 text-white">
                      {t('parts.lowStock')}: {part.stock}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-zinc-900 mb-1 line-clamp-2">{part.name}</h3>
                  {part.sku && (
                    <p className="text-xs text-zinc-400 mb-2">Art.nr: {part.sku}</p>
                  )}
                  <p className="text-sm text-zinc-500 mb-3 line-clamp-2">{part.description}</p>
                  
                  {/* Compatible brands */}
                  {part.compatible_brands?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {part.compatible_brands.map(brand => (
                        <Badge key={brand} variant="outline" className="text-xs">
                          {brand}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-barlow text-2xl font-bold text-red-600">
                      {formatPrice(part.price)}
                    </span>
                    <Button 
                      onClick={() => addToCart(part)}
                      disabled={part.stock === 0}
                      className="bg-red-600 hover:bg-red-700"
                      data-testid={`add-to-cart-${part.id}`}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t('parts.addToCart')}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">
                    {part.stock} {t('parts.inStock')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" />
              {t('parts.cart')} ({cartItemCount})
            </DialogTitle>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
              <p>{t('parts.cartEmpty')}</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {cart.map((item) => (
                  <div key={item.part_id} className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-900">{item.part_name}</p>
                      <p className="text-sm text-zinc-500">{formatPrice(item.price)} {t('parts.perPiece')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => updateCartQuantity(item.part_id, item.quantity - 1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => updateCartQuantity(item.part_id, item.quantity + 1)}
                        disabled={item.quantity >= item.max_stock}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeFromCart(item.part_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-zinc-600">
                  <span>{t('parts.subtotal')}</span>
                  <span>{formatPrice(getCartTotal().subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>{t('parts.shipping')}</span>
                  <span>{needsShipping ? formatPrice(9.95) : t('parts.freePickup')}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>{t('parts.total')}</span>
                  <span className="text-red-600">{formatPrice(getCartTotal().total)}</span>
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button 
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                  data-testid="checkout-btn"
                >
                  {t('parts.checkout')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {t('parts.completeOrder')}
            </DialogTitle>
            <DialogDescription>
              {t('parts.invoiceWillBeSent')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Shipping option */}
            <div className="space-y-3">
              <div 
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${needsShipping ? 'border-red-500 bg-red-50' : 'border-zinc-200'}`}
                onClick={() => setNeedsShipping(true)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${needsShipping ? 'border-red-600' : 'border-zinc-300'}`}>
                    {needsShipping && <div className="w-3 h-3 rounded-full bg-red-600"></div>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-zinc-600" />
                      <span className="font-semibold">{t('parts.shipToMe')}</span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">{t('parts.shippingCost')}: €9,95</p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${!needsShipping ? 'border-red-500 bg-red-50' : 'border-zinc-200'}`}
                onClick={() => setNeedsShipping(false)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!needsShipping ? 'border-red-600' : 'border-zinc-300'}`}>
                    {!needsShipping && <div className="w-3 h-3 rounded-full bg-red-600"></div>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-zinc-600" />
                      <span className="font-semibold">{t('parts.pickup')}</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1 font-medium">{t('parts.free')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div className="p-4 bg-zinc-900 rounded-lg text-white">
              <h4 className="font-semibold mb-3">{t('parts.orderSummary')}</h4>
              <div className="space-y-2 text-sm">
                {cart.map(item => (
                  <div key={item.part_id} className="flex justify-between">
                    <span className="text-zinc-300">{item.part_name} x{item.quantity}</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-zinc-700 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-300">{t('parts.subtotal')}</span>
                    <span>{formatPrice(getCartTotal().subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-300">{t('parts.shipping')}</span>
                    <span>{needsShipping ? '€9,95' : t('parts.free')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg mt-2">
                    <span>{t('parts.total')}</span>
                    <span className="text-red-500">{formatPrice(getCartTotal().total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment info */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                {t('parts.paymentInfo')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleCheckout}
              disabled={submitting}
              data-testid="confirm-order-btn"
            >
              {submitting ? t('common.loading') : t('parts.placeOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default PartsShop;
