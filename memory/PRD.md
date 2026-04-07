# Moto Import Platform - PRD

## Oorspronkelijke Probleemstelling
Een uitgebreid platform voor het motorhandelnetwerk "Moto Import" met dealer management, bestellingen, voorstellen, en diverse integraties.

## Kernfuncties
- **Dealer Platform**: Dashboard, bestellingen, voorstellen, motor verkoop, zoekertjes
- **Admin Platform**: Motorcycles beheer, orders, dealers, marketing, taxatie
- **Foreign Dealer**: Motoren aanmelden, prijs beheer
- **Particulier Platform**: Private verkoop met Stripe abonnement
- **Pakbon Rol**: Beperkte rol voor pakbon beheer
- **Taxatie Facturen**: Exclusief voor motoimportbv@gmail.com
- **Taxatie Programma**: Professionele motorfiets waardebepaling tool (exclusief motoimportbv@gmail.com)
- **Google Motoren**: SEO-geoptimaliseerde publieke motoren pagina's met social media generatie

## Gebruikersrollen
- **Admin** (motoimportbv@gmail.com, Daniel2002jay@hotmail.com, Motomaniabv@gmail.com)
- **Dealer** (goedgekeurde dealers)
- **Foreign Dealer** (buitenlandse leveranciers)
- **Particulier** (private verkopers)
- **Pakbon** (alleen pakbon toegang)

## Architectuur
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Betalingen**: Stripe (emergentintegrations)
- **Opslag**: Emergent Object Storage
- **AI**: OpenAI GPT-4.1-mini (social media tekst), OpenAI TTS, Sora 2 (via Emergent LLM Key)
- **Image Processing**: Pillow (social media cards + flyers)

## Wat is gebouwd

### Sessie 7 april 2026
- **Taxatie Programma getest en afgerond**: Alle CRUD operaties (aanmaken, bekijken, bewerken, finaliseren, verwijderen) getest via testing agent. 100% backend tests passed (15/15), 95% frontend. Frontend access control fix toegevoegd (email-gating in component).

### Sessie 30 maart 2026
- **Google Motoren**: Dealers uploaden motoren voor Google indexering. Twee betaalopties: per motor OF onbeperkt (Stripe). Admin keurt goed/af. Publieke SEO pagina's. 100% getest.
- **Social Media Post Generatie**: Bij goedkeuring genereert AI automatisch een pakkende Nederlandse tekst + Pillow maakt branded afbeelding.
- **Dealer Promo Popup**: Eenmalige popup bij inloggen voor dealers over Google Motoren.
- **Dealer Wervingsflyers**: A4 print-klaar + Instagram flyer gegenereerd met Pillow.
- **Pakbon Updates**: Leverancier telefoon/adres velden toegevoegd aan pakbon.
- **Admin Wachtwoord Reset**: Handmatige password reset button voor dealers.
- **WhatsApp URL Fix**: Hardcoded naar motoimportbv.nl productie URL.

### Eerdere sessies
- Particulier platform (registratie, Stripe, dashboard)
- Dealer prive listings
- Taxatie factuur module (PDF, BTW, auto-draft, maandelijkse herinnering)
- Pakbon rol met beperkte toegang
- Foreign dealer prijs management
- Voucher systeem
- GitHub security fix (git history cleanup)
- AI content generatie (Italiaanse audio, video clips)

## Prioritized Backlog

### P0 - Kritisch
- Backend Refactoring: server.py opsplitsen (9600+ regels) - actief risico voor code-corruptie

### P1 - Aankomend
- WhatsApp notificaties implementeren
- Franse promotievideo genereren
- Emergent LLM Key budget monitoren

### P2 - Toekomstig
- MoneyMonk API integratie (wacht op API key)
- Kosten toevoegen aan voorstel opties
- Bevestigingsdialoog voor opnieuw aanbieden verkochte motor
- "Flyers Download" pagina voor dealers
- Email flyer bezorging op productie (verificatie nodig - recurring issue)

## Belangrijke API Endpoints

### Taxatie Programma
- `POST /api/taxatie-programma` - Taxatie aanmaken
- `GET /api/taxatie-programma` - Alle taxaties ophalen
- `GET /api/taxatie-programma/{id}` - Taxatie detail
- `PUT /api/taxatie-programma/{id}` - Taxatie bijwerken
- `POST /api/taxatie-programma/{id}/finalize` - Definitief maken
- `DELETE /api/taxatie-programma/{id}` - Verwijderen

### Google Motoren
- `POST /api/google-motors/checkout` - Stripe checkout
- `GET /api/google-motors/subscription` - Abonnement status
- `POST /api/google-motors` - Motor aanmelden
- `GET /api/google-motors/my` - Dealer's eigen motoren
- `GET /api/google-motors/pending` - Admin: wachtende motoren
- `POST /api/google-motors/{id}/approve` - Admin: goedkeuren + social media generatie
- `GET /api/public/motors` - Publiek: goedgekeurde motoren

## Database Schema
- `taxatie_programma`: `{ id, taxatie_nummer, brand, model, year, mileage, kenteken, scores (10x), customer_data, valuations, status (concept/definitief), photos }`
- `google_motors`: `{ id, dealer_id, brand, model, status, social_text, social_image_url }`
- `google_motor_subscriptions`: `{ id, dealer_id, plan, amount, session_id, status, expires_at }`

## Test Credentials (Preview)
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
