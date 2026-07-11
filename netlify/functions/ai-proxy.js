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
        error: "GEMINI_API_KEY manquante dans les variables Netlify.",
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

  const { system, messages, max_tokens } = payload;

  if (!messages || !Array.isArray(messages)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Le champ "messages" est requis.',
      }),
    };
  }

  try {
    let prompt = "";

    if (system) {
      prompt += system + "\n\n";
    }

    messages.forEach((msg) => {
      if (msg.role === "user") {
        prompt += `Utilisateur: ${msg.content}\n`;
      }

      if (msg.role === "assistant") {
        prompt += `Assistant: ${msg.content}\n`;
      }
    });


    const model = "gemini-3.5-flash";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
          generationConfig: {
            maxOutputTokens: max_tokens || 500,
          },
        }),
      }
    );


    const data = await res.json();

    if (!res.ok) {
      console.error("Gemini API error:", JSON.stringify(data));

      return {
        statusCode: res.status,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error:
            data.error?.message ||
            "Erreur inconnue Gemini",
        }),
      };
    }


    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Aucune réponse générée.";


    // Format compatible avec ton ancien code Claude
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "gemini-response",
        model,
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

    console.error("Server error:", err);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Erreur serveur: " + err.message,
      }),
    };
  }
};
