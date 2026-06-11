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

/**
 * Geeft de branding terug voor een taxatie/scherm.
 * Volgorde van prioriteit:
 *   1) taxatie.branding_override (whitelabel — bv. Bloemert Motoren)
 *   2) user.role === 'taxateur' → diens eigen company-info
 *   3) Moto Import B.V. (default)
 */
export function getBranding(user, taxatie) {
  // 1. Per-taxatie whitelabel override
  const override = taxatie && taxatie.branding_override;
  if (override && (override.company_name || override.name)) {
    const addr = [override.address, override.postal_code, override.city]
      .filter(Boolean).join(', ');
    return {
      name: override.company_name || override.name,
      shortName: override.company_name || override.name,
      kvk: override.kvk || '',
      btw: override.btw || '',
      rsin: '',
      phone: override.phone || '',
      email: override.email || '',
      address: addr || '',
      taxateur_name: override.taxateur_name || '',
      taxateur_title: override.taxateur_title || '',
      vehicleType: 'motorfiets',
      vehicleLabel: 'motorfiets',
      vehicleLabelPlural: 'motorfietsen',
      brancheLabel: 'motorfietsbranche',
      isCustomBrand: true,
      isWhitelabel: true,
    };
  }
  // 2. Logged-in taxateur eigen branding
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
