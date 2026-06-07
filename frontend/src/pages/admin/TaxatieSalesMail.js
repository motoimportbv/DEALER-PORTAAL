import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Copy, Check, FileText, Mail, Eye, FileCode, Type, Send, Loader2, History, AlertCircle, CheckCircle2, Globe } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SUBJECT = "BPM-taxatieverslag voor uw motorzaak — €60 intro + binnen 48u in uw mailbox";

const PLAIN_TEXT = `Beste collega,

Geen gedoe meer met BPM-papierwerk.

Wij zijn Moto Import B.V. — gespecialiseerd in officiële BPM-taxatieverslagen voor motorfietsen. Belastingdienst-proof, scherp geprijsd, snel geleverd.

WAAROM ANDERE MOTORZAKEN VOOR ONS KIEZEN:
• 100% gespecialiseerd in motoren — geen auto's, geen omwegen
• Belastingdienst-proof rapporten volgens RDW-richtlijnen
• Binnen 48 uur het verslag + BPM-berekening in uw mailbox
• Eigen dealer-dashboard waar u alle aanvragen + status terugziet
• Direct toegang — geen wachten op goedkeuring

ONZE TARIEVEN:
• Introductietarief: €60 ex BTW voor uw eerste taxatieverslag
• Daarna vaste prijs: €120 ex BTW per verslag
• Verzendkosten en uitprinten: €20 ex BTW (totaal)
• Geen abonnement, geen verrassingen

ZO WERKT HET:
1. Maak een gratis dealer-account aan op motoimportbv.nl/taxatie-dealer/register
2. Upload de 9 vereiste foto's + voertuiggegevens
3. Wij sturen u binnen 48 uur het officiële taxatieverslag

PROBEER HET RISICOLOOS:
Profiteer nu van het introductietarief van €60 ex BTW.
> Account aanmaken: https://www.motoimportbv.nl/taxatie-dealer/register

LIEVER EERST EVEN BELLEN?
Sandro is direct bereikbaar op:
> Tel: 06-24264861
> WhatsApp: 06-24264861
> Mail: motoimportbv@gmail.com

Zie de bijgevoegde flyer voor alle details.

Met vriendelijke groet,

Team Moto Import B.V.
Horsterhoekweg 11, 7433 SV Schalkhaar
KVK 94622086
www.motoimportbv.nl
`;

