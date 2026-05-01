import { CrateLoan, CrateType, Customer, InterpretationType, ParsedMessage, Payment, Sale, UnknownInterpretation } from '../types';

type GeminiRuntimeEnv = {
  VITE_GEMINI_API_KEY?: string;
  GEMINI_API_KEY?: string;
};

type GeminiClient = {
  models: {
    generateContent: (config: Record<string, unknown>) => Promise<{ text: string }>;
  };
};

const env = (import.meta as ImportMeta & { env?: GeminiRuntimeEnv }).env;
const API_KEY = env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.API_KEY;

if (!API_KEY) {
  console.warn('API_KEY environment variable not set. Gemini API calls will be disabled.');
}

let aiPromise: Promise<GeminiClient | null> | null = null;

const getAi = async (): Promise<GeminiClient | null> => {
  if (!API_KEY) {
    return null;
  }

  if (!aiPromise) {
    aiPromise = import('@google/genai').then(
      ({ GoogleGenAI }) => new GoogleGenAI({ apiKey: API_KEY }) as unknown as GeminiClient,
    );
  }

  return aiPromise;
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export const interpretMessage = async (message: string, sender: string, systemPrompt: string): Promise<ParsedMessage> => {
  const ai = await getAi();
  if (!ai) {
    const fallback: UnknownInterpretation = {
      type: InterpretationType.DESCONOCIDO,
      originalMessage: message,
      certainty: 0.1,
      explanation: 'La API de IA no esta configurada. No se pudo procesar el mensaje.',
      data: {},
      sender,
    };
    return fallback;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const fullPrompt = `Mensaje del usuario "${sender}": "${message}"`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          tools: [{ googleMaps: {} }],
        },
      });

      let jsonStr = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      const parsedData = JSON.parse(jsonStr);
      parsedData.originalMessage = message;
      parsedData.sender = sender;
      return parsedData as ParsedMessage;
    } catch (error) {
      console.error(`Error interpreting message with Gemini (Attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  const genericUnknown: UnknownInterpretation = {
    type: InterpretationType.DESCONOCIDO,
    originalMessage: message,
    certainty: 0.1,
    explanation: 'No estoy seguro de como procesar tu solicitud en este momento. Por favor, intentalo de nuevo con otras palabras.',
    data: {},
    sender,
  };
  return genericUnknown;
};

export const generateOfferMessage = async (prompt: string): Promise<string> => {
  const ai = await getAi();
  if (!ai) {
    return Promise.resolve(`**OFERTA ESPECIAL**\n${prompt}.\n\n(Respuesta simulada por falta de API Key)`);
  }

  const systemInstruction = `Eres "Fideo", un asistente de ventas experto para un mayorista de frutas. Tu tarea es convertir una descripcion simple de una oferta en un mensaje de WhatsApp corto, amigable y persuasivo para los clientes.
- Conoces los estados de madurez ('Verde', 'Entrado', 'Maduro', 'Suave') y puedes usarlos para crear ofertas mas especificas.
- Conoces las calidades: 'Normal' y 'Con Defectos' (o 'rona'). Puedes usar la calidad 'Con Defectos' para crear ofertas especiales.
- Usa emojis relevantes de frutas.
- Se breve y directo.
- Crea un sentido de urgencia (ej. "Solo por hoy", "Hasta agotar existencias").
- Termina con un llamado a la accion claro (ej. "Haz tu pedido ya", "Que no te lo ganen").
- El tono debe ser informal y amigable, como se usa en Mexico.
- Responde unicamente con el texto del mensaje, sin explicaciones adicionales.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'text/plain',
        temperature: 0.8,
      },
    });

    return response.text.trim();
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Error al comunicarse con la IA para generar la oferta.');
  }
};

