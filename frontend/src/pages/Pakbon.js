import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { ArrowLeft, Printer, CheckCircle, FileText } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const Pakbon = () => {
  const { t } = useTranslation();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasPrinted, setHasPrinted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [showKentekenFull, setShowKentekenFull] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const printRef = useRef();

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await axios.get(`${API}/api/orders`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const foundOrder = response.data.find(o => o.id === orderId);
        if (foundOrder) {
          setOrder(foundOrder);
          setCompleted(!!foundOrder.pakbon_completed);
        }
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token && orderId) {
      fetchOrder();
    }
  }, [token, orderId]);

  // Auto-print when order is loaded and print=true parameter is present
  useEffect(() => {
    if (order && searchParams.get('print') === 'true' && !hasPrinted) {
      setHasPrinted(true);
      // Small delay to ensure the page is fully rendered
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [order, searchParams, hasPrinted]);

  // Fetch suppliers for dropdown (admin only)
  useEffect(() => {
    if (user?.role === 'admin' && token) {
      axios.get(`${API}/api/dealers`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const foreign = res.data.filter(d => d.is_foreign_dealer || d.role === 'foreign_dealer');
          setSuppliers(foreign);
        }).catch(() => {});
    }
  }, [user, token]);


  const handlePrint = () => {
    window.print();
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await axios.put(`${API}/api/orders/${orderId}/pakbon-complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompleted(true);
    } catch (error) {
      console.error('Error completing pakbon:', error);
    } finally {
      setCompleting(false);
    }
  };

  const openMoneyMonk = () => {
    window.open('https://app.moneymonk.nl/invoices/new', '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-600 mb-4">{t('pakbon.notFound')}</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const motorcycle = order.motorcycle || {};
  const orderDate = new Date(order.created_at).toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(user?.role === 'pakbon' ? '/pakbonnen' : -1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={openMoneyMonk} variant="outline" className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="moneymonk-btn">
              <FileText className="w-4 h-4" />
              Factuur in MoneyMonk
            </Button>
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="w-4 h-4" />
              {t('pakbon.print')}
            </Button>
            {completed ? (
              <Button disabled className="gap-2 bg-green-600 hover:bg-green-600 text-white cursor-default" data-testid="pakbon-completed">
                <CheckCircle className="w-4 h-4" />
                Voltooid
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={completing} className="gap-2 bg-red-600 hover:bg-red-700" data-testid="pakbon-complete-btn">
                <CheckCircle className="w-4 h-4" />
                {completing ? 'Bezig...' : 'Voltooien'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pakbon Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-none" ref={printRef}>
        <div className="bg-white shadow-lg print:shadow-none">
          {/* Header */}
          <div className="bg-zinc-900 text-white p-8 print:bg-zinc-900 print:text-white">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('pakbon.title')}</h1>
                <p className="text-zinc-400 mt-1">Moto Import B.V.</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-400">{t('order.orderNumber')}</p>
                <p className="font-mono text-lg">{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-zinc-400 mt-2">{t('order.date')}</p>
                <p>{orderDate}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-8 mb-4">
              {/* From */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">{t('pakbon.sender')}</h3>
                <div className="text-sm">
                  <p className="font-bold text-lg">Moto Import B.V.</p>
                  <p className="text-zinc-600">Tel: +31 6 24264861</p>
                  <p className="text-zinc-600">Email: Motoimportbv@gmail.com</p>
                  <p className="text-zinc-600">www.motoimportbv.nl</p>
                </div>
              </div>

              {/* To */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">{t('pakbon.recipient')}</h3>
                <div className="text-sm">
                  <p className="font-bold text-lg">{order.dealer_company || 'Dealer'}</p>
                  <p className="text-zinc-600">{order.dealer_email}</p>
                  {order.needs_delivery && (
                    <p className="mt-2 inline-block bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                      {t('order.delivery').toUpperCase()}
                    </p>
                  )}
                  {!order.needs_delivery && (
                    <p className="mt-2 inline-block bg-zinc-100 text-zinc-700 px-2 py-1 rounded text-xs font-medium">
                      {t('order.pickup').toUpperCase()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Leverancier Info - Editable */}
            <div className="mb-8 border border-zinc-200 rounded-lg p-4 bg-zinc-50 print:bg-white print:border-zinc-300">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Leverancier</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Telefoonnummer</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="Telefoonnummer leverancier"
                    className="w-full border border-zinc-300 rounded px-3 py-2 text-sm focus:border-red-500 focus:outline-none print:border-none print:px-0 print:bg-transparent"
                    data-testid="supplier-phone-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Adres</label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    placeholder="Adres leverancier"
                    className="w-full border border-zinc-300 rounded px-3 py-2 text-sm focus:border-red-500 focus:outline-none print:border-none print:px-0 print:bg-transparent"
                    data-testid="supplier-address-input"
                  />
                </div>
              </div>
            </div>

            {/* Motorcycle Details */}
            <div className="border-t border-b border-zinc-200 py-6 my-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">{t('motorcycle.singular')}</h3>
              
              {/* Kenteken & Documenten */}
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 print:bg-white print:border-zinc-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-amber-700 block mb-1">Kenteken</label>
                  <input
                    type="text"
                    value={order.motorcycle_license_plate || motorcycle.license_plate || ''}
                    onChange={async (e) => {
                      const val = e.target.value.toUpperCase();
                      setOrder(prev => ({ ...prev, motorcycle_license_plate: val }));
                      try {
                        await axios.put(`${API}/api/orders/${order.id}/license-plate`, { license_plate: val }, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                      } catch (err) { console.error('Failed to save license plate:', err); }
                    }}
                    placeholder="XX-123-YY"
                    className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-lg font-bold uppercase tracking-wider focus:border-amber-500 focus:outline-none print:border-none print:px-0 print:bg-transparent"
                    data-testid="pakbon-license-plate"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-amber-700 block mb-1">Chassisnummer (VIN)</label>
                  <p className="text-lg font-mono font-bold text-zinc-800 py-2">{motorcycle.chassis_number || '-'}</p>
                </div>
              </div>
              
              {/* Kentekenbewijs foto */}
              <div className="mt-4 border-t border-amber-200 pt-4">
                <label className="text-xs font-bold text-amber-700 block mb-2">Kentekenbewijs (foto)</label>
                {order.kentekenbewijs_url ? (
                  <div className="space-y-2">
                    <img src={order.kentekenbewijs_url} alt="Kentekenbewijs" 
                      className="max-w-full max-h-64 rounded-lg border border-zinc-200 cursor-pointer hover:opacity-90"
                      onClick={() => setShowKentekenFull(true)}
                      data-testid="kentekenbewijs-image" />
                    <div className="flex gap-2 print:hidden">
                      <Button type="button" size="sm" variant="outline" className="text-xs"
                        onClick={() => setShowKentekenFull(true)}>
                        Vergroten
                      </Button>
                      {user?.role === 'admin' && (
                        <Button type="button" size="sm" variant="outline" className="text-xs text-red-600 border-red-200"
                          onClick={async () => {
                            if (!window.confirm('Kentekenbewijs verwijderen?')) return;
                            try {
                              await axios.put(`${API}/api/orders/${order.id}/kentekenbewijs`, { url: '' }, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              setOrder(prev => ({ ...prev, kentekenbewijs_url: '' }));
                            } catch (err) { console.error(err); }
                          }}>
                          Verwijderen
                        </Button>
                      )}
                    </div>
                  </div>
                ) : user?.role === 'admin' ? (
                  <div className="print:hidden">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          const uploadRes = await axios.post(`${API}/api/upload`, formData, {
                            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                          });
                          const imageUrl = uploadRes.data.url || uploadRes.data.image_url;
                          await axios.put(`${API}/api/orders/${order.id}/kentekenbewijs`, { url: imageUrl }, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          setOrder(prev => ({ ...prev, kentekenbewijs_url: imageUrl }));
                          alert('Kentekenbewijs opgeslagen!');
                        } catch (err) { 
                          console.error('Upload failed:', err);
                          alert('Upload mislukt: ' + (err.response?.data?.detail || err.message));
                        }
                      }}
                      className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 cursor-pointer"
                      data-testid="kentekenbewijs-upload"
                    />
                    <p className="text-xs text-zinc-400 mt-1">Upload een foto van het kentekenbewijs</p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 italic">Nog geen kentekenbewijs geüpload</p>
                )}
              </div>
            </div>

            {/* Leverancier gegevens (alleen zichtbaar voor admin & pakbon-rol — dealers mogen
                NIET de inkoopprijs en leverancier-contactgegevens zien op hun eigen pakbon) */}
            {(user?.role === 'admin' || user?.role === 'pakbon') && (order.supplier_info || motorcycle.foreign_dealer_company) && (
              <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-3">Leverancier</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-purple-500 block">Bedrijf</span>
                    <span className="font-bold text-zinc-900">{order.supplier_info?.company || motorcycle.foreign_dealer_company || '-'}</span>
                  </div>
                  {order.supplier_info?.country && (
                    <div>
                      <span className="text-xs text-purple-500 block">Land</span>
                      <span className="text-zinc-900">{order.supplier_info.country}</span>
                    </div>
                  )}
                  {order.supplier_info?.address && (
                    <div>
                      <span className="text-xs text-purple-500 block">Adres</span>
                      <span className="text-zinc-900">{order.supplier_info.address}</span>
                    </div>
                  )}
                  {order.supplier_info?.phone && (
                    <div>
                      <span className="text-xs text-purple-500 block">Telefoon</span>
                      <span className="text-zinc-900">{order.supplier_info.phone}</span>
                    </div>
                  )}
                  {order.supplier_info?.email && (
                    <div>
                      <span className="text-xs text-purple-500 block">Email</span>
                      <span className="text-zinc-900">{order.supplier_info.email}</span>
                    </div>
                  )}
                  {motorcycle.original_price && (
                    <div>
                      <span className="text-xs text-purple-500 block">Inkoopprijs</span>
                      <span className="font-bold text-zinc-900">{motorcycle.original_currency || 'CHF'} {motorcycle.original_price?.toLocaleString('nl-NL')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">{t('pakbon.description')}</th>
                    <th className="text-right py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">{t('pakbon.quantity')}</th>
                    <th className="text-right py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">{t('motorcycle.price')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-100">
                    <td className="py-4">
                      <p className="font-bold text-lg">{motorcycle.brand} {motorcycle.model}</p>
                      <p className="text-sm text-zinc-500">
                        {t('motorcycle.year')}: {motorcycle.year} | {t('motorcycle.color')}: {motorcycle.color} | KM: {motorcycle.mileage?.toLocaleString('nl-NL')}
                      </p>
                      <p className="text-sm text-zinc-500">{t('motorcycle.condition')}: {motorcycle.condition}</p>
                      {/* Show supplier price for admin */}
                      {user?.role === 'admin' && motorcycle.original_price && (
                        <p className="text-xs text-amber-600 mt-1">
                          💰 Lev: {motorcycle.original_currency === 'CHF' 
                            ? `CHF ${motorcycle.original_price.toLocaleString('nl-NL')}` 
                            : `€ ${motorcycle.original_price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`}
                        </p>
                      )}
                    </td>
                    <td className="py-4 text-right align-top">1</td>
                    <td className="py-4 text-right align-top font-medium">
                      € {(order.total_price - (order.delivery_cost || 0) - (order.inspection_cost || 0) - (order.valuation_cost || 0)).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {order.needs_inspection && order.inspection_cost > 0 && (
                    <tr className="border-b border-zinc-100">
                      <td className="py-4">
                        <p className="font-medium">{t('order.inspection')}</p>
                        <p className="text-sm text-zinc-500">{t('order.inspectionDescription')}</p>
                      </td>
                      <td className="py-4 text-right align-top">1</td>
                      <td className="py-4 text-right align-top font-medium">
                        € {order.inspection_cost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  {order.needs_valuation && order.valuation_cost > 0 && (
                    <tr className="border-b border-zinc-100">
                      <td className="py-4">
                        <p className="font-medium">{t('order.valuation')}</p>
                        <p className="text-sm text-zinc-500">{t('order.valuationDescription')}</p>
                      </td>
                      <td className="py-4 text-right align-top">1</td>
                      <td className="py-4 text-right align-top font-medium">
                        € {order.valuation_cost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  {order.needs_delivery && order.delivery_cost > 0 && (
                    <tr className="border-b border-zinc-100">
                      <td className="py-4">
                        <p className="font-medium">{t('order.deliveryCost')}</p>
                        <p className="text-sm text-zinc-500">{t('pakbon.deliveryToAddress')}</p>
                      </td>
                      <td className="py-4 text-right align-top">1</td>
                      <td className="py-4 text-right align-top font-medium">
                        € {order.delivery_cost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  {/* Voucher Discount */}
                  {order.voucher_code && order.voucher_discount > 0 && (
                    <tr className="border-b border-zinc-100 bg-green-50">
                      <td className="py-4">
                        <p className="font-medium text-green-700">{t('order.voucherDiscount')}</p>
                        <p className="text-sm text-green-600">{t('order.voucherCode')}: {order.voucher_code}</p>
                      </td>
                      <td className="py-4 text-right align-top">1</td>
                      <td className="py-4 text-right align-top font-medium text-green-700">
                        - € {order.voucher_discount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2" className="py-4 text-right font-bold text-lg">{t('order.total')}</td>
                    <td className="py-4 text-right font-bold text-xl text-red-600">
                      € {order.total_price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">{t('pakbon.notes')}</h3>
                <p className="text-sm text-zinc-600 bg-zinc-50 p-4 rounded">{order.notes}</p>
              </div>
            )}

            {/* Betalingsinstructies voor Ellen (CHF overmaken) */}
            {(order.payment_instructions || user?.role === 'admin') && (
              <div className="mb-6 bg-blue-50 border-2 border-blue-300 rounded-xl p-5" data-testid="payment-instructions">
                <h3 className="text-sm font-bold uppercase tracking-wider text-blue-800 mb-3 flex items-center gap-2">
                  💳 Betalingsinstructie
                </h3>
                {user?.role === 'admin' ? (
                  <div className="space-y-3 print:hidden">
                    {/* Leverancier dropdown */}
                    {suppliers.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-blue-700 block mb-1">Leverancier selecteren</label>
                        <select
                          onChange={(e) => {
                            const supplier = suppliers.find(s => s.id === e.target.value);
                            if (!supplier) return;
                            const updated = {
                              ...(order.payment_instructions || {}),
                              amount: order.payment_instructions?.amount || '',
                              currency: order.payment_instructions?.currency || 'CHF',
                              recipient_name: supplier.company_name || '',
                              iban: supplier.iban || '',
                              reference: order.payment_instructions?.reference || '',
                            };
                            setOrder(prev => ({ 
                              ...prev, 
                              payment_instructions: updated,
                              supplier_info: {
                                company: supplier.company_name,
                                email: supplier.email,
                                phone: supplier.phone,
                                country: supplier.country,
                                address: supplier.address ? `${supplier.address}, ${supplier.postal_code || ''} ${supplier.city || ''}`.trim() : '',
                              }
                            }));
                            // Save immediately
                            axios.put(`${API}/api/orders/${order.id}/payment-instructions`, { 
                              instructions: updated,
                              supplier_info: {
                                company: supplier.company_name,
                                email: supplier.email,
                                phone: supplier.phone,
                                country: supplier.country,
                                address: supplier.address ? `${supplier.address}, ${supplier.postal_code || ''} ${supplier.city || ''}`.trim() : '',
                              }
                            }, { headers: { Authorization: `Bearer ${token}` } }).catch(console.error);
                          }}
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                          data-testid="supplier-select"
                          defaultValue=""
                        >
                          <option value="" disabled>-- Kies leverancier --</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.company_name} ({s.country}){s.iban ? ' ✓' : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-blue-700 block mb-1">Bedrag (CHF)</label>
                        <input type="text" 
                          value={order.payment_instructions?.amount || ''}
                          onChange={async (e) => {
                            const val = e.target.value;
                            const updated = { ...(order.payment_instructions || {}), amount: val };
                            setOrder(prev => ({ ...prev, payment_instructions: updated }));
                            try {
                              await axios.put(`${API}/api/orders/${order.id}/payment-instructions`, { instructions: updated }, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                            } catch (err) { console.error(err); }
                          }}
                          placeholder="bijv. 7.500"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none"
                          data-testid="payment-amount" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-blue-700 block mb-1">Valuta</label>
                        <select 
                          value={order.payment_instructions?.currency || 'CHF'}
                          onChange={async (e) => {
                            const updated = { ...(order.payment_instructions || {}), currency: e.target.value };
                            setOrder(prev => ({ ...prev, payment_instructions: updated }));
                            try {
                              await axios.put(`${API}/api/orders/${order.id}/payment-instructions`, { instructions: updated }, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                            } catch (err) { console.error(err); }
                          }}
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                          <option value="CHF">CHF</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-blue-700 block mb-1">Naar (naam begunstigde)</label>
                      <input type="text"
                        value={order.payment_instructions?.recipient_name || ''}
                        onChange={async (e) => {
                          const updated = { ...(order.payment_instructions || {}), recipient_name: e.target.value };
                          setOrder(prev => ({ ...prev, payment_instructions: updated }));
                          try {
                            await axios.put(`${API}/api/orders/${order.id}/payment-instructions`, { instructions: updated }, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                          } catch (err) { console.error(err); }
                        }}
                        placeholder="Naam leverancier"
                        className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        data-testid="payment-recipient" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-blue-700 block mb-1">IBAN / Bankrekeningnummer</label>
                      <input type="text"
                        value={order.payment_instructions?.iban || ''}
                        onChange={async (e) => {
                          const updated = { ...(order.payment_instructions || {}), iban: e.target.value };
                          setOrder(prev => ({ ...prev, payment_instructions: updated }));
                          try {
                            await axios.put(`${API}/api/orders/${order.id}/payment-instructions`, { instructions: updated }, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                          } catch (err) { console.error(err); }
                        }}
                        placeholder="IBAN of rekeningnummer"
                        className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
                        data-testid="payment-iban" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-blue-700 block mb-1">Referentie / Omschrijving</label>
                      <input type="text"
                        value={order.payment_instructions?.reference || ''}
                        onChange={async (e) => {
                          const updated = { ...(order.payment_instructions || {}), reference: e.target.value };
                          setOrder(prev => ({ ...prev, payment_instructions: updated }));
                          try {
                            await axios.put(`${API}/api/orders/${order.id}/payment-instructions`, { instructions: updated }, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                          } catch (err) { console.error(err); }
                        }}
                        placeholder="bijv. Yamaha MT-10"
                        className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        data-testid="payment-reference" />
                    </div>
                  </div>
                ) : null}
                {/* Read-only view for pakbon/Ellen (always shown on print) */}
                {(user?.role !== 'admin' || true) && order.payment_instructions?.amount && (
                  <div className={`${user?.role === 'admin' ? 'mt-4 pt-4 border-t border-blue-200' : ''} space-y-2`}>
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-blue-600 block">Bedrag</span>
                          <span className="text-xl font-black text-blue-900">{order.payment_instructions.currency || 'CHF'} {order.payment_instructions.amount}</span>
                        </div>
                        <div>
                          <span className="text-xs text-blue-600 block">Naar</span>
                          <span className="text-sm font-bold text-zinc-900">{order.payment_instructions.recipient_name || '-'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-blue-600 block">IBAN / Rekening</span>
                          <span className="text-sm font-mono font-bold text-zinc-900">{order.payment_instructions.iban || '-'}</span>
                        </div>
                        {order.payment_instructions.reference && (
                          <div>
                            <span className="text-xs text-blue-600 block">Referentie</span>
                            <span className="text-sm text-zinc-900">{order.payment_instructions.reference}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-zinc-200">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-12">{t('pakbon.senderSignature')}</p>
                <div className="border-b border-zinc-300 mb-2"></div>
                <p className="text-xs text-zinc-400">{t('order.date')}: _______________</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-12">{t('pakbon.recipientSignature')}</p>
                <div className="border-b border-zinc-300 mb-2"></div>
                <p className="text-xs text-zinc-400">{t('order.date')}: _______________</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-zinc-200 text-center text-xs text-zinc-400">
              <p>Moto Import B.V. | KVK: 94622086 | BTW: NL123456789B01</p>
              <p>+31 6 24264861 | Motoimportbv@gmail.com | www.motoimportbv.nl</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:bg-zinc-900 {
            background-color: #18181b !important;
          }
          .print\\:text-white {
            color: white !important;
          }
        }
      `}</style>

      {/* Fullscreen kentekenbewijs overlay */}
      {showKentekenFull && order.kentekenbewijs_url && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 print:hidden"
          onClick={() => setShowKentekenFull(false)}
          data-testid="kentekenbewijs-fullscreen"
        >
          <button 
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-2xl hover:bg-black/80 z-50"
            onClick={() => setShowKentekenFull(false)}
          >
            &times;
          </button>
          <img 
            src={order.kentekenbewijs_url} 
            alt="Kentekenbewijs" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default Pakbon;
