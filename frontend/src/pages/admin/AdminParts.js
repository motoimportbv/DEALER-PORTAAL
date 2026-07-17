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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Alle motormerken van motoroccasion.nl met modellen
const MOTORCYCLE_DATABASE = {
  'Acces': ['ATV'],
  'Aprilia': ['Atlantic 500', 'Caponord 1200', 'Dorsoduro 750', 'Dorsoduro 900', 'Dorsoduro 1200', 'ETV 1000 Caponord', 'Mana 850', 'Pegaso 650', 'RS 125', 'RS 250', 'RS 457', 'RS 660', 'RS4', 'RST Mille Futura', 'RSV 1000 R', 'RSV4', 'RSV4 Factory', 'Scarabeo 500', 'Shiver 750', 'Shiver 900', 'SR Max 300', 'SX 125', 'Tuareg 660', 'Tuono 660', 'Tuono V4'],
  'Arctic Leopard': ['ATV'],
  'Benelli': ['302 S', '502 C', '752 S', 'BN 125', 'BN 251', 'BN 302', 'BN 600', 'Imperiale 400', 'Leoncino 250', 'Leoncino 500', 'Leoncino 800', 'TNT 125', 'TNT 300', 'TNT 600', 'TNT 899', 'TNT 1130', 'TRK 251', 'TRK 502', 'TRK 702', 'TRK 902 Stradale', 'TRK 902 Explorer'],
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
