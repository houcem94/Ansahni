// netlify/functions/ai-proxy.js
// Proxy sécurisé vers Google Gemini
// La clé API reste uniquement côté serveur (Netlify).

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: "Method not allowed",
      }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "GEMINI_API_KEY manquante dans les variables d'environnement Netlify.",
      }),
    };
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "JSON invalide.",
      }),
    };
  }

  const { system, messages } = payload;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Le champ "messages" est requis.',
      }),
    };
  }

  try {
    // Construction du prompt
    let prompt = "";

    if (system) {
      prompt += system + "\n\n";
    }

    for (const msg of messages) {
      if (msg.role === "user") {
        prompt += `Utilisateur : ${msg.content}\n`;
      } else if (msg.role === "assistant") {
        prompt += `Assistant : ${msg.content}\n`;
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Error:", data);

      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      };
    }

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // On renvoie un format proche d'Anthropic
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "gemini-response",
        model: "gemini-2.5-flash",
        role: "assistant",
        content: [
          {
            type: "text",
            text,
          },
        ],
      }),
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};
