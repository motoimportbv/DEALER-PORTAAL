import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { toast } from 'sonner';
import { Upload, Bike, ArrowLeft, Globe } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Alle motormerken en modellen van motoroccasion.nl
const MOTORCYCLE_DATABASE = {
  'Acces': ['ATV'],
  'Aprilia': ['Atlantic 500', 'Caponord 1200', 'Dorsoduro 750', 'Dorsoduro 900', 'Dorsoduro 1200', 'ETV 1000 Caponord', 'Mana 850', 'Pegaso 650', 'RS 125', 'RS 250', 'RS 457', 'RS 660', 'RS4', 'RST Mille Futura', 'RSV 1000 R', 'RSV4', 'RSV4 Factory', 'Scarabeo 500', 'Shiver 750', 'Shiver 900', 'SR Max 300', 'SX 125', 'Tuareg 660', 'Tuono 660', 'Tuono V4'],
  'Arctic Leopard': ['ATV'],
  'Benelli': ['302 S', '502 C', '752 S', 'BN 125', 'BN 251', 'BN 302', 'BN 600', 'Imperiale 400', 'Leoncino 250', 'Leoncino 500', 'Leoncino 800', 'TNT 125', 'TNT 300', 'TNT 600', 'TNT 899', 'TNT 1130', 'TRK 251', 'TRK 502', 'TRK 702'],
  'Beta': ['RR 125', 'RR 250', 'RR 300', 'RR 350', 'RR 390', 'RR 430', 'RR 480', 'Xtrainer 250', 'Xtrainer 300'],
  'Bimota': ['DB5', 'DB6', 'DB7', 'DB8', 'DB9', 'KB4', 'Tesi H2'],
  'BMW': ['C 400 GT', 'C 400 X', 'C 650 GT', 'C 650 Sport', 'CE 04', 'F 650 GS', 'F 700 GS', 'F 750 GS', 'F 800 GS', 'F 800 GT', 'F 800 R', 'F 800 S', 'F 850 GS', 'F 900 R', 'F 900 XR', 'G 310 GS', 'G 310 R', 'G 650 GS', 'K 1200 GT', 'K 1200 R', 'K 1200 S', 'K 1300 GT', 'K 1300 R', 'K 1300 S', 'K 1600 B', 'K 1600 GT', 'K 1600 GTL', 'M 1000 R', 'M 1000 RR', 'M 1000 XR', 'R 1200 GS', 'R 1200 R', 'R 1200 RS', 'R 1200 RT', 'R 1250 GS', 'R 1250 R', 'R 1250 RS', 'R 1250 RT', 'R 18', 'R NineT', 'S 1000 R', 'S 1000 RR', 'S 1000 XR'],
  'Boom': ['Trike'],
  "Bos's Trikes": ['Trike'],
  'Boss Hoss': ['BHC-3', 'BHC-9'],
  'BSA': ['Gold Star'],
  'Buell': ['1125R', 'Firebolt XB12R', 'Lightning XB12S', 'Ulysses XB12X'],
  'Bultaco': ['Brinco', 'Sherpa'],
  'Cagiva': ['Navigator', 'Raptor 650', 'Raptor 1000', 'V-Raptor'],
  'Can-Am': ['Ryker', 'Spyder F3', 'Spyder RT'],
  'CCM': ['GP 450', 'Spitfire'],
  'CF Moto': ['150 NK', '250 NK', '300 NK', '400 NK', '450 SR', '650 GT', '650 MT', '650 NK', '700 CL-X', '800 MT', '800 NK'],
  'Condor': ['A580'],
  'Ducati': ['1098', '1198', '1199 Panigale', '1299 Panigale', '748', '749', '848', '851', '888', '899 Panigale', '916', '959 Panigale', '996', '998', '999', 'Desert X', 'Diavel', 'Diavel V4', 'GT 1000', 'Hypermotard 698', 'Hypermotard 821', 'Hypermotard 939', 'Hypermotard 950', 'Hyperstrada', 'Monster 600', 'Monster 620', 'Monster 695', 'Monster 696', 'Monster 750', 'Monster 796', 'Monster 797', 'Monster 821', 'Monster 900', 'Monster 937', 'Monster 1100', 'Monster 1200', 'Monster S4', 'Multistrada 620', 'Multistrada 950', 'Multistrada 1000', 'Multistrada 1100', 'Multistrada 1200', 'Multistrada 1260', 'Multistrada V2', 'Multistrada V4', 'Panigale V2', 'Panigale V4', 'Paul Smart 1000', 'Scrambler', 'Sport 1000', 'Streetfighter', 'Streetfighter V2', 'Streetfighter V4', 'SuperSport', 'SuperSport 950'],
  'Energica': ['Ego', 'Eva', 'Experia'],
  'Fantic': ['Caballero 125', 'Caballero 250', 'Caballero 500', 'XEF 125', 'XEF 250', 'XMF 125'],
  'Gas Gas': ['EC 250', 'EC 300', 'EC 350', 'ES 700', 'EX 250', 'EX 300', 'EX 350', 'MC 125', 'MC 250', 'MC 350', 'MC 450', 'SM 700', 'TXT 250', 'TXT 280', 'TXT 300'],
  'Gilera': ['Fuoco 500', 'GP 800', 'Nexus 500', 'Runner 125', 'Runner 200'],
  'Gowow': ['Ori'],
  'Harley-Davidson': ['Breakout', 'CVO', 'Dyna', 'Electra Glide', 'Fat Bob', 'Fat Boy', 'Forty-Eight', 'Heritage Classic', 'Iron 883', 'Low Rider', 'Nightster', 'Night Rod', 'Pan America', 'Road Glide', 'Road King', 'Softail', 'Sportster', 'Sportster S', 'Street 750', 'Street Bob', 'Street Glide', 'Street Rod', 'Tri Glide', 'Ultra Limited', 'V-Rod', 'Wide Glide'],
  'Hercules': ['K 125'],
  'Honda': ['Africa Twin', 'CB 125 R', 'CB 300 R', 'CB 500 F', 'CB 500 X', 'CB 600 F Hornet', 'CB 650 F', 'CB 650 R', 'CB 750 Hornet', 'CB 1000 R', 'CB 1100', 'CBF 500', 'CBF 600', 'CBF 1000', 'CBR 125 R', 'CBR 250 R', 'CBR 300 R', 'CBR 500 R', 'CBR 600 F', 'CBR 600 RR', 'CBR 650 R', 'CBR 900 RR Fireblade', 'CBR 929 RR', 'CBR 954 RR', 'CBR 1000 RR Fireblade', 'CBR 1100 XX', 'CMX 500 Rebel', 'CMX 1100 Rebel', 'CRF 250 L', 'CRF 300 L', 'CRF 450 L', 'CRF 1000 L', 'CRF 1100 L', 'CTX 700', 'Deauville', 'Forza 125', 'Forza 300', 'Forza 350', 'Forza 750', 'GL 1800 Gold Wing', 'Integra', 'NC 700 S', 'NC 700 X', 'NC 750 S', 'NC 750 X', 'NT 650 V Deauville', 'NT 700 V Deauville', 'NT 1100', 'NX 650 Dominator', 'Pan European', 'PCX 125', 'SH 125', 'SH 150', 'SH 300', 'Transalp', 'Varadero', 'VFR 750', 'VFR 800', 'VFR 1200', 'VT 750', 'VTX 1300', 'VTX 1800', 'X-ADV', 'XL 1000 V Varadero', 'XL 650 V Transalp', 'XL 700 V Transalp'],
  'Husqvarna': ['701 Enduro', '701 Supermoto', 'FC 250', 'FC 350', 'FC 450', 'FE 250', 'FE 350', 'FE 450', 'FE 501', 'Norden 901', 'Svartpilen 125', 'Svartpilen 401', 'Svartpilen 701', 'TC 125', 'TC 250', 'TE 150i', 'TE 250i', 'TE 300i', 'Vitpilen 401', 'Vitpilen 701'],
  'Hyosung': ['Aquila GV 650', 'GT 125', 'GT 250', 'GT 650', 'GV 250', 'GV 650'],
  'Indian Motorcycle': ['Challenger', 'Chief', 'Chief Bobber', 'Chief Classic', 'Chief Dark Horse', 'Chieftain', 'FTR 1200', 'FTR Rally', 'Pursuit', 'Roadmaster', 'Scout', 'Scout Bobber', 'Scout Rogue', 'Springfield', 'Super Chief'],
  'Italjet': ['Dragster 125', 'Dragster 200'],
  'Jawa': ['350', '500'],
  'Kawasaki': ['ER-5', 'ER-6f', 'ER-6n', 'GPZ 500 S', 'GTR 1400', 'H2', 'H2 SX', 'J125', 'J300', 'KLE 500', 'KLR 650', 'KLV 1000', 'KLX 250', 'KX 250', 'KX 450', 'Ninja 125', 'Ninja 250 R', 'Ninja 300', 'Ninja 400', 'Ninja 500', 'Ninja 650', 'Ninja 1000 SX', 'Ninja H2', 'Ninja ZX-4R', 'Ninja ZX-6R', 'Ninja ZX-10R', 'Ninja ZX-14R', 'Versys 650', 'Versys 1000', 'Versys-X 300', 'VN 800', 'VN 900', 'VN 1500', 'VN 1600', 'VN 1700', 'VN 2000', 'Vulcan S', 'W650', 'W800', 'Z125', 'Z250', 'Z300', 'Z400', 'Z650', 'Z750', 'Z800', 'Z900', 'Z900RS', 'Z1000', 'Z1000 SX', 'ZH2', 'ZR-7', 'ZRX 1100', 'ZRX 1200', 'ZX-12R', 'ZZR 600', 'ZZR 1100', 'ZZR 1200', 'ZZR 1400'],
  'Krämer': ['GP2 890R', 'HKD 450'],
  'KTM': ['125 Duke', '200 Duke', '250 Duke', '390 Adventure', '390 Duke', '450 EXC', '450 SMR', '450 SX-F', '500 EXC', '690 Duke', '690 Enduro', '690 SMC', '690 Supermoto', '790 Adventure', '790 Duke', '890 Adventure', '890 Duke', '890 SMT', '950 Adventure', '950 Supermoto', '990 Adventure', '990 SMR', '990 SMT', '1050 Adventure', '1090 Adventure', '1190 Adventure', '1190 RC8', '1290 Super Adventure', '1290 Super Duke GT', '1290 Super Duke R'],
  'Kymco': ['AK 550', 'Downtown 125', 'Downtown 350', 'People S 125', 'X-Town 125', 'X-Town 300', 'Xciting S 400'],
  'Laverda': ['750', '1000'],
  'Mash': ['Dirt Track 125', 'Dirt Track 650', 'Force 400', 'Scrambler 400', 'Seventy 125', 'Seventy Five', 'Side Vintage', 'X-Ride 650'],
  'Miele': ['K 50'],
  'Morbidelli': ['V8'],
  'Moto Guzzi': ['Audace', 'Bellagio', 'Breva 750', 'Breva 850', 'Breva 1100', 'California', 'Eldorado', 'Griso 850', 'Griso 1100', 'MGX-21', 'Norge', 'Stelvio', 'V100 Mandello', 'V7', 'V7 III', 'V85 TT', 'V9 Bobber', 'V9 Roamer'],
  'Moto Morini': ['Corsaro 1200', 'Granpasso', 'Scrambler', 'Seiemmezzo', 'X-Cape'],
  'Motobecane': ['Mobylette'],
  'Mutt Motorcycles': ['Akita 125', 'Fat Sabbath 125', 'Hilts 125', 'Mongrel 125'],
  'MV Agusta': ['Brutale 675', 'Brutale 800', 'Brutale 910', 'Brutale 920', 'Brutale 989', 'Brutale 1000', 'Dragster', 'F3 675', 'F3 800', 'F4', 'Rivale', 'Rush', 'Stradale', 'Superveloce', 'Turismo Veloce'],
  'MZ': ['1000 S', 'Baghira', 'Mastiff', 'Skorpion'],
  'Norton': ['Atlas', 'Commando', 'Dominator', 'V4 SV'],
  'Peugeot': ['Citystar 125', 'Django 125', 'Metropolis', 'Pulsion 125', 'Speedfight 125', 'Tweet 125'],
  'Piaggio': ['Beverly 300', 'Beverly 400', 'Liberty 125', 'Medley 125', 'MP3 300', 'MP3 400', 'MP3 500'],
  'Polaris': ['RZR', 'Scrambler', 'Slingshot', 'Sportsman'],
  'QJ Motor': ['SRK 400', 'SRK 700', 'SRV 700'],
  'Quadro': ['QV3'],
  'Rewaco': ['RF1', 'RF2', 'ST-2', 'ST-3'],
  'Rieju': ['Century 125', 'MR 300', 'RS3', 'Tango 125'],
  'Royal Enfield': ['Bullet 350', 'Bullet 500', 'Classic 350', 'Classic 500', 'Continental GT 650', 'Himalayan', 'Hunter 350', 'INT 650', 'Interceptor 650', 'Meteor 350', 'Scram 411', 'Super Meteor 650'],
  'Sherco': ['250 SE', '250 SEF', '300 SE', '300 SEF', '450 SEF', '500 SEF'],
  'Stark': ['Varg'],
  'Sur-Ron': ['Light Bee', 'Storm Bee', 'Ultra Bee'],
  'Suzuki': ['AN 400 Burgman', 'AN 650 Burgman', 'Bandit 600', 'Bandit 650', 'Bandit 1200', 'Bandit 1250', 'Boulevard', 'DL 650 V-Strom', 'DL 1000 V-Strom', 'DL 1050 V-Strom', 'DR 650', 'DR-Z 400', 'Gladius', 'GS 500', 'GSF 600 Bandit', 'GSF 650 Bandit', 'GSF 1200 Bandit', 'GSF 1250 Bandit', 'GSR 600', 'GSR 750', 'GSX 650 F', 'GSX 1250 F', 'GSX 1300 R Hayabusa', 'GSX-R 600', 'GSX-R 750', 'GSX-R 1000', 'GSX-R 1300 Hayabusa', 'GSX-S 125', 'GSX-S 750', 'GSX-S 1000', 'Hayabusa', 'Intruder', 'Katana', 'RM-Z 250', 'RM-Z 450', 'SFV 650 Gladius', 'SV 650', 'SV 1000', 'V-Strom 250', 'V-Strom 650', 'V-Strom 800', 'V-Strom 1000', 'V-Strom 1050'],
  'SWM': ['Gran Milano 440', 'Gran Turismo 440', 'RS 125', 'RS 300', 'RS 500', 'Silver Vase 440', 'Superdual'],
  'SYM': ['Cruisym 125', 'Cruisym 300', 'Fiddle 125', 'Jet X 125', 'Maxsym 400', 'Maxsym TL 500'],
  'Trevor': ['DTRe Stella'],
  'Triumph': ['Bobber', 'Bonneville', 'Bonneville T100', 'Bonneville T120', 'Daytona 600', 'Daytona 650', 'Daytona 675', 'Daytona Moto2 765', 'Explorer', 'Rocket 3', 'Scrambler', 'Speed Four', 'Speed Triple', 'Speed Triple 1200', 'Speed Twin', 'Sprint GT', 'Sprint RS', 'Sprint ST', 'Street Cup', 'Street Scrambler', 'Street Triple', 'Street Triple R', 'Street Triple RS', 'Street Twin', 'Thruxton', 'Thruxton R', 'Thruxton RS', 'Tiger 660', 'Tiger 800', 'Tiger 850', 'Tiger 900', 'Tiger 1050', 'Tiger 1200', 'Tiger Explorer', 'Tiger Sport 660', 'Trident 660', 'Trophy'],
  'TR Motor': ['TR 450'],
  'TRS': ['One', 'X-Track 250', 'X-Track 280', 'X-Track 300'],
  'Ultraviolette': ['F77'],
  'Vent': ['Baja 450', 'Derapage 50'],
  'Vespa': ['GTS 125', 'GTS 300', 'Primavera 125', 'Primavera 150', 'Sprint 125', 'Sprint 150'],
  'Victory': ['Cross Country', 'Cross Roads', 'Gunner', 'Hammer', 'Highball', 'Judge', 'Magnum', 'Octane', 'Vegas', 'Vision'],
  'Voge': ['300 AC', '300 DS', '300 R', '500 AC', '500 DS', '500 R', '525 ACX', '525 DSX', '650 DS', '900 DS'],
  'Yamaha': ['Bolt', 'Drag Star', 'FJ-09', 'FJR 1300', 'FZ1', 'FZ6', 'FZ6 Fazer', 'FZ8', 'FZ-07', 'FZ-09', 'FZ-10', 'FZS 600 Fazer', 'FZS 1000 Fazer', 'MT-01', 'MT-03', 'MT-07', 'MT-09', 'MT-10', 'MT-125', 'Niken', 'R1', 'R1M', 'R3', 'R6', 'R7', 'R125', 'Raider', 'SCR 950', 'SR 400', 'Star Venture', 'Super Tenere', 'T-Max 500', 'T-Max 530', 'T-Max 560', 'TDM 850', 'TDM 900', 'Tenere 700', 'Tracer 700', 'Tracer 900', 'Tracer 9', 'TRX 850', 'V-Max', 'Virago', 'WR 125', 'WR 250', 'WR 450', 'X-Max 125', 'X-Max 250', 'X-Max 300', 'X-Max 400', 'XJ6', 'XJ6 Diversion', 'XJR 1200', 'XJR 1300', 'XSR 125', 'XSR 700', 'XSR 900', 'XT 660 X', 'XT 660 Z Tenere', 'XT 1200 Z Super Tenere', 'XTZ 750 Super Tenere', 'XV 535 Virago', 'XV 750 Virago', 'XV 950', 'XVS 650 Drag Star', 'XVS 950', 'XVS 1100 Drag Star', 'XVS 1300', 'YBR 125', 'YZ 125', 'YZ 250', 'YZ 450', 'YZF-R1', 'YZF-R1M', 'YZF-R3', 'YZF-R6', 'YZF-R7', 'YZF-R125'],
  'Zero': ['DS', 'DSR', 'FX', 'FXE', 'S', 'SR', 'SR/F', 'SR/S']
};