const HTML_BODY = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fafafa; color: #18181b;">

  <!-- Hero -->
  <div style="background: linear-gradient(135deg, #18181b 0%, #7f1d1d 100%); color: white; padding: 36px 28px;">
    <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #fca5a5; text-transform: uppercase;">Voor motorzaken in Nederland</p>
    <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 900; line-height: 1.1;">Geen gedoe meer met BPM-papierwerk.</h1>
    <p style="margin: 0; color: #fecaca; font-size: 15px;">Officieel BPM-taxatieverslag — binnen 48 uur in uw mailbox.</p>
  </div>

  <!-- Body -->
  <div style="background: white; padding: 28px;">
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Beste collega,</p>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Wij zijn <strong>Moto Import B.V.</strong> — 100% gespecialiseerd in officiële BPM-taxatieverslagen voor motorfietsen. Belastingdienst-proof, scherp geprijsd, snel geleverd.
    </p>

    <!-- Aanbieding box -->
    <div style="margin: 24px 0; padding: 20px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 6px;">
      <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 1px;">Introductietarief</p>
      <p style="margin: 0; font-size: 32px; font-weight: 900; color: #18181b; line-height: 1;">€60 <span style="font-size: 14px; color: #71717a; font-weight: 600;">ex BTW · eerste taxatie</span></p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #525252;">Daarna vaste prijs: €120 ex BTW · verzendkosten + uitprinten €20 ex BTW</p>
    </div>

    <!-- USPs -->
    <h3 style="margin: 24px 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #18181b;">Waarom motorzaken voor ons kiezen</h3>
    <ul style="margin: 0 0 24px; padding-left: 18px; font-size: 14px; line-height: 1.8; color: #3f3f46;">
      <li>100% gespecialiseerd in motoren — geen auto's, geen omwegen</li>
      <li>Belastingdienst-proof rapporten volgens RDW-richtlijnen</li>
      <li>Binnen 48 uur het verslag + BPM-berekening in uw mailbox</li>
      <li>Eigen dealer-dashboard — al uw aanvragen + status op één plek</li>
      <li>Direct toegang na registratie, geen wachten op goedkeuring</li>
    </ul>

    <!-- Stappen -->
    <h3 style="margin: 24px 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #18181b;">Zo werkt het in 3 stappen</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
      <tr>
        <td style="vertical-align: top; width: 30%; padding: 8px 12px 8px 0;">
          <span style="display: inline-block; font-size: 22px; font-weight: 900; color: #dc2626;">01</span>
          <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700;">Aanmelden</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #71717a; line-height: 1.4;">Gratis dealer-account aanmaken</p>
        </td>
        <td style="vertical-align: top; width: 30%; padding: 8px 12px;">
          <span style="display: inline-block; font-size: 22px; font-weight: 900; color: #dc2626;">02</span>
          <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700;">Upload foto's</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #71717a; line-height: 1.4;">9 foto's + voertuiggegevens via formulier</p>
        </td>
        <td style="vertical-align: top; width: 30%; padding: 8px 0 8px 12px;">
          <span style="display: inline-block; font-size: 22px; font-weight: 900; color: #dc2626;">03</span>
          <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700;">PDF in mailbox</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #71717a; line-height: 1.4;">Binnen 48 uur ondertekend verslag</p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="https://www.motoimportbv.nl/taxatie-dealer/register" style="display: inline-block; background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
        Gratis account aanmaken →
      </a>
      <p style="margin: 8px 0 0; font-size: 12px; color: #71717a;">geen creditcard nodig · direct toegang</p>
    </div>

    <!-- Contact -->
    <div style="margin: 32px 0 0; padding: 18px; background: #18181b; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #fafafa;">Liever eerst even bellen of WhatsAppen?</p>
      <p style="margin: 0; font-size: 16px; font-weight: 700;">
        <a href="tel:+31624264861" style="color: #fca5a5; text-decoration: none; margin: 0 12px;">📞 06-24264861</a>
        <a href="https://wa.me/31624264861" style="color: #fca5a5; text-decoration: none; margin: 0 12px;">💬 WhatsApp</a>
      </p>
    </div>

    <p style="margin: 28px 0 4px; font-size: 13px; color: #525252;">
      📎 Zie de bijgevoegde flyer voor alle details.
    </p>
  </div>

  <!-- Signature -->
  <div style="background: white; padding: 16px 28px 28px; font-size: 13px; color: #3f3f46;">
    <p style="margin: 16px 0 4px;">Met vriendelijke groet,</p>
    <p style="margin: 0 0 4px; font-weight: 700; color: #18181b;">Team Moto Import B.V.</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">KVK 94622086 · <a href="https://www.motoimportbv.nl" style="color: #dc2626;">www.motoimportbv.nl</a></p>
  </div>
</div>`;

const SUPPLIER_NL_SUBJECT = "Verkoop uw motoren aan 100+ Nederlandse dealers — Moto Import B.V.";

const SUPPLIER_NL_PLAIN = `Beste collega,

Ik ben Sandro van Moto Import B.V. — wij zijn op zoek naar gespecialiseerde motorzaken in Vlaanderen en Nederland die hun voorraad willen verkopen aan ons NL-dealernetwerk.

WAT WIJ AANBIEDEN:
• Platform met 100+ Nederlandse motorzaken — ze zien uw motoren direct
• 100% gratis — geen abonnement, geen commissie. U bepaalt de prijs voor Moto Import B.V.
• Uitbetaling binnen 1 week per overschrijving
• Wij komen de motor bij u ophalen
• Moto Import B.V. regelt alles: RDW, BPM, tenaamstelling en transport
• Geen Nederlandse btw of import-papieren voor u nodig

ZO WERKT HET:
1. Gratis aanmelden: https://www.motoimportbv.nl/register/supplier?lang=nl
2. Upload uw motoren met prijs voor Moto Import B.V.
3. Wij halen ze op en betalen u uit binnen 1 week

LIEVER EERST EVEN OVERLEGGEN?
> Tel: 06-24264861
> WhatsApp: 06-24264861
> Mail: motoimportbv@gmail.com

