import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Download, Globe, Smartphone, UserPlus, CheckCircle, ArrowRight, Monitor, Apple, Play } from 'lucide-react';

const SupplierGuide = () => {
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'nl');

  const languages = [
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' }
  ];

  const content = {
    nl: {
      tagline: "Kom bij het grootste motor netwerk van Nederland",
      title: "Leverancier Handleiding",
      subtitle: "Stap-voor-stap gids voor registratie en app installatie",
      intro: "Welkom bij Moto Import! Als buitenlandse leverancier kunt u eenvoudig uw motoren aanbieden aan ons uitgebreide dealernetwerk in Nederland. Volg deze handleiding om te starten.",
      section1Title: "Stap 1: Registreren als Leverancier",
      step1_1: "Ga naar de registratiepagina voor leveranciers",
      step1_2: "Vul uw bedrijfsgegevens in:",
      step1_2a: "Bedrijfsnaam",
      step1_2b: "Land (selecteer uit de lijst)",
      step1_2c: "Contactpersoon",
      step1_2d: "Telefoonnummer",
      step1_3: "Maak een account aan met uw e-mailadres en wachtwoord",
      step1_4: "Klik op 'Registreren als Leverancier'",
      step1_5: "Wacht op goedkeuring door Moto Import (u ontvangt een e-mail)",
      section2Title: "Stap 2: App Downloaden",
      section2Intro: "Na goedkeuring kunt u de app installeren voor eenvoudig beheer:",
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
      section3Title: "Stap 3: Motoren Toevoegen",
      step3_1: "Log in met uw account",
      step3_2: "Klik op 'Motor Toevoegen' in het menu",
      step3_3: "Vul de motorgegevens in (merk, model, jaar, prijs, etc.)",
      step3_4: "Upload foto's van de motor",
      step3_5: "Verzend ter goedkeuring",
      step3_6: "Moto Import controleert en activeert uw motor",
      contactTitle: "Contact",
      contactText: "Heeft u vragen? Neem contact met ons op:",
      regUrl: "Registratie URL:",
      printBtn: "Download als PDF"
    },
    de: {
      tagline: "Werden Sie Teil des größten Motorradnetzwerks der Niederlande",
      title: "Lieferanten Handbuch",
      subtitle: "Schritt-für-Schritt-Anleitung zur Registrierung und App-Installation",
      intro: "Willkommen bei Moto Import! Als ausländischer Lieferant können Sie Ihre Motorräder einfach unserem umfangreichen Händlernetzwerk in den Niederlanden anbieten. Folgen Sie dieser Anleitung, um zu starten.",
      section1Title: "Schritt 1: Als Lieferant registrieren",
      step1_1: "Gehen Sie zur Registrierungsseite für Lieferanten",
      step1_2: "Geben Sie Ihre Unternehmensdaten ein:",
      step1_2a: "Firmenname",
      step1_2b: "Land (aus der Liste auswählen)",
      step1_2c: "Kontaktperson",
      step1_2d: "Telefonnummer",
      step1_3: "Erstellen Sie ein Konto mit Ihrer E-Mail-Adresse und Passwort",
      step1_4: "Klicken Sie auf 'Als Lieferant registrieren'",
      step1_5: "Warten Sie auf die Genehmigung durch Moto Import (Sie erhalten eine E-Mail)",
      section2Title: "Schritt 2: App herunterladen",
      section2Intro: "Nach der Genehmigung können Sie die App für einfaches Management installieren:",
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
      section3Title: "Schritt 3: Motorräder hinzufügen",
      step3_1: "Melden Sie sich mit Ihrem Konto an",
      step3_2: "Klicken Sie im Menü auf 'Motorrad hinzufügen'",
      step3_3: "Geben Sie die Motorrad-Details ein (Marke, Modell, Jahr, Preis, etc.)",
      step3_4: "Laden Sie Fotos des Motorrads hoch",
      step3_5: "Zur Genehmigung einreichen",
      step3_6: "Moto Import prüft und aktiviert Ihr Motorrad",
      contactTitle: "Kontakt",
      contactText: "Haben Sie Fragen? Kontaktieren Sie uns:",
      regUrl: "Registrierungs-URL:",
      printBtn: "Als PDF herunterladen"
    },
    fr: {
      tagline: "Rejoignez le plus grand réseau moto des Pays-Bas",
      title: "Guide Fournisseur",
      subtitle: "Guide étape par étape pour l'inscription et l'installation de l'application",
      intro: "Bienvenue chez Moto Import ! En tant que fournisseur étranger, vous pouvez facilement proposer vos motos à notre vaste réseau de revendeurs aux Pays-Bas. Suivez ce guide pour commencer.",
      section1Title: "Étape 1 : S'inscrire comme fournisseur",
      step1_1: "Accédez à la page d'inscription pour les fournisseurs",
      step1_2: "Remplissez vos informations d'entreprise :",
      step1_2a: "Nom de l'entreprise",
      step1_2b: "Pays (sélectionnez dans la liste)",
      step1_2c: "Personne de contact",
      step1_2d: "Numéro de téléphone",
      step1_3: "Créez un compte avec votre adresse e-mail et mot de passe",
      step1_4: "Cliquez sur 'S'inscrire comme fournisseur'",
      step1_5: "Attendez l'approbation de Moto Import (vous recevrez un e-mail)",
      section2Title: "Étape 2 : Télécharger l'application",
      section2Intro: "Après approbation, vous pouvez installer l'application pour une gestion facile :",
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
      section3Title: "Étape 3 : Ajouter des motos",
      step3_1: "Connectez-vous avec votre compte",
      step3_2: "Cliquez sur 'Ajouter une moto' dans le menu",
      step3_3: "Entrez les détails de la moto (marque, modèle, année, prix, etc.)",
      step3_4: "Téléchargez des photos de la moto",
      step3_5: "Soumettez pour approbation",
      step3_6: "Moto Import vérifie et active votre moto",
      contactTitle: "Contact",
      contactText: "Vous avez des questions ? Contactez-nous :",
      regUrl: "URL d'inscription :",
      printBtn: "Télécharger en PDF"
    },
    it: {
      tagline: "Unisciti alla più grande rete di moto dei Paesi Bassi",
      title: "Guida Fornitore",
      subtitle: "Guida passo-passo per la registrazione e l'installazione dell'app",
      intro: "Benvenuto in Moto Import! Come fornitore estero, puoi facilmente offrire le tue moto alla nostra vasta rete di rivenditori nei Paesi Bassi. Segui questa guida per iniziare.",
      section1Title: "Passo 1: Registrarsi come fornitore",
      step1_1: "Vai alla pagina di registrazione per i fornitori",
      step1_2: "Inserisci i dati della tua azienda:",
      step1_2a: "Nome azienda",
      step1_2b: "Paese (seleziona dalla lista)",
      step1_2c: "Persona di contatto",
      step1_2d: "Numero di telefono",
      step1_3: "Crea un account con il tuo indirizzo email e password",
      step1_4: "Clicca su 'Registrati come fornitore'",
      step1_5: "Attendi l'approvazione da Moto Import (riceverai un'email)",
      section2Title: "Passo 2: Scaricare l'app",
      section2Intro: "Dopo l'approvazione, puoi installare l'app per una gestione facile:",
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
      section3Title: "Passo 3: Aggiungere moto",
      step3_1: "Accedi con il tuo account",
      step3_2: "Clicca su 'Aggiungi moto' nel menu",
      step3_3: "Inserisci i dettagli della moto (marca, modello, anno, prezzo, ecc.)",
      step3_4: "Carica foto della moto",
      step3_5: "Invia per approvazione",
      step3_6: "Moto Import verifica e attiva la tua moto",
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
            <Globe className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-zinc-600">Select language:</span>
          </div>
          <div className="flex gap-2">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => setCurrentLang(lang.code)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentLang === lang.code
                    ? 'bg-purple-600 text-white'
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
              <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-2">MOTO IMPORT B.V.</h1>
          <p className="text-xl text-purple-600 font-semibold mb-4">{c.tagline}</p>
          <h2 className="text-2xl font-bold text-zinc-800 mb-2">{c.title}</h2>
          <p className="text-zinc-600">{c.subtitle}</p>
        </div>

        {/* Introduction */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-8">
          <p className="text-zinc-700 leading-relaxed">{c.intro}</p>
        </div>

        {/* Step 1: Registration */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
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

            <div className="mt-4 p-4 bg-white rounded-lg border-2 border-purple-300">
              <p className="text-sm font-medium text-zinc-600 mb-1">{c.regUrl}</p>
              <p className="text-purple-600 font-mono font-bold break-all">{baseUrl}/register/supplier</p>
            </div>
          </div>
        </section>

        {/* Step 2: App Download */}
        <section className="mb-10 print-break">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
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
                <li className="flex gap-2"><span className="font-bold text-purple-600">1.</span> {c.iosStep1}</li>
                <li className="flex gap-2"><span className="font-bold text-purple-600">2.</span> {c.iosStep2}</li>
                <li className="flex gap-2"><span className="font-bold text-purple-600">3.</span> {c.iosStep3}</li>
                <li className="flex gap-2"><span className="font-bold text-purple-600">4.</span> {c.iosStep4}</li>
              </ol>
            </div>

            {/* Android */}
            <div className="bg-zinc-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Play className="w-6 h-6 text-green-600" />
                <h4 className="font-bold text-zinc-900">{c.androidTitle}</h4>
              </div>
              <ol className="space-y-2 text-sm text-zinc-600">
                <li className="flex gap-2"><span className="font-bold text-purple-600">1.</span> {c.androidStep1}</li>
                <li className="flex gap-2"><span className="font-bold text-purple-600">2.</span> {c.androidStep2}</li>
                <li className="flex gap-2"><span className="font-bold text-purple-600">3.</span> {c.androidStep3}</li>
                <li className="flex gap-2"><span className="font-bold text-purple-600">4.</span> {c.androidStep4}</li>
              </ol>
            </div>

            {/* Desktop */}
            <div className="bg-zinc-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-6 h-6 text-blue-600" />
                <h4 className="font-bold text-zinc-900">{c.desktopTitle}</h4>
              </div>
              <ol className="space-y-2 text-sm text-zinc-600">
                <li className="flex gap-2"><span className="font-bold text-purple-600">1.</span> {c.desktopStep1}</li>
                <li className="flex gap-2"><span className="font-bold text-purple-600">2.</span> {c.desktopStep2}</li>
                <li className="flex gap-2"><span className="font-bold text-purple-600">3.</span> {c.desktopStep3}</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Step 3: Add Motorcycles */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
            <h3 className="text-xl font-bold text-zinc-900">{c.section3Title}</h3>
          </div>
          
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
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step3_5}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-700">{c.step3_6}</p>
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
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
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

export default SupplierGuide;