export const generateSvgIcon = async (prompt: string): Promise<string> => {
  const ai = await getAi();
  if (!ai) {
    return Promise.resolve(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="grey"></rect><text x="50" y="55" font-size="30" text-anchor="middle" dominant-baseline="middle" fill="white">MOCK</text></svg>',
    );
  }

  const systemInstruction = `You are a minimalist SVG designer. Your task is to generate a simple, clean, single-color SVG icon based on the user's prompt.
- The SVG must be a single path or a few simple shapes.
- Use 'currentColor' for the fill color so it can be styled with CSS.
- Do not include any XML declaration or comments.
- The SVG must have a viewBox="0 0 24 24".
- The output must be ONLY the <svg> tag and its content, nothing else.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'text/plain',
        temperature: 0.2,
      },
    });

    let svgText = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = svgText.match(fenceRegex);
    if (match && match[2]) {
      svgText = match[2].trim();
    }

    if (!svgText.startsWith('<svg')) {
      throw new Error(`La IA no genero un icono SVG valido: ${svgText.substring(0, 50)}...`);
    }

    return svgText;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Error al comunicarse con la IA para generar el icono.');
  }
};

export const generateCustomerInsights = async (
  customer: Customer,
  sales: Sale[],
  payments: Payment[],
  crateLoans: CrateLoan[],
  crateTypes: CrateType[],
): Promise<string> => {
  const ai = await getAi();
  if (!ai) {
    return Promise.resolve('### Analisis de IA Desactivado\n\nLa API de IA no esta configurada. No se pudo generar el resumen del cliente.');
  }

  const systemInstruction = `Eres un experto analista de negocios para un mayorista de frutas. Analiza el siguiente perfil de cliente y su historial. Genera un resumen conciso en formato Markdown. Tu analisis debe incluir:
1. **Patrones de Compra:** Que productos, tamanos y calidades compra mas? Con que frecuencia? Que dias?
2. **Comportamiento de Pago:** Paga a tiempo? Acumula deuda? Es confiable?
3. **Gestion de Activos:** Devuelve las cajas prestadas puntualmente? Tiene cajas vencidas?
4. **Recomendaciones Clave:** Basado en los datos, sugiere la proxima accion de venta (que ofrecer y cuando) y una estrategia de cobranza si es necesario.

Usa titulos con '###' y listas con '*'. Se directo, profesional y enfocate en informacion accionable.`;

  const salesHistory = sales
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15)
    .map(
      (sale) =>
        `- ${new Date(sale.timestamp).toLocaleDateString('es-MX')}: ${sale.quantity} ${sale.unit} de ${sale.productGroupName} ${sale.varietyName} ${sale.size}. Total: ${sale.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}. Estado de pago: ${sale.paymentStatus}.`,
    )
    .join('\n');

  const paymentHistory = payments
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map(
      (payment) =>
        `- ${new Date(payment.date).toLocaleDateString('es-MX')}: Abono de ${payment.amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}.`,
    )
    .join('\n');

  const crateHistory = crateLoans
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((loan) => {
      const typeName = crateTypes.find((crateType) => crateType.id === loan.crateTypeId)?.name || 'Caja Desconocida';
      return `- ${new Date(loan.timestamp).toLocaleDateString('es-MX')}: ${loan.quantity} x ${typeName}. Estado: ${loan.status}. Vencimiento: ${new Date(loan.dueDate).toLocaleDateString('es-MX')}.`;
    })
    .join('\n');

  const prompt = `
# PERFIL DEL CLIENTE A ANALIZAR

**Nombre:** ${customer.name}
**Contactos/Apodos:** ${customer.contacts.map((contact) => contact.name).join(', ')}
**Nivel de Confianza:** ${customer.creditStatus}
**Limite de Credito:** ${customer.creditLimit ? customer.creditLimit.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : 'N/A'}
**Horario de Compra:** ${customer.schedule ? `${customer.schedule.days.join(', ')} de ${customer.schedule.time}` : 'No especificado'}

---

## HISTORIAL DE PEDIDOS (Mas recientes)
${salesHistory || 'Sin pedidos registrados.'}

---

## HISTORIAL DE PAGOS
${paymentHistory || 'Sin pagos registrados.'}

---

## HISTORIAL DE PRESTAMO DE CAJAS
${crateHistory || 'Sin prestamos de cajas registrados.'}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'text/plain',
        temperature: 0.5,
      },
    });

    return response.text.trim();
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Error al comunicarse con la IA para generar el resumen.');
  }
};

export const generateBusinessInsights = async (
  dailyStats: {
    ventas: number;
    ganancia: number;
    margen: number;
    topCustomers: string[];
    topProducts: string[];
  },
  inventorySummary: { name: string; quantity: number; daysOnHand: number }[],
): Promise<string> => {
  const ai = await getAi();
  if (!ai) {
    return Promise.resolve('### Inteligencia Fideo Desactivada\n- La API de IA no esta configurada. No se pudieron generar insights.');
  }

  const systemInstruction = `Eres "Fideo", un analista de negocios experto para un mayorista de frutas. Analiza los datos del dia y del inventario para generar 3 insights accionables y concisos en formato Markdown (usando '*' para listas). Se directo y enfocate en oportunidades de venta, optimizacion de inventario o mejoras de rentabilidad.`;

  const prompt = `
# DATOS DEL DIA
- Ventas Totales: ${dailyStats.ventas.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
- Ganancia Bruta: ${dailyStats.ganancia.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
- Margen: ${dailyStats.margen.toFixed(1)}%
- Clientes mas rentables: ${dailyStats.topCustomers.join(', ') || 'N/A'}
- Productos mas rentables: ${dailyStats.topProducts.join(', ') || 'N/A'}

# INVENTARIO CLAVE
${inventorySummary.map((item) => `- ${item.name}: ${item.quantity} cajas, ${item.daysOnHand.toFixed(1)} dias restantes`).join('\n')}

# INSIGHTS ACCIONABLES:
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'text/plain',
        temperature: 0.7,
        maxOutputTokens: 250,
      },
    });

    return response.text.trim();
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Error al comunicarse con la IA para generar insights.');
  }
};