Met vriendelijke groet,
Team Moto Import B.V.
Horsterhoekweg 11, 7433 SV Schalkhaar
KVK 94622086
www.motoimportbv.nl
`;

const SUPPLIER_NL_HTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fafafa; color: #18181b;">
  <div style="background: linear-gradient(135deg, #18181b 0%, #581c87 100%); color: white; padding: 36px 28px;">
    <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #c4b5fd; text-transform: uppercase;">Voor motorzaken in Vlaanderen &amp; NL</p>
    <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 900; line-height: 1.1;">Verkoop uw motoren aan 100+ NL dealers.</h1>
    <p style="margin: 0; color: #ddd6fe; font-size: 15px;">Wij halen ze op, regelen alles en betalen binnen 1 week uit.</p>
  </div>
  <div style="background: white; padding: 28px;">
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Beste collega,</p>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Wij zijn <strong>Moto Import B.V.</strong> — we zoeken motorzaken die hun voorraad willen verkopen aan ons netwerk van Nederlandse dealers. Geen export-gedoe, geen wachttijden, geen verrassingen.
    </p>
    <h3 style="margin: 24px 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #18181b;">Wat wij u bieden</h3>
    <ul style="margin: 0 0 24px; padding-left: 18px; font-size: 14px; line-height: 1.8; color: #3f3f46;">
      <li><strong>100+ Nederlandse dealers</strong> zien uw motoren direct via ons platform</li>
      <li><strong>100% gratis</strong> — geen abonnement, geen commissie. U bepaalt de prijs voor Moto Import B.V.</li>
      <li><strong>Uitbetaling binnen 1 week</strong> per overschrijving</li>
      <li><strong>Wij halen de motor bij u op</strong> — RDW, BPM en transport: wij regelen het</li>
      <li><strong>Geen NL-administratie</strong> voor u nodig</li>
    </ul>
    <div style="text-align: center; margin: 28px 0;">
      <a href="https://www.motoimportbv.nl/register/supplier?lang=nl" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
        Gratis account aanmaken →
      </a>
      <p style="margin: 8px 0 0; font-size: 12px; color: #71717a;">geen creditcard · direct toegang</p>
    </div>
    <div style="margin: 32px 0 0; padding: 18px; background: #18181b; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #fafafa;">Liever eerst even bellen of WhatsAppen?</p>
      <p style="margin: 0; font-size: 16px; font-weight: 700;">
        <a href="tel:+31624264861" style="color: #c4b5fd; text-decoration: none; margin: 0 12px;">📞 06-24264861</a>
        <a href="https://wa.me/31624264861" style="color: #c4b5fd; text-decoration: none; margin: 0 12px;">💬 WhatsApp</a>
      </p>
    </div>
  </div>
  <div style="background: white; padding: 16px 28px 28px; font-size: 13px; color: #3f3f46;">
    <p style="margin: 16px 0 4px;">Met vriendelijke groet,</p>
    <p style="margin: 0 0 4px; font-weight: 700; color: #18181b;">Team Moto Import B.V.</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">KVK 94622086 · <a href="https://www.motoimportbv.nl" style="color: #7c3aed;">www.motoimportbv.nl</a></p>
  </div>
</div>`;

const SUPPLIER_FR_SUBJECT = "Vendez vos motos à plus de 100 revendeurs néerlandais — Moto Import B.V.";

const SUPPLIER_FR_PLAIN = `Bonjour,

Je suis Sandro de Moto Import B.V. — nous recherchons des concessionnaires moto en France et en Belgique qui souhaitent vendre leur stock à notre réseau de revendeurs néerlandais.

CE QUE NOUS OFFRONS :
• Plateforme avec plus de 100 revendeurs moto néerlandais — ils voient vos motos immédiatement
• 100% gratuit — pas d'abonnement, pas de commission. Vous fixez le prix pour Moto Import B.V.
• Paiement par virement sous 1 semaine
• Nous venons chercher la moto chez vous
• Moto Import B.V. s'occupe de tout : RDW, BPM, immatriculation et transport
• Aucune TVA néerlandaise ni papier d'importation à gérer

COMMENT ÇA MARCHE :
1. Inscription gratuite : https://www.motoimportbv.nl/register/supplier?lang=fr
2. Mettez vos motos en ligne avec le prix pour Moto Import B.V.
3. Nous venons les chercher et vous payons sous 1 semaine

PRÉFÉREZ EN PARLER D'ABORD ?
> Tél : +31 6 24264861
> WhatsApp : +31 6 24264861
> Email : motoimportbv@gmail.com

Cordialement,
L'équipe Moto Import B.V.
Horsterhoekweg 11, 7433 SV Schalkhaar — Pays-Bas
KVK 94622086
www.motoimportbv.nl
`;

