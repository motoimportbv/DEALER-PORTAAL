import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { ArrowLeft, Save, Plus, X, ImageIcon, Camera, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

const MotorcycleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

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
    images: [],
    is_available: true
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      fetchMotorcycle();
    }
  }, [id]);

  const fetchMotorcycle = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/${id}`);
      setFormData(response.data);
    } catch (error) {
      toast.error('Kon motor niet laden');
      navigate('/admin/motorcycles');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addImage = () => {
    if (newImageUrl.trim()) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, newImageUrl.trim()]
      }));
      setNewImageUrl('');
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      try {
        const response = await axios.post(`${API}/upload`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedUrls.push(response.data.url);
      } catch (error) {
        toast.error(`Kon ${file.name} niet uploaden`);
      }
    }

    if (uploadedUrls.length > 0) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
      toast.success(`${uploadedUrls.length} foto('s) geüpload`);
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        starting_price: parseFloat(formData.price), // Same as price - no auction
        mileage: parseInt(formData.mileage),
        year: parseInt(formData.year)
      };

      if (isEditing) {
        await axios.put(`${API}/motorcycles/${id}`, payload);
        toast.success('Motor bijgewerkt');
      } else {
        await axios.post(`${API}/motorcycles`, payload);
        toast.success('Motor toegevoegd');
      }
      navigate('/admin/motorcycles');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Er ging iets mis');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
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
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/admin/motorcycles')}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {isEditing ? 'Motor Bewerken' : 'Nieuwe Motor'}
            </h1>
            <p className="text-zinc-500 mt-1">
              {isEditing ? 'Pas de motorgegevens aan' : 'Voeg een nieuwe motor toe aan uw voorraad'}
            </p>
          </div>
        </div>
      </div>

      <div className="content-body">
        <form onSubmit={handleSubmit} data-testid="motorcycle-form">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-barlow text-lg font-bold uppercase tracking-tight">
                  Basis Informatie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Merk *
                    </Label>
                    <Select 
                      value={formData.brand} 
                      onValueChange={(value) => handleChange('brand', value)}
                    >
                      <SelectTrigger data-testid="brand-input">
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
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Model *
                    </Label>
                    <Input
                      value={formData.model}
                      onChange={(e) => handleChange('model', e.target.value)}
                      placeholder="bijv. Panigale V4"
                      data-testid="model-input"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Bouwjaar *
                    </Label>
                    <Input
                      type="number"
                      value={formData.year}
                      onChange={(e) => handleChange('year', e.target.value)}
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      data-testid="year-input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Prijs (€) *
                    </Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleChange('price', e.target.value)}
                      placeholder="25000"
                      min="0"
                      data-testid="price-input"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Kilometerstand *
                    </Label>
                    <Input
                      type="number"
                      value={formData.mileage}
                      onChange={(e) => handleChange('mileage', e.target.value)}
                      placeholder="15000"
                      min="0"
                      data-testid="mileage-input"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Kleur *
                    </Label>
                    <Input
                      value={formData.color}
                      onChange={(e) => handleChange('color', e.target.value)}
                      placeholder="bijv. Rosso Corsa"
                      data-testid="color-input"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                    <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                      Conditie *
                    </Label>
                    <Select 
                      value={formData.condition} 
                      onValueChange={(value) => handleChange('condition', value)}
                    >
                      <SelectTrigger data-testid="condition-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Nieuw</SelectItem>
                        <SelectItem value="excellent">Uitstekend</SelectItem>
                        <SelectItem value="good">Goed</SelectItem>
                        <SelectItem value="fair">Redelijk</SelectItem>
                      </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                    Beschrijving
                  </Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Geef een uitgebreide beschrijving van de motor..."
                    rows={4}
                    data-testid="description-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-lg font-bold uppercase tracking-tight">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">Beschikbaar</p>
                      <p className="text-sm text-zinc-500">Zichtbaar voor dealers</p>
                    </div>
                    <Switch
                      checked={formData.is_available}
                      onCheckedChange={(checked) => handleChange('is_available', checked)}
                      data-testid="availability-switch"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Images */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-lg font-bold uppercase tracking-tight">
                    Afbeeldingen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Upload buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      data-testid="file-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      data-testid="upload-btn"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload Foto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'environment';
                        input.onchange = (e) => handleFileUpload(e);
                        input.click();
                      }}
                      disabled={uploading}
                      data-testid="camera-btn"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Maak Foto
                    </Button>
                  </div>

                  {/* URL input (optional) */}
                  <div className="flex gap-2">
                    <Input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Of plak een URL..."
                      className="text-sm"
                      data-testid="image-url-input"
                    />
                    <Button type="button" onClick={addImage} variant="outline" size="icon" data-testid="add-image-btn">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {formData.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {formData.images.map((url, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100">
                          <img src={url} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-700"
                            data-testid={`remove-image-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-square rounded-lg border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400">
                      <Camera className="w-10 h-10 mb-2" />
                      <p className="text-sm">Nog geen afbeeldingen</p>
                      <p className="text-xs mt-1">Upload of maak een foto</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/admin/motorcycles')}
                  data-testid="cancel-btn"
                >
                  Annuleren
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={loading}
                  data-testid="save-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Opslaan...' : 'Opslaan'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default MotorcycleForm;
