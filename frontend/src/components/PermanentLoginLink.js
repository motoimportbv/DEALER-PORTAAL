import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Link2, Copy, Check, RefreshCw, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PermanentLoginLink = () => {
  const [permanentLink, setPermanentLink] = useState(null);
  const [hasLink, setHasLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPermanentLink();
  }, []);

  const fetchPermanentLink = async () => {
    try {
      const response = await axios.get(`${API}/auth/my-permanent-link`);
      setHasLink(response.data.has_permanent_link);
      setPermanentLink(response.data.permanent_url);
    } catch (error) {
      console.error('Failed to fetch permanent link:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLink = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(`${API}/auth/generate-permanent-link`);
      setPermanentLink(response.data.permanent_url);
      setHasLink(true);
      toast.success('Uw persoonlijke login link is aangemaakt!');
    } catch (error) {
      toast.error('Kon link niet aanmaken');
    } finally {
      setGenerating(false);
    }
  };

  const revokeLink = async () => {
    try {
      await axios.post(`${API}/auth/revoke-permanent-link`);
      setPermanentLink(null);
      setHasLink(false);
      toast.success('Link ingetrokken');
    } catch (error) {
      toast.error('Kon link niet intrekken');
    }
  };

  const copyToClipboard = async () => {
    if (permanentLink) {
      await navigator.clipboard.writeText(permanentLink);
      setCopied(true);
      toast.success('Link gekopieerd!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-red-600" />
          Persoonlijke Login Link
        </CardTitle>
        <CardDescription>
          Met uw persoonlijke link kunt u direct inloggen zonder wachtwoord. 
          Bewaar deze link op uw telefoon voor snelle toegang.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasLink && permanentLink ? (
          <>
            <div className="flex gap-2">
              <Input 
                value={permanentLink} 
                readOnly 
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                title="Kopieer link"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700 flex items-start gap-2">
                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Belangrijk:</strong> Deel deze link met niemand! 
                  Iedereen met deze link kan inloggen als u.
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={generateLink}
                disabled={generating}
                className="flex-1"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                Nieuwe link genereren
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Link intrekken?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Uw huidige link werkt dan niet meer. U kunt altijd een nieuwe aanmaken.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={revokeLink} className="bg-red-600 hover:bg-red-700">
                      Intrekken
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-zinc-500 mb-4">
              U heeft nog geen persoonlijke login link. 
              Maak er een aan om snel in te loggen zonder wachtwoord.
            </p>
            <Button onClick={generateLink} disabled={generating} className="bg-red-600 hover:bg-red-700">
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Aanmaken...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Link Aanmaken
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PermanentLoginLink;