const SUPPLIER_FR_HTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fafafa; color: #18181b;">
  <div style="background: linear-gradient(135deg, #18181b 0%, #581c87 100%); color: white; padding: 36px 28px;">
    <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #c4b5fd; text-transform: uppercase;">Pour les concessionnaires moto FR &amp; BE</p>
    <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 900; line-height: 1.1;">Vendez vos motos à 100+ revendeurs néerlandais.</h1>
    <p style="margin: 0; color: #ddd6fe; font-size: 15px;">Nous venons les chercher, nous gérons tout, paiement sous 1 semaine.</p>
  </div>
  <div style="background: white; padding: 28px;">
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Bonjour,</p>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Nous sommes <strong>Moto Import B.V.</strong> — nous recherchons des concessionnaires moto en France et en Belgique qui souhaitent vendre leur stock à notre réseau de revendeurs néerlandais. Pas de tracas d'export, pas d'attente, pas de mauvaise surprise.
    </p>
    <h3 style="margin: 24px 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #18181b;">Ce que nous vous offrons</h3>
    <ul style="margin: 0 0 24px; padding-left: 18px; font-size: 14px; line-height: 1.8; color: #3f3f46;">
      <li><strong>Plus de 100 revendeurs néerlandais</strong> voient vos motos immédiatement</li>
      <li><strong>100% gratuit</strong> — pas d'abonnement, pas de commission. Vous fixez le prix pour Moto Import B.V.</li>
      <li><strong>Paiement sous 1 semaine</strong> par virement bancaire</li>
      <li><strong>Nous venons chercher la moto chez vous</strong> — RDW, BPM et transport : on s'en occupe</li>
      <li><strong>Aucune démarche aux Pays-Bas</strong> à gérer de votre côté</li>
    </ul>
    <div style="text-align: center; margin: 28px 0;">
      <a href="https://www.motoimportbv.nl/register/supplier?lang=fr" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
        Créer un compte gratuit →
      </a>
      <p style="margin: 8px 0 0; font-size: 12px; color: #71717a;">sans carte bancaire · accès immédiat</p>
    </div>
    <div style="margin: 32px 0 0; padding: 18px; background: #18181b; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #fafafa;">Vous préférez nous appeler ?</p>
      <p style="margin: 0; font-size: 16px; font-weight: 700;">
        <a href="tel:+31624264861" style="color: #c4b5fd; text-decoration: none; margin: 0 12px;">📞 +31 6 24264861</a>
        <a href="https://wa.me/31624264861" style="color: #c4b5fd; text-decoration: none; margin: 0 12px;">💬 WhatsApp</a>
      </p>
    </div>
  </div>
  <div style="background: white; padding: 16px 28px 28px; font-size: 13px; color: #3f3f46;">
    <p style="margin: 16px 0 4px;">Cordialement,</p>
    <p style="margin: 0 0 4px; font-weight: 700; color: #18181b;">L'équipe Moto Import B.V.</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">Horsterhoekweg 11, 7433 SV Schalkhaar — Pays-Bas</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">KVK 94622086 · <a href="https://www.motoimportbv.nl" style="color: #7c3aed;">www.motoimportbv.nl</a></p>
  </div>
</div>`;

const SUPPLIER_IT_SUBJECT = "Vendi le tue moto a oltre 100 rivenditori olandesi — Moto Import B.V.";

const SUPPLIER_IT_PLAIN = `Buongiorno,

Sono Sandro di Moto Import B.V. — siamo alla ricerca di concessionari moto in Italia che vogliano vendere il loro stock alla nostra rete di rivenditori olandesi.

COSA OFFRIAMO:
• Piattaforma con oltre 100 rivenditori moto olandesi — vedranno le tue moto immediatamente
• 100% gratuito — nessun abbonamento, nessuna commissione. Tu fissi il prezzo per Moto Import B.V.
• Pagamento tramite bonifico entro 1 settimana
• Veniamo noi a ritirare la moto da te
• Moto Import B.V. si occupa di tutto: RDW, BPM olandese, immatricolazione e trasporto
• Niente IVA olandese né documenti d'importazione da gestire

COME FUNZIONA:
1. Iscrizione gratuita: https://www.motoimportbv.nl/register/supplier?lang=it
2. Carica le tue moto con il prezzo per Moto Import B.V.
3. Veniamo a ritirarle e ti paghiamo entro 1 settimana

PREFERISCI PARLARNE PRIMA?
> Tel: +31 6 24264861
> WhatsApp: +31 6 24264861
> Email: motoimportbv@gmail.com

