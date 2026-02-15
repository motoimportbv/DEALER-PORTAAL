import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

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

  const handlePrint = () => {
    window.print();
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
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          <Button onClick={handlePrint} className="bg-red-600 hover:bg-red-700">
            <Printer className="w-4 h-4 mr-2" />
            {t('pakbon.print')}
          </Button>
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
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* From */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">{t('pakbon.sender')}</h3>
                <div className="text-sm">
                  <p className="font-bold text-lg">Moto Import B.V.</p>
                  <p className="text-zinc-600">Horsterhoekweg 11</p>
                  <p className="text-zinc-600">7433 SV Schalkhaar</p>
                  <p className="text-zinc-600 mt-2">Tel: +31 6 81792660</p>
                  <p className="text-zinc-600">Email: Motoimportbv@gmail.com</p>
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

            {/* Motorcycle Details */}
            <div className="border-t border-b border-zinc-200 py-6 my-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">{t('motorcycle.singular')}</h3>
              
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
                    </td>
                    <td className="py-4 text-right align-top">1</td>
                    <td className="py-4 text-right align-top font-medium">
                      € {(order.total_price - order.delivery_cost).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
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
              <p>Horsterhoekweg 11, 7433 SV Schalkhaar | +31 6 81792660 | Motoimportbv@gmail.com</p>
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
    </div>
  );
};

export default Pakbon;
