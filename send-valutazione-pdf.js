// Funzione serverless Netlify: riceve il PDF dal sito e lo invia via email
// tramite Resend (https://resend.com - piano gratuito: 3000 email/mese).
//
// SETUP (una tantum):
// 1. Crea un account gratuito su https://resend.com
// 2. Verifica un dominio tuo (es. animazioneuisprovigo.it) in Resend > Domains
//    - Se non hai un dominio, puoi usare "onboarding@resend.dev" come mittente,
//      ma Resend permette di inviare SOLO all'email con cui ti sei registrato:
//      utile per fare un test, non per l'uso reale con i coordinatori.
// 3. Copia la API Key da Resend (inizia con "re_...")
// 4. Su Netlify: Site settings > Environment variables > aggiungi
//       RESEND_API_KEY = re_xxxxxxxxxxxx
//       FROM_EMAIL = valutazioni@tuodominio.it   (deve appartenere al dominio verificato)
// 5. Assicurati che questo file sia in:  netlify/functions/send-valutazione-pdf.js
//    (stessa struttura di cartelle di questo pacchetto)
// 6. Fai il deploy: Netlify rileva automaticamente le funzioni in quella cartella.
//
// Il sito chiamerà automaticamente questa funzione all'indirizzo:
//   /.netlify/functions/send-valutazione-pdf

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { to, cc, filename, pdfBase64, animatore, plesso, settimane, coordinatore, totale, tier } = data;

    if (!to || !pdfBase64 || !filename) {
      return { statusCode: 400, body: 'Dati mancanti' };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

    if (!RESEND_API_KEY) {
      return { statusCode: 500, body: 'RESEND_API_KEY non configurata su Netlify' };
    }

    const subject = `Valutazione ${animatore} - ${plesso} - ${settimane}`;
    const html = `
      <p>Nuova scheda di valutazione compilata.</p>
      <ul>
        <li><strong>Animatore:</strong> ${animatore}</li>
        <li><strong>Plesso:</strong> ${plesso}</li>
        <li><strong>Settimane:</strong> ${settimane}</li>
        <li><strong>Coordinatore:</strong> ${coordinatore}</li>
        <li><strong>Punteggio:</strong> ${totale}/100 - ${tier}</li>
      </ul>
      <p>Il PDF completo è in allegato.</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        cc: cc ? [cc] : undefined,
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBase64
          }
        ]
      })
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      return { statusCode: 502, body: `Errore invio email: ${errText}` };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: `Errore: ${err.message}` };
  }
};
