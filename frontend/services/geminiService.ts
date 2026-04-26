
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ParsedMessage, InterpretationType, UnknownInterpretation, Customer, Sale, Payment, CrateLoan, CrateType } from '../types';

type GeminiRuntimeEnv = {
  VITE_GEMINI_API_KEY?: string;
  GEMINI_API_KEY?: string;
};

const env = (import.meta as ImportMeta & { env?: GeminiRuntimeEnv }).env;
const API_KEY = env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini API calls will be disabled.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export const interpretMessage = async (message: string, sender: string, systemPrompt: string): Promise<ParsedMessage> => {
  if (!ai) {
    const fallback: UnknownInterpretation = {
      type: InterpretationType.DESCONOCIDO,
      originalMessage: message,
      certainty: 0.1,
      explanation: "La API de IA no está configurada. No se pudo procesar el mensaje.",
      data: {},
      sender: sender,
    };
    return fallback;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const fullPrompt = `Mensaje del usuario "${sender}": "${message}"`;
      
      const response: GenerateContentResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: fullPrompt,
          config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              tools: [{googleMaps: {}}],
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
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  // Fallback if all retries fail
  const genericUnknown: UnknownInterpretation = {
      type: InterpretationType.DESCONOCIDO,
      originalMessage: message,
      certainty: 0.1,
      explanation: "No estoy seguro de cómo procesar tu solicitud en este momento. Por favor, inténtalo de nuevo con otras palabras.",
      data: {},
      sender: sender,
  };
  return genericUnknown;
};

export const generateOfferMessage = async (prompt: string): Promise<string> => {
    if (!ai) {
        return Promise.resolve(`**¡OFERTA ESPECIAL!**\n${prompt}.\n\n(Respuesta simulada por falta de API Key)`);
    }

    const systemInstruction = `Eres "Fideo", un asistente de ventas experto para un mayorista de frutas. Tu tarea es convertir una descripción simple de una oferta en un mensaje de WhatsApp corto, amigable y persuasivo para los clientes.
- Conoces los estados de madurez ('Verde', 'Entrado', 'Maduro', 'Suave') y puedes usarlos para crear ofertas más específicas.
- Conoces las calidades: 'Normal' y 'Con Defectos' (o 'roña'). Puedes usar la calidad 'Con Defectos' para crear ofertas especiales (ej. "¡Aguacate con roña ideal para guacamole a un súper precio!").
- Usa emojis relevantes de frutas (🥑, 🍎, 🥭).
- Sé breve y directo.
- Crea un sentido de urgencia (ej. "¡Solo por hoy!", "¡Hasta agotar existencias!").
- Termina con un llamado a la acción claro (ej. "¡Haz tu pedido ya!", "¡Que no te lo ganen!").
- El tono debe ser informal y amigable, como se usa en México.
- Responde únicamente con el texto del mensaje, sin explicaciones adicionales.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "text/plain",
                temperature: 0.8
            }
        });
        
        return response.text.trim();

    } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Error al comunicarse con la IA para generar la oferta.");
    }
};


export const generateSvgIcon = async (prompt: string): Promise<string> => {
    if (!ai) {
        return Promise.resolve(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="grey"></rect><text x="50" y="55" font-size="30" text-anchor="middle" dominant-baseline="middle" fill="white">MOCK</text></svg>`);
    }

    const systemInstruction = `You are a minimalist SVG designer. Your task is to generate a simple, clean, single-color SVG icon based on the user's prompt.
- The SVG must be a single path or a few simple shapes.
- Use 'currentColor' for the fill color so it can be styled with CSS.
- Do not include any XML declaration or comments.
- The SVG must have a viewBox="0 0 24 24".
- The output must be ONLY the <svg> tag and its content, nothing else.
Example prompt: "a simple green leaf"
Example output: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 2C6.93 2 3.5 5.43 3.5 9.5c0 2.25 1.01 4.28 2.62 5.62L5 22h14l-1.12-6.88C19.49 13.78 20.5 11.75 20.5 9.5C20.5 5.43 17.07 2 13 2h-2z"></path></svg>`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "text/plain",
                temperature: 0.2
            }
        });
        
        let svgText = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = svgText.match(fenceRegex);
        if (match && match[2]) {
          svgText = match[2].trim();
        }

        if (!svgText.startsWith('<svg')) {
          throw new Error(`La IA no generó un icono SVG válido: ${svgText.substring(0, 50)}...`);
        }

        return svgText;

    } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Error al comunicarse con la IA para generar el icono.");
    }
};

