import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Download, Globe, Smartphone, UserPlus, CheckCircle, Monitor, Apple, Play, Store } from 'lucide-react';

const DealerGuide = () => {
  const [currentLang, setCurrentLang] = useState('nl');

  const languages = [
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' }
  ];

  const content = {
    nl: {
      tagline: "Kom bij het grootste motor netwerk van Nederland",
      title: "Dealer Installatiehandleiding",
      subtitle: "Stap-voor-stap gids voor registratie en app installatie",
      intro: "Welkom bij Moto Import! Als dealer krijgt u toegang tot ons uitgebreide aanbod van motoren tegen aantrekkelijke prijzen. Volg deze handleiding om te starten.",
      section1Title: "Stap 1: Registreren als Dealer",
      step1_1: "Ga naar de registratiepagina",
      step1_2: "Vul uw bedrijfsgegevens in:",
      step1_2a: "Bedrijfsnaam",
      step1_2b: "KVK-nummer",
      step1_2c: "Adres, postcode en plaats",
      step1_2d: "Contactpersoon",
      step1_2e: "Telefoonnummer",
      step1_3: "Maak een account aan met uw e-mailadres en wachtwoord",
      step1_4: "Accepteer de Algemene Voorwaarden",
      step1_5: "Klik op 'Account Aanmaken'",
      step1_6: "Wacht op goedkeuring door Moto Import (u ontvangt een e-mail)",
      section2Title: "Stap 2: App Installeren",
      section2Intro: "Na goedkeuring kunt u de app installeren voor snelle toegang tot nieuwe motoren:",
      iosTitle: "Voor iPhone/iPad:",
      iosStep1: "Open Safari en ga naar onze website",
      iosStep2: "Tik op het 'Delen' icoon (vierkant met pijl omhoog)",
      iosStep3: "Scroll naar beneden en tik op 'Zet op beginscherm'",
      iosStep4: "Tik op 'Voeg toe'",
      androidTitle: "Voor Android:",
      androidStep1: "Open Chrome en ga naar onze website",
      androidStep2: "Tik op de drie puntjes (menu) rechtsboven",
      androidStep3: "Tik op 'App installeren' of 'Toevoegen aan startscherm'",
      androidStep4: "Bevestig de installatie",
      desktopTitle: "Voor Desktop:",
      desktopStep1: "Open Chrome of Edge en ga naar onze website",
      desktopStep2: "Klik op het installatie-icoon in de adresbalk",
      desktopStep3: "Klik op 'Installeren'",
      section3Title: "Stap 3: Meldingen Inschakelen",
      step3Intro: "Ontvang direct een melding als er nieuwe motoren beschikbaar zijn:",
      step3_1: "Log in op uw account",
      step3_2: "Klik op 'Push Notificaties' → 'Inschakelen'",
      step3_3: "Geef toestemming in uw browser",
      step3_4: "U ontvangt nu meldingen bij nieuwe motoren!",
      section4Title: "Stap 4: Motoren Bestellen",
      step4_1: "Bekijk het motoraanbod via 'Motoren'",
      step4_2: "Klik op een motor voor details",
      step4_3: "Klik op 'Direct Kopen'",
      step4_4: "Kies eventueel bezorging, keuring of taxatie",
      step4_5: "Bevestig uw bestelling",
      step4_6: "U ontvangt een pakbon per e-mail",
      featuresTitle: "Voordelen voor Dealers",
      feature1: "Direct toegang tot nieuwe motoren",
      feature2: "Push meldingen bij nieuw aanbod",
      feature3: "Optionele bezorging aan huis (€50)",
      feature4: "Professionele keuring mogelijk (€125)",
      feature5: "Taxatie service beschikbaar (€160 excl. BTW)",
      feature6: "Zelf motoren aanbieden aan andere dealers",
      contactTitle: "Contact",
      contactText: "Heeft u vragen? Neem contact met ons op:",
      regUrl: "Registratie URL:",
      printBtn: "Download als PDF"
    },
    de: {
      tagline: "Werden Sie Teil des größten Motorradnetzwerks der Niederlande",
      title: "Händler Installationsanleitung",
      subtitle: "Schritt-für-Schritt-Anleitung zur Registrierung und App-Installation",
      intro: "Willkommen bei Moto Import! Als Händler erhalten Sie Zugang zu unserem umfangreichen Motorradangebot zu attraktiven Preisen. Folgen Sie dieser Anleitung, um zu starten.",
      section1Title: "Schritt 1: Als Händler registrieren",
      step1_1: "Gehen Sie zur Registrierungsseite",
      step1_2: "Geben Sie Ihre Unternehmensdaten ein:",
      step1_2a: "Firmenname",
      step1_2b: "Handelsregisternummer",
      step1_2c: "Adresse, Postleitzahl und Ort",
      step1_2d: "Kontaktperson",
      step1_2e: "Telefonnummer",
      step1_3: "Erstellen Sie ein Konto mit Ihrer E-Mail-Adresse und Passwort",
      step1_4: "Akzeptieren Sie die Allgemeinen Geschäftsbedingungen",
      step1_5: "Klicken Sie auf 'Konto erstellen'",
      step1_6: "Warten Sie auf die Genehmigung durch Moto Import (Sie erhalten eine E-Mail)",
      section2Title: "Schritt 2: App installieren",
      section2Intro: "Nach der Genehmigung können Sie die App für schnellen Zugriff auf neue Motorräder installieren:",
      iosTitle: "Für iPhone/iPad:",
      iosStep1: "Öffnen Sie Safari und gehen Sie zu unserer Website",
      iosStep2: "Tippen Sie auf das 'Teilen'-Symbol (Quadrat mit Pfeil nach oben)",
      iosStep3: "Scrollen Sie nach unten und tippen Sie auf 'Zum Home-Bildschirm'",
      iosStep4: "Tippen Sie auf 'Hinzufügen'",
      androidTitle: "Für Android:",
      androidStep1: "Öffnen Sie Chrome und gehen Sie zu unserer Website",
      androidStep2: "Tippen Sie auf die drei Punkte (Menü) oben rechts",
      androidStep3: "Tippen Sie auf 'App installieren' oder 'Zum Startbildschirm hinzufügen'",
      androidStep4: "Bestätigen Sie die Installation",
      desktopTitle: "Für Desktop:",
      desktopStep1: "Öffnen Sie Chrome oder Edge und gehen Sie zu unserer Website",
      desktopStep2: "Klicken Sie auf das Installations-Symbol in der Adressleiste",
      desktopStep3: "Klicken Sie auf 'Installieren'",
      section3Title: "Schritt 3: Benachrichtigungen aktivieren",
      step3Intro: "Erhalten Sie sofort eine Benachrichtigung, wenn neue Motorräder verfügbar sind:",
      step3_1: "Melden Sie sich bei Ihrem Konto an",
      step3_2: "Klicken Sie auf 'Push-Benachrichtigungen' → 'Aktivieren'",
      step3_3: "Erteilen Sie die Berechtigung in Ihrem Browser",
      step3_4: "Sie erhalten jetzt Benachrichtigungen bei neuen Motorrädern!",
      section4Title: "Schritt 4: Motorräder bestellen",
      step4_1: "Sehen Sie das Motorradangebot unter 'Motorräder'",
      step4_2: "Klicken Sie auf ein Motorrad für Details",
      step4_3: "Klicken Sie auf 'Direkt kaufen'",
      step4_4: "Wählen Sie ggf. Lieferung, Inspektion oder Bewertung",
      step4_5: "Bestätigen Sie Ihre Bestellung",
      step4_6: "Sie erhalten einen Lieferschein per E-Mail",
      featuresTitle: "Vorteile für Händler",
      feature1: "Direkter Zugang zu neuen Motorrädern",
      feature2: "Push-Benachrichtigungen bei neuem Angebot",
      feature3: "Optionale Lieferung nach Hause (€50)",
      feature4: "Professionelle Inspektion möglich (€125)",
      feature5: "Bewertungsservice verfügbar (€160 zzgl. MwSt.)",
      feature6: "Selbst Motorräder anderen Händlern anbieten",
      contactTitle: "Kontakt",
      contactText: "Haben Sie Fragen? Kontaktieren Sie uns:",
      regUrl: "Registrierungs-URL:",
      printBtn: "Als PDF herunterladen"
    },
    fr: {
      tagline: "Rejoignez le plus grand réseau moto des Pays-Bas",
      title: "Guide d'installation Revendeur",
      subtitle: "Guide étape par étape pour l'inscription et l'installation de l'application",
      intro: "Bienvenue chez Moto Import ! En tant que revendeur, vous avez accès à notre large gamme de motos à des prix attractifs. Suivez ce guide pour commencer.",
      section1Title: "Étape 1 : S'inscrire comme revendeur",
      step1_1: "Accédez à la page d'inscription",
      step1_2: "Remplissez vos informations d'entreprise :",
      step1_2a: "Nom de l'entreprise",
      step1_2b: "Numéro SIRET",
      step1_2c: "Adresse, code postal et ville",
      step1_2d: "Personne de contact",
      step1_2e: "Numéro de téléphone",
      step1_3: "Créez un compte avec votre adresse e-mail et mot de passe",
      step1_4: "Acceptez les Conditions Générales",
      step1_5: "Cliquez sur 'Créer un compte'",
      step1_6: "Attendez l'approbation de Moto Import (vous recevrez un e-mail)",
      section2Title: "Étape 2 : Installer l'application",
      section2Intro: "Après approbation, vous pouvez installer l'application pour un accès rapide aux nouvelles motos :",
      iosTitle: "Pour iPhone/iPad :",
      iosStep1: "Ouvrez Safari et accédez à notre site web",
      iosStep2: "Appuyez sur l'icône 'Partager' (carré avec flèche vers le haut)",
      iosStep3: "Faites défiler vers le bas et appuyez sur 'Sur l'écran d'accueil'",
      iosStep4: "Appuyez sur 'Ajouter'",
      androidTitle: "Pour Android :",
      androidStep1: "Ouvrez Chrome et accédez à notre site web",
      androidStep2: "Appuyez sur les trois points (menu) en haut à droite",
      androidStep3: "Appuyez sur 'Installer l'application' ou 'Ajouter à l'écran d'accueil'",
      androidStep4: "Confirmez l'installation",
      desktopTitle: "Pour ordinateur :",
      desktopStep1: "Ouvrez Chrome ou Edge et accédez à notre site web",
      desktopStep2: "Cliquez sur l'icône d'installation dans la barre d'adresse",
      desktopStep3: "Cliquez sur 'Installer'",
      section3Title: "Étape 3 : Activer les notifications",
      step3Intro: "Recevez une notification dès que de nouvelles motos sont disponibles :",
      step3_1: "Connectez-vous à votre compte",
      step3_2: "Cliquez sur 'Notifications Push' → 'Activer'",
      step3_3: "Autorisez dans votre navigateur",
      step3_4: "Vous recevez maintenant des notifications pour les nouvelles motos !",
      section4Title: "Étape 4 : Commander des motos",
      step4_1: "Consultez l'offre de motos via 'Motos'",
      step4_2: "Cliquez sur une moto pour les détails",
      step4_3: "Cliquez sur 'Acheter maintenant'",
      step4_4: "Choisissez éventuellement livraison, contrôle ou expertise",
      step4_5: "Confirmez votre commande",
      step4_6: "Vous recevrez un bon de livraison par e-mail",
      featuresTitle: "Avantages pour les revendeurs",
      feature1: "Accès direct aux nouvelles motos",
      feature2: "Notifications push pour les nouvelles offres",
      feature3: "Livraison à domicile optionnelle (€50)",
      feature4: "Contrôle professionnel possible (€125)",
      feature5: "Service d'expertise disponible (€160 HT)",
      feature6: "Proposer vos propres motos à d'autres revendeurs",
      contactTitle: "Contact",
      contactText: "Vous avez des questions ? Contactez-nous :",
      regUrl: "URL d'inscription :",
      printBtn: "Télécharger en PDF"
    },
    it: {
      tagline: "Unisciti alla più grande rete di moto dei Paesi Bassi",
      title: "Guida Installazione Rivenditore",
      subtitle: "Guida passo-passo per la registrazione e l'installazione dell'app",
      intro: "Benvenuto in Moto Import! Come rivenditore, hai accesso alla nostra ampia gamma di moto a prezzi interessanti. Segui questa guida per iniziare.",
      section1Title: "Passo 1: Registrarsi come rivenditore",
      step1_1: "Vai alla pagina di registrazione",
      step1_2: "Inserisci i dati della tua azienda:",
      step1_2a: "Nome azienda",
      step1_2b: "Partita IVA",
      step1_2c: "Indirizzo, CAP e città",
      step1_2d: "Persona di contatto",
      step1_2e: "Numero di telefono",
      step1_3: "Crea un account con il tuo indirizzo email e password",
      step1_4: "Accetta i Termini e Condizioni",
      step1_5: "Clicca su 'Crea account'",
      step1_6: "Attendi l'approvazione da Moto Import (riceverai un'email)",
      section2Title: "Passo 2: Installare l'app",
      section2Intro: "Dopo l'approvazione, puoi installare l'app per un accesso rapido alle nuove moto:",
      iosTitle: "Per iPhone/iPad:",
      iosStep1: "Apri Safari e vai al nostro sito web",
      iosStep2: "Tocca l'icona 'Condividi' (quadrato con freccia verso l'alto)",
      iosStep3: "Scorri verso il basso e tocca 'Aggiungi alla schermata Home'",
      iosStep4: "Tocca 'Aggiungi'",
      androidTitle: "Per Android:",
      androidStep1: "Apri Chrome e vai al nostro sito web",
      androidStep2: "Tocca i tre puntini (menu) in alto a destra",
      androidStep3: "Tocca 'Installa app' o 'Aggiungi alla schermata Home'",
      androidStep4: "Conferma l'installazione",
      desktopTitle: "Per Desktop:",
      desktopStep1: "Apri Chrome o Edge e vai al nostro sito web",
      desktopStep2: "Clicca sull'icona di installazione nella barra degli indirizzi",
      desktopStep3: "Clicca su 'Installa'",
      section3Title: "Passo 3: Attivare le notifiche",
      step3Intro: "Ricevi una notifica quando sono disponibili nuove moto:",
      step3_1: "Accedi al tuo account",
      step3_2: "Clicca su 'Notifiche Push' → 'Attiva'",
      step3_3: "Autorizza nel tuo browser",
      step3_4: "Ora riceverai notifiche per le nuove moto!",
      section4Title: "Passo 4: Ordinare moto",
      step4_1: "Consulta l'offerta di moto tramite 'Moto'",
      step4_2: "Clicca su una moto per i dettagli",
      step4_3: "Clicca su 'Acquista ora'",
      step4_4: "Scegli eventualmente consegna, ispezione o valutazione",
      step4_5: "Conferma il tuo ordine",
      step4_6: "Riceverai una bolla di consegna via email",
      featuresTitle: "Vantaggi per i rivenditori",
      feature1: "Accesso diretto alle nuove moto",
      feature2: "Notifiche push per nuove offerte",
      feature3: "Consegna a domicilio opzionale (€50)",
      feature4: "Ispezione professionale possibile (€125)",
      feature5: "Servizio di valutazione disponibile (€160 IVA esclusa)",
      feature6: "Proponi le tue moto ad altri rivenditori",
      contactTitle: "Contatti",
      contactText: "Hai domande? Contattaci:",
      regUrl: "URL di registrazione:",
      printBtn: "Scarica come PDF"
    }
  };

  const c = content[currentLang] || content.nl;

  const handlePrint = () => {
    window.print();
  };

  const baseUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-white">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Language selector - hidden on print */}
      <div className="no-print bg-zinc-100 border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-zinc-600">Select language:</span>
          </div>
          <div className="flex gap-2">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => setCurrentLang(lang.code)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentLang === lang.code
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {lang.flag} {lang.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center">
              <Store className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-2">MOTO IMPORT B.V.</h1>
          <p className="text-xl text-red-600 font-semibold mb-4">{c.tagline}</p>
          <h2 className="text-2xl font-bold text-zinc-800 mb-2">{c.title}</h2>
          <p className="text-zinc-600">{c.subtitle}</p>
        </div>

        {/* Introduction */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
          <p className="text-zinc-700 leading-relaxed">{c.intro}</p>
        </div>

        {/* Step 1: Registration */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
            <h3 className="text-xl font-bold text-zinc-900">{c.section1Title}</h3>
          </div>
          
          <div className="bg-zinc-50 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step1_1}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-zinc-700 mb-2">{c.step1_2}</p>
                <ul className="ml-4 space-y-1 text-zinc-600">
                  <li>• {c.step1_2a}</li>
                  <li>• {c.step1_2b}</li>
                  <li>• {c.step1_2c}</li>
                  <li>• {c.step1_2d}</li>
                  <li>• {c.step1_2e}</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step1_3}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step1_4}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step1_5}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step1_6}</p>
            </div>

            <div className="mt-4 p-4 bg-white rounded-lg border-2 border-red-300">
              <p className="text-sm font-medium text-zinc-600 mb-1">{c.regUrl}</p>
              <p className="text-red-600 font-mono font-bold break-all">{baseUrl}/register</p>
            </div>
          </div>
        </section>

        {/* Step 2: App Download */}
        <section className="mb-10 print-break">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
            <h3 className="text-xl font-bold text-zinc-900">{c.section2Title}</h3>
          </div>
          
          <p className="text-zinc-600 mb-6">{c.section2Intro}</p>

          <div className="grid md:grid-cols-3 gap-4">
            {/* iOS */}
            <div className="bg-zinc-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Apple className="w-6 h-6 text-zinc-800" />
                <h4 className="font-bold text-zinc-900">{c.iosTitle}</h4>
              </div>
              <ol className="space-y-2 text-sm text-zinc-600">
                <li className="flex gap-2"><span className="font-bold text-red-600">1.</span> {c.iosStep1}</li>
                <li className="flex gap-2"><span className="font-bold text-red-600">2.</span> {c.iosStep2}</li>
                <li className="flex gap-2"><span className="font-bold text-red-600">3.</span> {c.iosStep3}</li>
                <li className="flex gap-2"><span className="font-bold text-red-600">4.</span> {c.iosStep4}</li>
              </ol>
            </div>

            {/* Android */}
            <div className="bg-zinc-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Play className="w-6 h-6 text-green-600" />
                <h4 className="font-bold text-zinc-900">{c.androidTitle}</h4>
              </div>
              <ol className="space-y-2 text-sm text-zinc-600">
                <li className="flex gap-2"><span className="font-bold text-red-600">1.</span> {c.androidStep1}</li>
                <li className="flex gap-2"><span className="font-bold text-red-600">2.</span> {c.androidStep2}</li>
                <li className="flex gap-2"><span className="font-bold text-red-600">3.</span> {c.androidStep3}</li>
                <li className="flex gap-2"><span className="font-bold text-red-600">4.</span> {c.androidStep4}</li>
              </ol>
            </div>

            {/* Desktop */}
            <div className="bg-zinc-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-6 h-6 text-blue-600" />
                <h4 className="font-bold text-zinc-900">{c.desktopTitle}</h4>
              </div>
              <ol className="space-y-2 text-sm text-zinc-600">
                <li className="flex gap-2"><span className="font-bold text-red-600">1.</span> {c.desktopStep1}</li>
                <li className="flex gap-2"><span className="font-bold text-red-600">2.</span> {c.desktopStep2}</li>
                <li className="flex gap-2"><span className="font-bold text-red-600">3.</span> {c.desktopStep3}</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Step 3: Enable Notifications */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
            <h3 className="text-xl font-bold text-zinc-900">{c.section3Title}</h3>
          </div>
          
          <p className="text-zinc-600 mb-4">{c.step3Intro}</p>
          
          <div className="bg-zinc-50 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step3_1}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step3_2}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step3_3}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step3_4}</p>
            </div>
          </div>
        </section>

        {/* Step 4: Ordering */}
        <section className="mb-10 print-break">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">4</div>
            <h3 className="text-xl font-bold text-zinc-900">{c.section4Title}</h3>
          </div>
          
          <div className="bg-zinc-50 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step4_1}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step4_2}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step4_3}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step4_4}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step4_5}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step4_6}</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mb-10">
          <h3 className="text-xl font-bold text-zinc-900 mb-4">{c.featuresTitle}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-zinc-700">{c.feature1}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-zinc-700">{c.feature2}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-zinc-700">{c.feature3}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-zinc-700">{c.feature4}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-zinc-700">{c.feature5}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-zinc-700">{c.feature6}</span>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-10">
          <h3 className="text-xl font-bold text-zinc-900 mb-4">{c.contactTitle}</h3>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-zinc-700 mb-4">{c.contactText}</p>
            <div className="space-y-2 text-zinc-800">
              <p><strong>Moto Import B.V.</strong></p>
              <p>Horstenhoekweg 11</p>
              <p>7433 SV Schalkhaar</p>
              <p>Tel: +31 6 38525541</p>
              <p>Email: motoimportbv@gmail.com</p>
            </div>
          </div>
        </section>

        {/* Print button */}
        <div className="no-print text-center">
          <Button 
            onClick={handlePrint}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
            data-testid="download-pdf-btn"
          >
            <Download className="w-5 h-5 mr-2" />
            {c.printBtn}
          </Button>
          <p className="text-sm text-zinc-500 mt-3">
            Tip: Use Ctrl+P (Windows) or Cmd+P (Mac) and select "Save as PDF"
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t text-center text-zinc-500 text-sm">
          <p>© {new Date().getFullYear()} Moto Import B.V. - {c.tagline}</p>
        </footer>
      </div>
    </div>
  );
};

export default DealerGuide;
