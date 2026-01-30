# Moto Import - Native App Build Guide

## Overzicht
Deze guide beschrijft hoe u de Moto Import app kunt bouwen voor iOS (App Store) en Android (Google Play Store).

## Vereisten

### Voor iOS (Mac vereist!)
- macOS computer
- Xcode 14+ (gratis via Mac App Store)
- Apple Developer Account (€99/jaar) - https://developer.apple.com
- CocoaPods (`sudo gem install cocoapods`)

### Voor Android
- Android Studio (gratis) - https://developer.android.com/studio
- Google Play Developer Account (€25 eenmalig) - https://play.google.com/console
- Java JDK 11+

---

## Stap 1: Project Downloaden

Download het project via de Emergent "Download" knop of clone van GitHub.

```bash
cd frontend
npm install
```

---

## Stap 2: Build Web Assets

```bash
npm run build
npx cap sync
```

---

## Stap 3: iOS App Bouwen (Mac vereist)

### 3.1 Open in Xcode
```bash
npx cap open ios
```

### 3.2 Configureer Signing
1. Selecteer het project in Xcode (linker sidebar)
2. Ga naar "Signing & Capabilities"
3. Selecteer uw Team (Apple Developer Account)
4. Vul uw Bundle Identifier in: `nl.motoimport.app`

### 3.3 Push Notifications Configureren
1. Ga naar https://developer.apple.com/account
2. Maak een Push Notification Key aan (APNs)
3. Download de .p8 key file
4. Voeg "Push Notifications" capability toe in Xcode

### 3.4 App Icons Toevoegen
1. Open Assets.xcassets in Xcode
2. Sleep uw app icon (1024x1024 PNG) naar AppIcon
3. Xcode genereert automatisch alle formaten

### 3.5 Build voor App Store
1. Product > Archive
2. Distribute App > App Store Connect
3. Upload naar App Store Connect

### 3.6 Publiceren
1. Ga naar https://appstoreconnect.apple.com
2. Maak een nieuwe app aan
3. Vul alle metadata in (beschrijving, screenshots, etc.)
4. Submit voor review

---

## Stap 4: Android App Bouwen

### 4.1 Open in Android Studio
```bash
npx cap open android
```

### 4.2 Firebase Configureren (voor Push Notifications)
1. Ga naar https://console.firebase.google.com
2. Maak een nieuw project aan
3. Voeg een Android app toe met package name: `nl.motoimport.app`
4. Download `google-services.json`
5. Plaats in `android/app/google-services.json`

### 4.3 App Icons Toevoegen
1. Rechtermuisklik op `res` folder
2. New > Image Asset
3. Selecteer uw icon (1024x1024 PNG)
4. Android Studio genereert alle formaten

### 4.4 Signing Key Maken
```bash
keytool -genkey -v -keystore moto-import-release.keystore -alias moto-import -keyalg RSA -keysize 2048 -validity 10000
```

### 4.5 Build voor Play Store
1. Build > Generate Signed Bundle / APK
2. Kies "Android App Bundle"
3. Selecteer uw keystore
4. Build "release" variant

### 4.6 Publiceren
1. Ga naar https://play.google.com/console
2. Maak een nieuwe app aan
3. Upload de .aab file
4. Vul alle metadata in
5. Submit voor review

---

## Push Notifications Setup

### Firebase Cloud Messaging (FCM)
Beide platforms gebruiken Firebase voor push notifications.

1. Maak een Firebase project: https://console.firebase.google.com
2. Schakel Cloud Messaging in
3. Configureer voor beide platforms:
   - **Android**: Download `google-services.json`
   - **iOS**: Upload uw APNs key (.p8 file)

### Backend Configuratie
Voeg de Firebase Server Key toe aan uw backend `.env`:
```
FIREBASE_SERVER_KEY=your_firebase_server_key_here
```

---

## App Icon Specificaties

### iOS
- 1024x1024 PNG (geen transparantie, geen alpha)
- Vierkant, geen afgeronde hoeken (iOS doet dit automatisch)

### Android
- 512x512 PNG voor Play Store
- 1024x1024 PNG voor adaptieve icons
- Foreground en Background layers apart

---

## Screenshots voor App Stores

### iOS (vereist)
- iPhone 6.7" (1290 x 2796 px)
- iPhone 6.5" (1242 x 2688 px)
- iPad Pro 12.9" (2048 x 2732 px)

### Android (aanbevolen)
- Phone: 1080 x 1920 px (of hoger)
- 7" Tablet: 1200 x 1920 px
- 10" Tablet: 1920 x 1200 px

---

## Checklist voor Publicatie

### App Store (iOS)
- [ ] Apple Developer Account (€99/jaar)
- [ ] App icon 1024x1024
- [ ] Screenshots (alle formaten)
- [ ] App beschrijving (NL + EN)
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Age rating ingevuld
- [ ] Push notification capability

### Play Store (Android)
- [ ] Google Play Developer Account (€25)
- [ ] App icon 512x512
- [ ] Feature graphic 1024x500
- [ ] Screenshots (phone + tablet)
- [ ] Korte beschrijving (80 tekens)
- [ ] Volledige beschrijving
- [ ] Privacy policy URL
- [ ] Content rating vragenlijst
- [ ] Firebase configuratie

---

## Hulp Nodig?

Bij vragen over het publicatieproces:
- iOS: https://developer.apple.com/app-store/review/guidelines/
- Android: https://play.google.com/console/about/guides/releasewithconfidence/

---

## Updates Uitrollen

Na de eerste publicatie kunt u updates uitrollen:

```bash
# 1. Maak wijzigingen in de code
# 2. Bouw opnieuw
npm run build
npx cap sync

# 3. Verhoog versienummer in:
#    - package.json
#    - ios/App/App/Info.plist
#    - android/app/build.gradle

# 4. Bouw en upload naar stores
```

De review tijd is meestal:
- **iOS**: 1-3 dagen
- **Android**: Enkele uren tot 3 dagen