export const generateCustomerInsights = async (
    customer: Customer,
    sales: Sale[],
    payments: Payment[],
    crateLoans: CrateLoan[],
    crateTypes: CrateType[]
): Promise<string> => {
    if (!ai) {
        return Promise.resolve("### Análisis de IA Desactivado\n\nLa API de IA no está configurada. No se pudo generar el resumen del cliente.");
    }

    const systemInstruction = `Eres un experto analista de negocios para un mayorista de frutas. Analiza el siguiente perfil de cliente y su historial. Genera un resumen conciso en formato Markdown. Tu análisis debe incluir:
1.  **Patrones de Compra:** ¿Qué productos, tamaños y calidades compra más? ¿Con qué frecuencia? ¿Qué días?
2.  **Comportamiento de Pago:** ¿Paga a tiempo? ¿Acumula deuda? ¿Es confiable?
3.  **Gestión de Activos:** ¿Devuelve las cajas prestadas puntualmente? ¿Tiene cajas vencidas?
4.  **Recomendaciones Clave:** Basado en los datos, sugiere la próxima acción de venta (qué ofrecer y cuándo) y una estrategia de cobranza si es necesario.

Usa títulos con '###' y listas con '*'. Sé directo, profesional y enfócate en información accionable.`;

    const salesHistory = sales
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15) // Limit to last 15 sales for brevity
        .map(s => `- ${new Date(s.timestamp).toLocaleDateString('es-MX')}: ${s.quantity} ${s.unit} de ${s.productGroupName} ${s.varietyName} ${s.size}. Total: ${s.price.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'})}. Estado de pago: ${s.paymentStatus}.`)
        .join('\n');
    
    const paymentHistory = payments
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map(p => `- ${new Date(p.date).toLocaleDateString('es-MX')}: Abono de ${p.amount.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'})}.`)
        .join('\n');

    const crateHistory = crateLoans
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map(l => {
            const typeName = crateTypes.find(ct => ct.id === l.crateTypeId)?.name || 'Caja Desconocida';
            return `- ${new Date(l.timestamp).toLocaleDateString('es-MX')}: ${l.quantity} x ${typeName}. Estado: ${l.status}. Vencimiento: ${new Date(l.dueDate).toLocaleDateString('es-MX')}.`
        }).join('\n');

    const prompt = `
# PERFIL DEL CLIENTE A ANALIZAR

**Nombre:** ${customer.name}
**Contactos/Apodos:** ${customer.contacts.map(c => c.name).join(', ')}
**Nivel de Confianza:** ${customer.creditStatus}
**Límite de Crédito:** ${customer.creditLimit ? customer.creditLimit.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'}) : 'N/A'}
**Horario de Compra:** ${customer.schedule ? `${customer.schedule.days.join(', ')} de ${customer.schedule.time}` : 'No especificado'}

---

## HISTORIAL DE PEDIDOS (Más recientes)
${salesHistory || 'Sin pedidos registrados.'}

---

## HISTORIAL DE PAGOS
${paymentHistory || 'Sin pagos registrados.'}

---

## HISTORIAL DE PRÉSTAMO DE CAJAS
${crateHistory || 'Sin préstamos de cajas registrados.'}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "text/plain",
                temperature: 0.5,
            }
        });

        return response.text.trim();

    } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Error al comunicarse con la IA para generar el resumen.");
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
    inventorySummary: { name: string; quantity: number; daysOnHand: number }[]
): Promise<string> => {
    if (!ai) {
        return Promise.resolve("### Inteligencia Fideo Desactivada\n- La API de IA no está configurada. No se pudieron generar insights.");
    }

    const systemInstruction = `Eres "Fideo", un analista de negocios experto para un mayorista de frutas. Analiza los datos del día y del inventario para generar 3 insights ACCIONABLES y concisos en formato Markdown (usando '*' para listas). Sé directo y enfócate en oportunidades de venta, optimización de inventario o mejoras de rentabilidad.`;

    const prompt = `
# DATOS DEL DÍA
- Ventas Totales: ${dailyStats.ventas.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
- Ganancia Bruta: ${dailyStats.ganancia.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
- Margen: ${dailyStats.margen.toFixed(1)}%
- Clientes más rentables: ${dailyStats.topCustomers.join(', ') || 'N/A'}
- Productos más rentables: ${dailyStats.topProducts.join(', ') || 'N/A'}

# INVENTARIO CLAVE
${inventorySummary.map(item => `- ${item.name}: ${item.quantity} cajas, ${item.daysOnHand.toFixed(1)} días restantes`).join('\n')}

# INSIGHTS ACCIONABLES:
`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "text/plain",
                temperature: 0.7,
                maxOutputTokens: 250,
            }
        });
        
        return response.text.trim();

    } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Error al comunicarse con la IA para generar insights.");
    }
};