const MOTORCYCLE_BRANDS = Object.keys(MOTORCYCLE_DATABASE).sort();

// Bouwjaren van 1960 tot huidig jaar + 1
const YEARS = Array.from({ length: new Date().getFullYear() - 1960 + 2 }, (_, i) => new Date().getFullYear() + 1 - i);

const ForeignDealerAddMotorcycle = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    price: '',
    starting_price: '',
    mileage: '',
    color: '',
    description: '',
    condition: 'good',
    images: []
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (field, value) => {
    // Reset model when brand changes
    if (field === 'brand' && value !== formData.brand) {
      setFormData(prev => ({ ...prev, brand: value, model: '' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImage(true);
    const uploadedUrls = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post(`${API}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        });
        uploadedUrls.push(response.data.url);
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error(`Upload failed: ${file.name}`);
      }
    }

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...uploadedUrls]
    }));
    setUploadingImage(false);
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.brand || !formData.model || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        year: parseInt(formData.year),
        price: parseFloat(formData.price),
        starting_price: formData.starting_price ? parseFloat(formData.starting_price) : parseFloat(formData.price) * 0.8,
        mileage: parseInt(formData.mileage) || 0,
        auction_duration_hours: 0
      };

      await axios.post(`${API}/motorcycles/foreign-listing`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Motorcycle submitted for review!');
      navigate('/foreign-dealer');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Could not submit motorcycle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="content-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/foreign-dealer')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('foreignDealer.addMotorcycle')}
            </h1>
            <p className="text-zinc-500 mt-1">{t('foreignDealer.infoMessage')}</p>
          </div>
        </div>
      </div>

      <div className="content-body">
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="font-barlow text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <Bike className="w-5 h-5" />
              {t('motorcycle.addMotorcycle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="brand">{t('motorcycle.brand')} *</Label>
                  <Select 
                    value={formData.brand} 
                    onValueChange={(value) => handleSelectChange('brand', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kies een merk" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {MOTORCYCLE_BRANDS.map(brand => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">{t('motorcycle.model')} *</Label>
                  <Select 
                    value={formData.model} 
                    onValueChange={(value) => handleSelectChange('model', value)}
                    disabled={!formData.brand}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.brand ? "Kies een model" : "Kies eerst een merk"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {formData.brand && MOTORCYCLE_DATABASE[formData.brand]?.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">{t('motorcycle.year')} *</Label>
                  <Select 
                    value={formData.year?.toString()} 
                    onValueChange={(value) => handleSelectChange('year', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kies jaar" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {YEARS.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mileage">{t('motorcycle.mileage')}</Label>
                  <Input
                    id="mileage"
                    name="mileage"
                    type="number"
                    min="0"
                    value={formData.mileage}
                    onChange={handleChange}
                    placeholder="e.g. 15000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">{t('motorcycle.color')}</Label>
                  <Input
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    placeholder="e.g. Green"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">{t('motorcycle.condition')}</Label>
                  <select
                    id="condition"
                    name="condition"
                    value={formData.condition}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="new">{t('motorcycle.new')}</option>
                    <option value="excellent">{t('motorcycle.excellent')}</option>
                    <option value="good">{t('motorcycle.good')}</option>
                    <option value="fair">{t('motorcycle.fair')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Vraagprijs (CHF) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="e.g. 8500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('motorcycle.description')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the motorcycle..."
                  rows={4}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>{t('motorcycle.images')}</Label>
                <div className="border-2 border-dashed border-purple-200 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    disabled={uploadingImage}
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className={`w-8 h-8 ${uploadingImage ? 'text-purple-300 animate-pulse' : 'text-purple-400'}`} />
                    <span className="text-zinc-600">
                      {uploadingImage ? 'Uploading...' : 'Click to upload photos'}
                    </span>
                  </label>
                </div>
                
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    {formData.images.map((url, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={url}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/foreign-dealer')}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    t('common.submit')
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ForeignDealerAddMotorcycle;
