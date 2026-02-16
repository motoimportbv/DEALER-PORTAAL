# Moto Import - Native App Build Guide

Dit is een complete handleiding om de Moto Import app te publiceren in de Apple App Store en Google Play Store.

## Overzicht

De app is al geconfigureerd met Capacitor en klaar voor native builds:
- **App ID**: `nl.motoimport.app`
- **App Naam**: Moto Import
- **iOS project**: `/app/frontend/ios/`
- **Android project**: `/app/frontend/android/`

---

## Vereisten

### Voor iOS (Apple App Store)
1. **Mac computer** met macOS 12 of nieuwer
2. **Xcode 14+** (gratis via Mac App Store)
3. **Apple Developer Account** - $99/jaar
   - Aanmelden op: https://developer.apple.com/programs/enroll/

### Voor Android (Google Play Store)
1. **Android Studio** (gratis, werkt op Windows/Mac/Linux)
   - Download: https://developer.android.com/studio
2. **Google Play Developer Account** - éénmalig $25
   - Aanmelden op: https://play.google.com/console/signup

---

## Stap 1: Project Voorbereiden

### 1.1 Download het project
Download de volledige project code naar uw computer.

### 1.2 Installeer dependencies
```bash
cd frontend
npm install
```

### 1.3 Bouw de web app
```bash
npm run build
```

### 1.4 Synchroniseer met native platforms
```bash
npm run cap:sync
# OF afzonderlijk:
# npx cap sync ios
# npx cap sync android
```

---

## Stap 2: iOS App Bouwen (Apple App Store)

### 2.1 Open het iOS project
```bash
npm run cap:open:ios
# OF: npx cap open ios
```

Dit opent Xcode met het iOS project.

### 2.2 Configureer Signing
1. In Xcode, selecteer het **App** project in de navigator
2. Klik op de **App** target
3. Ga naar **Signing & Capabilities** tab
4. Vink **Automatically manage signing** aan
5. Selecteer uw **Team** (uw Apple Developer Account)

### 2.3 Configureer App Icons
De app icons moeten worden toegevoegd in Xcode:
1. Open `App/App/Assets.xcassets/AppIcon.appiconset`
2. Sleep uw app icon (1024x1024px) naar de juiste slots

### 2.4 Bouw voor Release
1. Selecteer **Any iOS Device** als target (niet simulator)
2. Ga naar **Product** → **Archive**
3. Wacht tot de build klaar is
4. In het Organizer venster, selecteer uw archive
5. Klik op **Distribute App**
6. Selecteer **App Store Connect**
7. Volg de wizard om te uploaden

### 2.5 App Store Connect
1. Ga naar https://appstoreconnect.apple.com
2. Maak een nieuwe app aan met Bundle ID: `nl.motoimport.app`
3. Vul alle vereiste metadata in:
   - App naam
   - Beschrijving
   - Screenshots (min. 3 per device type)
   - Privacy Policy URL
   - Support URL
4. Selecteer de geüploade build
5. Dien in voor review

---

## Stap 3: Android App Bouwen (Google Play Store)

### 3.1 Open het Android project
```bash
npm run cap:open:android
# OF: npx cap open android
```

Dit opent Android Studio met het project.

### 3.2 Configureer Signing Key
1. In Android Studio, ga naar **Build** → **Generate Signed Bundle / APK**
2. Selecteer **Android App Bundle**
3. Klik op **Create new...** voor een nieuwe keystore:
   - Key store path: `/path/to/moto-import.jks`
   - Password: [kies sterk wachtwoord]
   - Key alias: `moto-import`
   - Key password: [kies sterk wachtwoord]
   - Validity: 25 years
   - Vul bedrijfsgegevens in

> ⚠️ **BELANGRIJK**: Bewaar de keystore file (.jks) en wachtwoorden veilig! 
> Als u deze verliest, kunt u de app NOOIT meer updaten.

### 3.3 Bouw de Release AAB
1. Na het aanmaken van de keystore, ga door met de wizard
2. Selecteer **release** als build variant
3. Klik op **Finish**
4. De AAB wordt gegenereerd in: `android/app/release/app-release.aab`

### 3.4 Google Play Console
1. Ga naar https://play.google.com/console
2. Klik op **Create app**
3. Vul app details in:
   - App naam: Moto Import
   - Default language: Nederlands
   - App type: App
   - Category: Business
4. Upload de AAB file bij **Production** → **Create new release**
5. Vul alle vereiste metadata in:
   - Titel
   - Korte beschrijving
   - Volledige beschrijving
   - Screenshots (min. 2)
   - Feature graphic (1024x500)
   - App icon (512x512)
6. Beantwoord de content rating questionnaire
7. Configureer pricing en beschikbaarheid
8. Dien in voor review

---

## Stap 4: Push Notifications Configureren

### Voor iOS
Push notifications werken al via de bestaande Web Push setup. Geen extra configuratie nodig.

### Voor Android (optioneel - Firebase)
Als u Firebase Cloud Messaging wilt gebruiken:

1. Maak een Firebase project aan op https://console.firebase.google.com
2. Voeg een Android app toe met package name: `nl.motoimport.app`
3. Download `google-services.json`
4. Plaats dit bestand in: `android/app/google-services.json`
5. Run `npx cap sync android`

---

## Handige NPM Scripts

| Command | Beschrijving |
|---------|-------------|
| `npm run build:mobile` | Bouw web + sync naar native |
| `npm run build:ios` | Bouw web + sync + open iOS |
| `npm run build:android` | Bouw web + sync + open Android |
| `npm run cap:sync` | Synchroniseer web assets naar native |
| `npm run cap:open:ios` | Open iOS project in Xcode |
| `npm run cap:open:android` | Open Android project in Studio |

---

## Checklist voor Publicatie

### iOS App Store
- [ ] Apple Developer Account ($99/jaar)
- [ ] App icons (1024x1024)
- [ ] Screenshots voor alle device sizes
- [ ] Privacy Policy URL
- [ ] Support URL
- [ ] App beschrijving (max 4000 tekens)
- [ ] Keywords voor zoeken

### Google Play Store
- [ ] Google Play Developer Account ($25 éénmalig)
- [ ] Signing keystore (.jks) veilig opgeslagen
- [ ] App icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (min. 2, max. 8)
- [ ] Korte beschrijving (max 80 tekens)
- [ ] Volledige beschrijving (max 4000 tekens)
- [ ] Content rating questionnaire ingevuld
- [ ] Privacy Policy URL

---

## Veelgestelde Vragen

### Hoe lang duurt de review?
- **iOS**: Meestal 24-48 uur, soms langer
- **Android**: Meestal enkele uren tot 1 dag

### Kan ik zonder Mac voor iOS bouwen?
Nee, Xcode is alleen beschikbaar op macOS. Alternatieven:
- Huur een Mac in de cloud (MacStadium, MacinCloud)
- Gebruik een build service (Codemagic, Bitrise)

### Wat als mijn app wordt afgewezen?
1. Lees de feedback van Apple/Google zorgvuldig
2. Los de genoemde problemen op
3. Maak een nieuwe build
4. Dien opnieuw in

### Hoe update ik de app?
1. Maak wijzigingen in de React code
2. Run `npm run build`
3. Run `npx cap sync`
4. Bouw een nieuwe release in Xcode/Android Studio
5. Upload naar App Store Connect / Google Play Console
6. Verhoog het versienummer!

---

## Contact

Voor vragen over de native app build, neem contact op via:
- Email: motoimportbv@gmail.com
- WhatsApp: +31 6 38525541
