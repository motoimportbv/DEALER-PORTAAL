# Moto Import Platform - PRD

## Oorspronkelijke Probleemstelling
Een uitgebreid platform voor het motorhandelnetwerk "Moto Import" met dealer management, bestellingen, voorstellen, en diverse integraties.

## Kernfuncties
- **Dealer Platform**: Dashboard, bestellingen, voorstellen, motor verkoop, zoekertjes
- **Admin Platform**: Motorcycles beheer, orders, dealers, marketing, taxatie
- **Foreign Dealer**: Motoren aanmelden, prijs beheer
- **Particulier Platform**: Private verkoop met €4.95/week Stripe abonnement
- **Pakbon Rol**: Beperkte rol voor pakbon beheer
- **Taxatie Facturen**: Exclusief voor motoimportbv@gmail.com
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

### Sessie 30 maart 2026
- **Google Motoren**: Dealers uploaden motoren voor Google indexering. Twee betaalopties: €2.95/week per motor OF €45/maand onbeperkt (Stripe). Admin keurt goed/af. Publieke SEO pagina's `/motoren` en `/motor/:id/:slug`. Alle dealer info zichtbaar. Interesse-formulier stuurt email naar admin. 100% getest (20/20 backend + frontend).
- **Social Media Post Generatie**: Bij goedkeuring genereert AI automatisch een pakkende Nederlandse tekst + Pillow maakt branded afbeelding (1200x630). Dealers kunnen tekst kopiëren en afbeelding downloaden.
- **Dealer Promo Popup**: Eenmalige popup bij inloggen voor dealers over Google Motoren. Tekst: "Google verkoopt uw motor sneller dan MotoOccasion en Marktplaats". Knop: "Meld u nu aan". Verschijnt 1x (localStorage).
- **Dealer Wervingsflyers**: A4 print-klaar + Instagram (1080x1080) flyer gegenereerd met Pillow. Bevat: "Vergroot uw bereik", "Gegarandeerd meer motoren verkopen", "Eerste week gratis", QR-code naar motoimportbv.nl/google, twee tarieven.

### Eerdere sessies
- Particulier platform (registratie, Stripe €4.95/week, dashboard)
- Dealer privé listings (€175 purchase flow)
- Taxatie factuur module (PDF, BTW, auto-draft, maandelijkse herinnering)
- Cloudflare DNS troubleshooting
- Pakbon rol met beperkte toegang
- Foreign dealer prijs management
- Voucher systeem
- GitHub security fix (git history cleanup)
- AI content generatie (Italiaanse audio, video clips)

## Prioritized Backlog

### P1 - Aankomend
- WhatsApp notificaties implementeren
- Franse promotievideo genereren
- Emergent LLM Key budget monitoren

### P2 - Toekomstig
- MoneyMonk API integratie (wacht op API key)
- Kosten toevoegen aan voorstel opties
- Bevestigingsdialoog voor opnieuw aanbieden verkochte motor
- "Flyers Download" pagina voor dealers
- Backend refactoring (server.py opsplitsen - 9500+ regels)
- Email flyer bezorging op productie (verificatie nodig)

## Belangrijke API Endpoints

### Google Motoren
- `POST /api/google-motors/checkout` - Stripe checkout
- `GET /api/google-motors/subscription` - Abonnement status
- `POST /api/google-motors` - Motor aanmelden
- `GET /api/google-motors/my` - Dealer's eigen motoren
- `DELETE /api/google-motors/{id}` - Motor verwijderen
- `GET /api/google-motors/pending` - Admin: wachtende motoren (alleen motoimportbv@gmail.com)
- `POST /api/google-motors/{id}/approve` - Admin: goedkeuren + social media generatie
- `POST /api/google-motors/{id}/reject` - Admin: afwijzen
- `GET /api/google-motors/social-image/{id}` - Social media afbeelding
- `GET /api/public/motors` - Publiek: goedgekeurde motoren
- `GET /api/public/motors/brands` - Publiek: merken
- `GET /api/public/motors/{id}` - Publiek: motor detail
- `POST /api/public/motors/{id}/interest` - Publiek: interesse formulier

## Database Schema (Google Motoren)
- `google_motors`: `{ id, dealer_id, dealer_email, dealer_company, dealer_phone, dealer_city, brand, model, year, price, mileage, description, images, status, plan, expires_at, social_text, social_image_url, social_image_data }`
- `google_motor_subscriptions`: `{ id, dealer_id, plan, amount, session_id, status, expires_at }`
- `google_motor_leads`: `{ id, motor_id, dealer_id, visitor_name, visitor_email, visitor_phone, message }`

## Test Credentials (Preview)
- Dealer: testgoogle@dealer.nl / Test2024!
- Admin: motoimportbv@gmail.com / Admin2024!