Cordiali saluti,
Il team Moto Import B.V.
Horsterhoekweg 11, 7433 SV Schalkhaar — Paesi Bassi
KVK 94622086
www.motoimportbv.nl
`;

const SUPPLIER_IT_HTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fafafa; color: #18181b;">
  <div style="background: linear-gradient(135deg, #18181b 0%, #166534 100%); color: white; padding: 36px 28px;">
    <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #86efac; text-transform: uppercase;">Per concessionari moto in Italia</p>
    <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 900; line-height: 1.1;">Vendi le tue moto a 100+ rivenditori olandesi.</h1>
    <p style="margin: 0; color: #bbf7d0; font-size: 15px;">Veniamo noi a ritirarle, ci occupiamo di tutto, pagamento entro 1 settimana.</p>
  </div>
  <div style="background: white; padding: 28px;">
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Buongiorno,</p>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Siamo <strong>Moto Import B.V.</strong> — cerchiamo concessionari moto in Italia che vogliano vendere il loro stock alla nostra rete di rivenditori olandesi. Niente complicazioni di export, niente attese, nessuna sorpresa.
    </p>
    <h3 style="margin: 24px 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #18181b;">Cosa ti offriamo</h3>
    <ul style="margin: 0 0 24px; padding-left: 18px; font-size: 14px; line-height: 1.8; color: #3f3f46;">
      <li><strong>Oltre 100 rivenditori olandesi</strong> vedranno le tue moto immediatamente</li>
      <li><strong>100% gratuito</strong> — nessun abbonamento, nessuna commissione. Tu fissi il prezzo per Moto Import B.V.</li>
      <li><strong>Pagamento entro 1 settimana</strong> tramite bonifico bancario</li>
      <li><strong>Veniamo noi a ritirare la moto</strong> — RDW, BPM e trasporto: ci pensiamo noi</li>
      <li><strong>Nessuna burocrazia olandese</strong> da gestire da parte tua</li>
    </ul>
    <div style="text-align: center; margin: 28px 0;">
      <a href="https://www.motoimportbv.nl/register/supplier?lang=it" style="display: inline-block; background: #16a34a; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
        Crea un account gratuito →
      </a>
      <p style="margin: 8px 0 0; font-size: 12px; color: #71717a;">senza carta di credito · accesso immediato</p>
    </div>
    <div style="margin: 32px 0 0; padding: 18px; background: #18181b; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #fafafa;">Preferisci chiamarci?</p>
      <p style="margin: 0; font-size: 16px; font-weight: 700;">
        <a href="tel:+31624264861" style="color: #86efac; text-decoration: none; margin: 0 12px;">📞 +31 6 24264861</a>
        <a href="https://wa.me/31624264861" style="color: #86efac; text-decoration: none; margin: 0 12px;">💬 WhatsApp</a>
      </p>
    </div>
  </div>
  <div style="background: white; padding: 16px 28px 28px; font-size: 13px; color: #3f3f46;">
    <p style="margin: 16px 0 4px;">Cordiali saluti,</p>
    <p style="margin: 0 0 4px; font-weight: 700; color: #18181b;">Il team Moto Import B.V.</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">Horsterhoekweg 11, 7433 SV Schalkhaar — Paesi Bassi</p>
    <p style="margin: 0; color: #71717a; font-size: 12px;">KVK 94622086 · <a href="https://www.motoimportbv.nl" style="color: #16a34a;">www.motoimportbv.nl</a></p>
  </div>
</div>`;

const TEMPLATES = {
  bpm: {
    label: 'BPM-taxatie — NL motorzaken',
    flag: '🇳🇱',
    subject: SUBJECT,
    plain: PLAIN_TEXT,
    html: HTML_BODY,
    showFlyer: true,
  },
  supplier_nl: {
    label: 'Leverancier outreach — NL/Vlaams',
    flag: '🇧🇪',
    subject: SUPPLIER_NL_SUBJECT,
    plain: SUPPLIER_NL_PLAIN,
    html: SUPPLIER_NL_HTML,
    showFlyer: false,
  },
  supplier_fr: {
    label: 'Fournisseur outreach — Français',
    flag: '🇫🇷',
    subject: SUPPLIER_FR_SUBJECT,
    plain: SUPPLIER_FR_PLAIN,
    html: SUPPLIER_FR_HTML,
    showFlyer: false,
  },
  supplier_it: {
    label: 'Concessionario outreach — Italiano',
    flag: '🇮🇹',
    subject: SUPPLIER_IT_SUBJECT,
    plain: SUPPLIER_IT_PLAIN,
    html: SUPPLIER_IT_HTML,
    showFlyer: false,
  },
};

