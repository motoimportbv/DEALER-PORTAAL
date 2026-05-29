# Moto Import - Test Credentials

## Admin Account
- Email: motoimportbv@gmail.com
- Password: Admin2024!

## Admin Team Member (Daniel — gedeelde data-pool met motoimportbv)
- Email: Daniel2002jay@hotmail.com
- Password: Daniel2024!
- Role: admin
- Toegang: BPM Vermindering + Taxatie Facturen + Maandfactuur Overzicht + Mijn Klanten
- Data: gedeelde Moto Import admin-bucket (ziet ALLE records van motoimportbv + eigen)
- Branding: Moto Import B.V. (zelfde als motoimportbv)
- AI ondertekening: "S. Milone namens Moto Import B.V."

## Dealer Account (Test)
- Email: zoektest@dealer.nl
- Password: Test2024!

## Pakbon Account (Ellen)
- Email: ellenmilone@gmail.com
- Password: Test2024!
- Role: pakbon (restricted to /pakbonnen and /pakbon/* routes)

## Taxateur Account (Deniz - alleen Taxatie Facturen + BPM Vermindering, auto's)
- Email: denizkabakolak10@hotmail.com
- Password: Kabakolakdeniz!
- Username: Denizkabakolak23
- Bedrijfsnaam: DK Automotive
- KvK: 88479935 | BTW: NL004610985B39
- Adres: Schotwillemsweg 1c, Lettele
- vehicle_type: auto (alleen auto's, geen motorfietsen)
- Role: taxateur (restricted to /admin/taxatie and /admin/taxatie-programma routes)
- Eigen branding: PDFs en UI tonen "DK Automotive" i.p.v. "Moto Import"

## Test Order (with pakbon data pre-filled)
- Order ID: 630312c9-2560-41ac-98a8-626d79cc3651
- Has: kentekenbewijs_url, payment_instructions (CHF 7.500, Hostettler AG, IBAN CH93...), license plate

## Taxatie Dealer Self-Registration (NEW Feb 2026)
- Public register endpoint: POST /api/public/taxatie-dealer-register (no auth)
- Login: POST /api/auth/login → returns user with role="taxatie_dealer"
- Dealer dashboard: /taxatie-dealer/dashboard
- Profile API: GET /api/dealer/me
- Eigen aanvragen API: GET /api/dealer/aanvragen (gefilterd op email match)
- Tested register: jan@dealertest.nl / test12345 (was cleaned up after test)
- **Role isolation (Feb 2026)**: TaxatieDealerGuard component in `frontend/src/components/TaxatieDealerGuard.js` blokkeert deze rol van /admin/*, /dealer/*, /particulier/*, /foreign-dealer/* routes. Allowed paths: /taxatie-dealer/*, /taxatie, public motor pages, /login. Backend: /auth/register weigert role=taxatie_dealer (alleen via /public/taxatie-dealer-register).
