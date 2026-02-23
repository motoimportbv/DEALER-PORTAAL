import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Bike, ArrowRight, X, Sparkles } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const WelcomePopup = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWelcomeMessage = async () => {
      // Only fetch for dealers
      if (!token || !user || user.role === 'admin' || user.role === 'foreign_dealer') {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API}/api/dealer/welcome-message`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.show_message) {
          setWelcomeData(response.data);
          setShowPopup(true);
        }
      } catch (error) {
        console.error('Error fetching welcome message:', error);
      } finally {
        setLoading(false);
      }
    };

    // Small delay to let the page load first
    const timer = setTimeout(fetchWelcomeMessage, 1000);
    return () => clearTimeout(timer);
  }, [token, user]);

  const handleViewMotorcycles = () => {
    setShowPopup(false);
    navigate('/dealer');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(price);
  };

  if (loading || !welcomeData) {
    return null;
  }

  return (
    <Dialog open={showPopup} onOpenChange={setShowPopup}>
      <DialogContent className="sm:max-w-md" data-testid="welcome-popup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            Welkom terug!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* AI Generated Message */}
          <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 rounded-lg p-4 border border-zinc-200">
            <p className="text-zinc-700 leading-relaxed">
              {welcomeData.message}
            </p>
          </div>

          {/* New Motorcycles Preview */}
          {welcomeData.new_motorcycles && welcomeData.new_motorcycles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                <Bike className="w-4 h-4" />
                {welcomeData.new_motorcycles_count} nieuwe motor{welcomeData.new_motorcycles_count !== 1 ? 'en' : ''}
              </p>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {welcomeData.new_motorcycles.map((moto, index) => (
                  <div 
                    key={moto.id || index}
                    className="flex items-center gap-3 p-2 bg-white rounded-lg border border-zinc-100 hover:border-red-200 transition-colors cursor-pointer"
                    onClick={() => {
                      setShowPopup(false);
                      navigate(`/motorcycle/${moto.id}`);
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-12 bg-zinc-100 rounded overflow-hidden flex-shrink-0">
                      {moto.images && moto.images[0] ? (
                        <img 
                          src={moto.images[0]} 
                          alt={`${moto.brand} ${moto.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Bike className="w-6 h-6 text-zinc-300" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 truncate">
                        {moto.brand} {moto.model}
                      </p>
                      <p className="text-sm text-zinc-500">{moto.year}</p>
                    </div>
                    
                    {/* Price */}
                    <p className="font-bold text-red-600 flex-shrink-0">
                      {formatPrice(moto.price)}
                    </p>
                  </div>
                ))}
              </div>

              {welcomeData.new_motorcycles_count > 5 && (
                <p className="text-xs text-zinc-400 text-center">
                  +{welcomeData.new_motorcycles_count - 5} meer...
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowPopup(false)}
            >
              Later
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleViewMotorcycles}
              data-testid="view-motorcycles-btn"
            >
              Bekijk aanbod
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomePopup;
