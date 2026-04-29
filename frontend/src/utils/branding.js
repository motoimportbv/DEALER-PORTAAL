// Centrale branding helper - geeft bedrijfsgegevens terug per gebruiker
const DEFAULT_MOTO_IMPORT = {
  name: 'Moto Import B.V.',
  shortName: 'Moto Import',
  kvk: '94622086',
  btw: 'NL867456982B01',
  rsin: '867456982',
  phone: '+31 6 24264861',
  email: 'motoimportbv@gmail.com',
  address: 'Horsterhoekweg 11, 7433 SV Schalkhaar',
  vehicleType: 'motorfiets',
  vehicleLabel: 'motorfiets',
  vehicleLabelPlural: 'motorfietsen',
  brancheLabel: 'motorfietsbranche',
  isCustomBrand: false,
};

export function getBranding(user) {
  if (!user || user.role !== 'taxateur') return { ...DEFAULT_MOTO_IMPORT };
  const vehicleType = (user.vehicle_type || 'motorfiets').toLowerCase();
  const isAuto = vehicleType === 'auto';
  return {
    name: user.company_name || user.username || 'Taxateur',
    shortName: user.company_name || user.username || 'Taxateur',
    kvk: user.kvk_number || '',
    btw: user.btw_number || '',
    rsin: '',
    phone: user.phone || '',
    email: user.email || '',
    address: user.address || '',
    vehicleType,
    vehicleLabel: isAuto ? 'auto' : 'motorfiets',
    vehicleLabelPlural: isAuto ? "auto's" : 'motorfietsen',
    brancheLabel: isAuto ? 'automotive branche' : 'motorfietsbranche',
    isCustomBrand: true,
  };
}
