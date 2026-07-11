// netlify/functions/ai-proxy.js
// Relais sécurisé vers l'API Anthropic : la clé API reste uniquement ici,
// jamais dans le code envoyé au navigateur.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY manquante côté serveur (variable d\'environnement Netlify).' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const { system, messages, max_tokens } = payload;
  if (!messages) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Le champ "messages" est requis' }) };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5', // vérifiez sur console.anthropic.com le modèle le plus récent disponible
        max_tokens: max_tokens || 500,
        system: system || undefined,
        messages,
      }),
    });

    const data = await res.json();
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 502, body: JSON.stringify({ error: 'تعذّر الاتصال بالمساعد الذكي حاليًا.' }) };
  }
};
