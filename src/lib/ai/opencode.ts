export interface AIPromptOptions {
  prompt: string;
  systemPrompt?: string;
  fileBase64?: string;
  mimeType?: string;
  temperature?: number;
  model?: string;
}

export async function callAI({
  prompt,
  systemPrompt = 'Eres un asistente experto de apoyo a la gestión educativa.',
  fileBase64,
  mimeType,
  temperature = 0.1,
  model
}: AIPromptOptions): Promise<string> {
  const opencodeKey = process.env.OPENCODE_GO_API_KEY;
  const opencodeBaseUrl = (process.env.OPENCODE_GO_BASE_URL || 'https://opencode.ai/zen/go/v1').replace(/\/+$/, '');
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. Try OpenCode Go if key is provided and not placeholder
  if (opencodeKey && opencodeKey !== 'tu_api_key_de_opencode_aqui' && opencodeKey.trim() !== '') {
    const endpoint = opencodeBaseUrl.endsWith('/chat/completions')
      ? opencodeBaseUrl
      : `${opencodeBaseUrl}/chat/completions`;

    const userContent: any[] = [];
    userContent.push({ type: 'text', text: prompt });

    if (fileBase64 && mimeType) {
      const cleanB64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const dataUrl = `data:${mimeType};base64,${cleanB64}`;
      userContent.push({
        type: 'image_url',
        image_url: { url: dataUrl }
      });
    }

    const payload = {
      model: model || process.env.OPENCODE_GO_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: userContent.length === 1 && typeof userContent[0].text === 'string' 
            ? userContent[0].text 
            : userContent 
        }
      ],
      temperature
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opencodeKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || data.message || `Error en OpenCode Go API (${response.status})`);
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('OpenCode Go no retornó contenido en la respuesta');
    }

    return text;
  }

  // 2. Fallback to Gemini if GEMINI_API_KEY is available
  if (geminiKey && geminiKey.trim() !== '') {
    const geminiModel = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;

    const parts: any[] = [{ text: `${systemPrompt}\n\n${prompt}` }];

    if (fileBase64 && mimeType) {
      const cleanB64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType,
          data: cleanB64
        }
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || `Error en API Gemini (${response.status})`);
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini no retornó contenido en la respuesta');
    }

    return text;
  }

  throw new Error('No se encontró configuración de IA. Configura OPENCODE_GO_API_KEY o GEMINI_API_KEY en tu archivo .env.local');
}
