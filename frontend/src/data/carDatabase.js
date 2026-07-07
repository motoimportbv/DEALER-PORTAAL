// Personenauto merken + modellen (top NL / EU markt) — voor taxatie/import
// Uitgebreid genoeg om 95% van consumenten-taxaties te dekken.

export const CAR_DATABASE = {
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'e-tron', 'e-tron GT', 'RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'RS Q3', 'RS Q8', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'SQ5', 'SQ7', 'SQ8', 'TT', 'TT RS', 'TTS'],
  'BMW': ['1-serie', '2-serie', '2-serie Active Tourer', '2-serie Gran Coupé', '3-serie', '4-serie', '4-serie Gran Coupé', '5-serie', '6-serie', '7-serie', '8-serie', 'i3', 'i4', 'i5', 'i7', 'i8', 'iX', 'iX1', 'iX3', 'M2', 'M3', 'M4', 'M5', 'M6', 'M8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM', 'Z4'],
  'Citroën': ['C1', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C4 X', 'C5 Aircross', 'C5 X', 'DS3', 'DS4', 'DS5', 'ë-C4', 'Berlingo', 'SpaceTourer'],
  'Cupra': ['Ateca', 'Born', 'Formentor', 'Leon', 'Tavascan', 'Terramar'],
  'DS Automobiles': ['DS 3', 'DS 3 Crossback', 'DS 4', 'DS 7', 'DS 9'],
  'Dacia': ['Duster', 'Jogger', 'Logan', 'Sandero', 'Spring'],
  'Fiat': ['500', '500 Elettra', '500L', '500X', '600', 'Panda', 'Tipo'],
  'Ford': ['B-Max', 'C-Max', 'Ecosport', 'Edge', 'Explorer', 'Fiesta', 'Focus', 'Galaxy', 'Ka+', 'Kuga', 'Mondeo', 'Mustang', 'Mustang Mach-E', 'Puma', 'S-Max', 'Transit Custom'],
  'Honda': ['Civic', 'CR-V', 'e:Ny1', 'HR-V', 'Insight', 'Jazz', 'ZR-V'],
  'Hyundai': ['Bayon', 'i10', 'i20', 'i30', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Kona Electric', 'Santa Fe', 'Tucson'],
  'Jaguar': ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'XE', 'XF', 'XJ'],
  'Jeep': ['Avenger', 'Compass', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  'Kia': ['Ceed', 'EV3', 'EV6', 'EV9', 'Niro', 'Niro EV', 'Picanto', 'ProCeed', 'Rio', 'Sorento', 'Sportage', 'Stonic', 'XCeed'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  'Lexus': ['CT', 'ES', 'IS', 'LC', 'LS', 'NX', 'RX', 'RZ', 'UX'],
  'Mazda': ['CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-80', 'MX-5', 'MX-30', 'Mazda2', 'Mazda3', 'Mazda6'],
  'Mercedes-Benz': ['A-Klasse', 'AMG GT', 'B-Klasse', 'C-Klasse', 'CLA', 'CLE', 'CLS', 'E-Klasse', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'EQV', 'G-Klasse', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Klasse', 'SL', 'V-Klasse'],
  'MG': ['MG3', 'MG4 Electric', 'MG5 Electric', 'Marvel R', 'ZS EV', 'HS'],
  'Mini': ['Aceman', 'Cabrio', 'Clubman', 'Cooper', 'Cooper SE', 'Countryman', 'Countryman Electric', 'One'],
  'Mitsubishi': ['ASX', 'Colt', 'Eclipse Cross', 'Outlander', 'Space Star'],
  'Nissan': ['Ariya', 'Juke', 'Leaf', 'Micra', 'Note', 'Qashqai', 'X-Trail'],
  'Opel': ['Adam', 'Astra', 'Astra Electric', 'Corsa', 'Corsa Electric', 'Crossland', 'Frontera', 'Grandland', 'Insignia', 'Mokka', 'Mokka Electric'],
  'Peugeot': ['108', '208', 'e-208', '2008', 'e-2008', '308', 'e-308', '408', '3008', 'e-3008', '5008', 'e-5008', '508', 'Partner', 'Rifter'],
  'Polestar': ['Polestar 2', 'Polestar 3', 'Polestar 4'],
  'Porsche': ['718 Boxster', '718 Cayman', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  'Renault': ['Arkana', 'Austral', 'Captur', 'Clio', 'Espace', 'Kadjar', 'Kangoo', 'Megane', 'Megane E-Tech', 'Scenic E-Tech', 'Symbioz', 'Trafic', 'Twingo', 'ZOE'],
  'SEAT': ['Alhambra', 'Arona', 'Ateca', 'Ibiza', 'Leon', 'Mii', 'Tarraco'],
  'Skoda': ['Citigo', 'Enyaq', 'Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Scala', 'Superb'],
  'Smart': ['#1', '#3', 'ForFour', 'ForTwo', 'ForTwo EQ'],
  'Subaru': ['Forester', 'Impreza', 'Outback', 'Solterra', 'XV'],
  'Suzuki': ['Across', 'Baleno', 'Ignis', 'Jimny', 'S-Cross', 'Swift', 'Swace', 'Vitara'],
  'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'],
  'Toyota': ['Aygo', 'Aygo X', 'bZ4X', 'C-HR', 'Camry', 'Corolla', 'Corolla Cross', 'Highlander', 'Land Cruiser', 'Mirai', 'Prius', 'Proace', 'RAV4', 'Supra', 'Yaris', 'Yaris Cross'],
  'Volkswagen': ['Amarok', 'Arteon', 'Atlas', 'California', 'Caddy', 'Golf', 'Golf GTI', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID. Buzz', 'Passat', 'Polo', 'Sharan', 'Taigo', 'T-Cross', 'T-Roc', 'Tiguan', 'Touareg', 'Touran', 'Transporter', 'up!'],
  'Volvo': ['C40 Recharge', 'EX30', 'EX40', 'EX90', 'S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90'],
  'Overige': []
};

export const CAR_BRANDS = Object.keys(CAR_DATABASE).sort();