export default function TaxatieSalesMail() {
  const { user, token } = useAuth();
  const [templateKey, setTemplateKey] = useState('bpm');
  const T = TEMPLATES[templateKey];
  const [view, setView] = useState('preview');  // 'preview' | 'html' | 'plain' | 'send'
  const [copied, setCopied] = useState('');
  const [recipientText, setRecipientText] = useState('');
  const [attachFlyer, setAttachFlyer] = useState(true);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const isAllowed = user?.role === 'admin' || user?.role === 'taxateur' || user?.email?.toLowerCase() === 'motoimportbv@gmail.com';

  // Parse plak-tekst (komma's, puntkomma's, regels, spaties allemaal toegestaan)
  const parseRecipients = useCallback((t) => {
    return (t || '').split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  }, []);

  const recipients = parseRecipients(recipientText);
  const validCount = recipients.filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)).length;

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    try {
      const r = await axios.get(`${API}/admin/taxatie-sales-mail/history`, { headers: { Authorization: `Bearer ${token}` } });
      setHistory(r.data?.history || []);
    } catch { /* ok */ }
  }, [token]);

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory, fetchHistory]);

  // Auto-import e-mails vanuit Lead Scraper (sessionStorage)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('import') === 'leads') {
      const stored = sessionStorage.getItem('lead_import_emails');
      if (stored) {
        setRecipientText(stored);
        setView('send');
        toast.success(`${stored.split(/\s+/).filter(Boolean).length} adressen geïmporteerd vanuit Lead-scraper`);
        sessionStorage.removeItem('lead_import_emails');
        // ids worden bewaard zodat we ze na verzending kunnen markeren
        // (zie sendBulk)
      }
    }
  }, []);

  const copyTo = (label, content) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(label);
      toast.success(`${label} gekopieerd naar klembord`);
      setTimeout(() => setCopied(''), 2500);
    }).catch(() => toast.error('Kopiëren mislukt'));
  };

  const downloadFlyer = () => window.open(`${API}/public/taxatie-flyer`, '_blank');

  const sendBulk = async () => {
    if (validCount === 0) { toast.error('Geen geldige e-mailadressen'); return; }
    if (validCount > 100) { toast.error(`Max 100 per keer (u heeft ${validCount})`); return; }
    if (!window.confirm(`Verstuur deze sales-mail (${T.label}) naar ${validCount} ontvangers?${attachFlyer && T.showFlyer ? ' (incl. flyer-bijlage)' : ''}`)) return;
    setSending(true);
    try {
      const r = await axios.post(
        `${API}/admin/taxatie-sales-mail/send`,
        { subject: T.subject, html: T.html, recipients, attach_flyer: attachFlyer && T.showFlyer },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = r.data;
      toast.success(`Verzonden: ${d.sent} OK · ${d.failed} mislukt · ${d.invalid} ongeldig`);
      if (d.failed > 0) {
        toast.warning(`Mislukt: ${d.failed_addresses.join(', ')}`);
      }
      // Markeer leads als 'sent' in lead-scraper DB (best-effort)
      const leadIds = sessionStorage.getItem('lead_import_ids');
      if (leadIds) {
        try {
          await axios.post(
            `${API}/admin/leads/mark-sent`,
            { emails: recipients },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          sessionStorage.removeItem('lead_import_ids');
        } catch { /* niet kritisch */ }
      }
      // Als dit een follow-up campagne was → markeer ze ook als follow_up_sent
      if (sessionStorage.getItem('lead_import_is_followup') === '1') {
        try {
          await axios.post(
            `${API}/admin/follow-up-mark-sent`,
            { emails: recipients },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          sessionStorage.removeItem('lead_import_is_followup');
          sessionStorage.removeItem('lead_import_subject_hint');
        } catch { /* niet kritisch */ }
      }
      setRecipientText('');
      if (showHistory) fetchHistory();
    } catch (e) {
      toast.error('Verzenden mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setSending(false);
  };

  if (!isAllowed) {
    return <Layout><div className="p-10 text-center text-zinc-500">Geen toegang</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="sales-mail-page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Mail className="w-7 h-7 text-red-600" /> Sales-mail naar motorzaken
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">Kant-en-klare e-mail om dealers binnen te halen — kopiëer naar Gmail/Outlook of stuur in bulk.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/campaign-results">
              <Button variant="outline" data-testid="campaign-results-link">
                <Eye className="w-4 h-4 mr-2" />Resultaten
              </Button>
            </Link>
            <Link to="/admin/lead-scraper">
              <Button variant="outline" data-testid="lead-scraper-link">
                <Globe className="w-4 h-4 mr-2" />Lead-scraper
              </Button>
            </Link>
            <Link to="/admin/taxatie-aanvragen">
              <Button variant="outline" data-testid="back-btn">
                <ArrowLeft className="w-4 h-4 mr-2" />Terug
              </Button>
            </Link>
          </div>
        </div>

        {/* Template selector */}
        <div className="bg-white rounded-2xl border-2 border-purple-200 p-5" data-testid="template-selector-block">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2">Welke campagne?</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.entries(TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTemplateKey(key)}
                className={`text-left p-3 rounded-xl border-2 transition ${
                  templateKey === key
                    ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                    : 'border-zinc-200 bg-white hover:border-purple-300'
                }`}
                data-testid={`tpl-${key}`}
              >
                <div className="text-2xl">{tpl.flag}</div>
                <div className={`text-sm font-bold mt-1 ${templateKey === key ? 'text-purple-900' : 'text-zinc-900'}`}>{tpl.label}</div>
                {templateKey === key && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                    <Check className="w-3 h-3" />Actief
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Onderwerp regel + acties */}
        <div className="bg-white rounded-2xl border p-5 space-y-4" data-testid="subject-block">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Onderwerp</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly value={T.subject}
                className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm font-bold bg-zinc-50"
                data-testid="subject-input"
              />
              <Button onClick={() => copyTo('Onderwerp', T.subject)} variant="outline" size="sm" data-testid="copy-subject-btn">
                {copied === 'Onderwerp' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t flex-wrap">
            {T.showFlyer && (
              <Button onClick={downloadFlyer} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="download-flyer-btn">
                <FileText className="w-4 h-4 mr-2" />Download flyer (bijlage)
              </Button>
            )}
            <Button onClick={() => copyTo('HTML body', T.html)} variant="outline" data-testid="copy-html-btn">
              {copied === 'HTML body' ? <Check className="w-4 h-4 text-emerald-600 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Kopieer HTML
            </Button>
            <Button onClick={() => copyTo('Plain-text', T.plain)} variant="outline" data-testid="copy-plain-btn">
              {copied === 'Plain-text' ? <Check className="w-4 h-4 text-emerald-600 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Kopieer plain-text
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b flex-wrap">
          <TabBtn active={view === 'preview'} onClick={() => setView('preview')} icon={Eye} label="Visuele preview" testid="tab-preview" />
          <TabBtn active={view === 'html'} onClick={() => setView('html')} icon={FileCode} label="HTML code" testid="tab-html" />
          <TabBtn active={view === 'plain'} onClick={() => setView('plain')} icon={Type} label="Plain-text" testid="tab-plain" />
          <TabBtn active={view === 'send'} onClick={() => setView('send')} icon={Send} label="🚀 Direct versturen" testid="tab-send" highlight />
        </div>

        {/* Content */}
        {view === 'preview' && (
          <div className="bg-zinc-100 rounded-2xl p-4 sm:p-8 border" data-testid="preview-block">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mx-auto" style={{ maxWidth: '640px' }} dangerouslySetInnerHTML={{ __html: T.html }} />
          </div>
        )}
        {view === 'html' && (
          <textarea
            readOnly value={T.html}
            className="w-full h-[560px] border border-zinc-300 rounded-2xl px-4 py-3 text-xs font-mono bg-zinc-50 focus:outline-none"
            data-testid="html-textarea"
          />
        )}
        {view === 'plain' && (
          <textarea
            readOnly value={T.plain}
            className="w-full h-[560px] border border-zinc-300 rounded-2xl px-4 py-3 text-sm font-mono bg-zinc-50 focus:outline-none whitespace-pre"
            data-testid="plain-textarea"
          />
        )}
        {view === 'send' && (
          <div className="bg-white rounded-2xl border p-6 space-y-5" data-testid="send-block">
            <div>
              <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-1">
                <Send className="w-4 h-4 text-red-600" />Direct verzenden via Gmail
              </h3>
              <p className="text-xs text-zinc-500">Plak alle dealer-e-mailadressen. Komma's, regelafbrekingen of spaties zijn toegestaan. Wij sturen ze via uw Moto Import Gmail-account verzonden — elke ontvanger krijgt een aparte e-mail (geen BCC nodig).</p>
            </div>

            <textarea
              value={recipientText}
              onChange={(e) => setRecipientText(e.target.value)}
              placeholder={"voorbeeld@dealer.nl\ntweede@andermail.nl\nderde@dealer.nl, vierde@partner.nl"}
              className="w-full h-48 border border-zinc-300 rounded-xl px-3 py-2 text-sm font-mono bg-zinc-50 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              data-testid="recipients-textarea"
            />

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold">{validCount}</span>
                <span className="text-zinc-500">geldig{recipients.length !== validCount && (<span className="text-amber-600 ml-1">· {recipients.length - validCount} ongeldig</span>)}</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={attachFlyer} onChange={(e) => setAttachFlyer(e.target.checked)}
                  className="w-4 h-4 accent-red-600" data-testid="attach-flyer-toggle"
                />
                <span className="text-sm">Flyer als PDF-bijlage meesturen</span>
              </label>
              <Button onClick={() => setShowHistory(s => !s)} variant="ghost" size="sm" className="ml-auto text-xs" data-testid="toggle-history-btn">
                <History className="w-3.5 h-3.5 mr-1" />{showHistory ? 'Verberg' : 'Toon'} verzendgeschiedenis
              </Button>
            </div>

            {validCount > 50 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span><strong>Let op:</strong> u stuurt naar {validCount} ontvangers. Gmail beperkt ~500 mails/dag — spreid grote batches over meerdere dagen. Max 100 per verzending.</span>
              </div>
            )}

            <Button
              onClick={sendBulk}
              disabled={sending || validCount === 0 || validCount > 100}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3"
              data-testid="send-bulk-btn"
            >
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bezig met verzenden — even geduld ({validCount} stuks)...</>
                       : <><Send className="w-4 h-4 mr-2" />Verstuur naar {validCount} ontvangers</>}
            </Button>

            {showHistory && (
              <div className="border-t pt-4 space-y-2" data-testid="history-block">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Verzendgeschiedenis</h4>
                {history.length === 0 ? (
                  <p className="text-sm text-zinc-400">Nog niets verzonden.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {history.map(h => (
                      <div key={h.id} className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-lg text-xs" data-testid={`history-row-${h.id}`}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-semibold">{h.recipients_ok}</span>
                          <span className="text-zinc-500">/ {h.recipients_total} ok</span>
                          {h.recipients_failed > 0 && <span className="text-amber-700">· {h.recipients_failed} mislukt</span>}
                          {h.attach_flyer && <span className="text-zinc-400">· met flyer</span>}
                        </div>
                        <span className="text-zinc-400">{new Date(h.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Instructies */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm" data-testid="instructions-block">
          <h3 className="font-bold text-blue-900 mb-2">📋 Verzendinstructies</h3>
          <ol className="list-decimal pl-5 space-y-1.5 text-blue-900">
            <li><strong>Download de flyer</strong> (knop hierboven) als PDF-bijlage.</li>
            <li>Open Gmail / Outlook → nieuwe e-mail.</li>
            <li>Plak de onderwerp-regel.</li>
            <li>Klik op "HTML-bewerker aanzetten" (Gmail: het kleine pijltje &gt; "Layout" / Outlook: knop met &lt;/&gt;) en plak de HTML-body.</li>
            <li>Plaats motorzaken in <strong>BCC</strong> (niet CC!) zodat ze elkaars e-mailadres niet zien — GDPR-veilig.</li>
            <li>Voeg de flyer-PDF als bijlage toe.</li>
            <li>Verzenden!</li>
          </ol>
          <p className="text-xs text-blue-700 mt-3">💡 Tip: stuur niet meer dan 50 mailtjes tegelijk om in spam-filters te voorkomen. Spreid bv. 50 per dag over een week.</p>
        </div>
      </div>
    </Layout>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, testid, highlight }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px flex items-center gap-2 transition-colors ${
        active
          ? (highlight ? 'border-red-600 text-red-600' : 'border-red-600 text-red-600')
          : (highlight ? 'border-transparent text-red-600 hover:text-red-700' : 'border-transparent text-zinc-500 hover:text-zinc-900')
      }`}
    >
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}
