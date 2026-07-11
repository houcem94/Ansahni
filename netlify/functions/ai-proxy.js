// netlify/functions/ai-proxy.js
// Proxy sécurisé vers Google Gemini
// La clé API reste uniquement côté serveur Netlify.

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
        error: "GEMINI_API_KEY manquante dans Netlify.",
      }),
    };
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "JSON invalide.",
      }),
    };
  }

  const {
    system,
    messages,
    max_tokens
  } = payload;


  if (!messages || !Array.isArray(messages)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Le champ "messages" est requis.',
      }),
    };
  }


  try {

    // Construction du prompt envoyé à Gemini
    let prompt = "";

    if (system) {
      prompt += system + "\n\n";
    }

    messages.forEach((message) => {

      if (message.role === "user") {
        prompt += "Utilisateur: " + message.content + "\n";
      }

      if (message.role === "assistant") {
        prompt += "Assistant: " + message.content + "\n";
      }

    });


    // Modèle Gemini
    const model = "gemini-flash-lite-latest";


    const response = await fetch(
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

            // Augmenté pour éviter les réponses coupées
            maxOutputTokens: max_tokens || 2000,

            temperature: 0.7,

          },

        }),

      }
    );


    const data = await response.json();


    console.log(
      "Gemini status:",
      response.status
    );


    console.log(
      "Finish reason:",
      data.candidates?.[0]?.finishReason
    );


    if (!response.ok) {

      console.error(
        "Gemini error:",
        JSON.stringify(data)
      );


      return {
        statusCode: response.status,

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          error:
            data.error?.message ||
            "Erreur Gemini inconnue",
        }),

      };
    }


    const candidate = data.candidates?.[0];


    const text =
      candidate?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        ||
        "Aucune réponse générée.";


    return {

      statusCode: 200,

      headers: {
        "Content-Type": "application/json",
      },


      // Format compatible avec Claude
      body: JSON.stringify({

        id: "gemini-response",

        model: model,

        role: "assistant",

        content: [
          {
            type: "text",
            text: text,
          },
        ],

      }),

    };


  } catch (error) {

    console.error(
      "Server error:",
      error
    );


    return {

      statusCode: 500,

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({

        error:
          "Erreur serveur: " + error.message,

      }),

    };

  }
};
