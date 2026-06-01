import { makeId, nowIso, pushLog, receipt } from '../core/events.js';
import { createPurchaseOrder } from '../suppliers/supplierActions.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export const InterpretationType = {
  offer: 'CREAR_OFERTA',
  purchaseOrder: 'ORDEN_COMPRA',
  priceUpdate: 'ACTUALIZACION_PRECIO',
  unknown: 'DESCONOCIDO',
};

const updateMessage = (state, messageId, updater) => {
  const index = state.messages.findIndex((message) => message.id === messageId);
  if (index < 0) return null;
  state.messages[index] = updater(state.messages[index]);
  return state.messages[index];
};

const buildUnknownInterpretation = (message, explanation = 'No se identifico una accion operativa.') => ({
  type: InterpretationType.unknown,
  certainty: 0,
  explanation,
  data: {},
  originalMessage: message.text,
  sender: message.sender,
});

const parseLocalInterpretation = (message) => {
  const text = `${message.text} ${message.sender}`.toLowerCase();
  if (text.includes('oferta') || text.includes('promo')) {
    return {
      type: InterpretationType.offer,
      certainty: 0.74,
      explanation: 'Mensaje detectado como oportunidad comercial.',
      data: { targetAudience: 'clientes activos', productDescription: message.text, price: 0 },
      originalMessage: message.text,
      sender: message.sender,
    };
  }
  if (text.includes('compra') || text.includes('proveedor')) {
    return {
      type: InterpretationType.purchaseOrder,
      certainty: 0.68,
      explanation: 'Mensaje detectado como orden de compra.',
      data: { supplierId: 'sup-huerta', varietyId: 'var-mango-ataulfo', size: 'Mediano', packaging: 'Caja', quantity: 10 },
      originalMessage: message.text,
      sender: message.sender,
    };
  }
  if (text.includes('precio')) {
    return {
      type: InterpretationType.priceUpdate,
      certainty: 0.62,
      explanation: 'Mensaje detectado como ajuste de precio.',
      data: { note: message.text },
      originalMessage: message.text,
      sender: message.sender,
    };
  }
  return buildUnknownInterpretation(message);
};

const restoreState = (state, snapshot) => {
  Object.keys(state).forEach((key) => { delete state[key]; });
  Object.assign(state, clone(snapshot));
};

export const addMessage = (state, text, sender = 'WhatsApp') => {
  const cleanText = String(text || '').trim();
  if (!cleanText) return receipt('message_add', 'skipped', 'Mensaje vacio.');
  const message = {
    id: makeId('msg'),
    sender,
    text: cleanText,
    timestamp: nowIso(),
    status: 'pending',
  };
  state.messages.push(message);
  return receipt('message_add', 'ok', 'Mensaje recibido.', { messageId: message.id });
};

export const interpretMessage = (state, messageId) => {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) return receipt('message_interpret', 'skipped', 'Mensaje no encontrado.');
  if (message.status === 'approved') return receipt('message_interpret', 'skipped', 'Mensaje ya aprobado.');
  const interpretation = parseLocalInterpretation(message);
  message.interpretation = interpretation;
  message.status = 'interpreted';
  pushLog(state, 'MENSAJE_INTERPRETADO', `Mensaje interpretado: ${interpretation.type}`, {
    Certeza: interpretation.certainty,
  });
  return receipt('message_interpret', 'ok', 'Mensaje interpretado.', { messageId, interpretation });
};

export const correctInterpretation = (state, messageId, interpretation) => {
  const original = state.messages.find((item) => item.id === messageId);
  if (!original) return receipt('message_correct', 'skipped', 'Mensaje no encontrado.');
  updateMessage(state, messageId, (message) => ({
    ...message,
    interpretation: {
      ...interpretation,
      certainty: Math.min(1, Math.max(0, Number(interpretation.certainty ?? 1))),
      originalMessage: interpretation.originalMessage || message.text,
      sender: interpretation.sender || message.sender,
    },
    status: 'interpreted',
    undoState: {
      ...message.undoState,
      correction: {
        previousInterpretation: message.interpretation,
        previousStatus: message.status,
      },
    },
  }));
  return receipt('message_correct', 'ok', 'Interpretacion corregida.', { messageId });
};

export const approveInterpretation = (state, messageId) => {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message?.interpretation) return receipt('message_approve', 'skipped', 'Interpretacion no encontrada.');
  const snapshot = clone(state);
  const interpretation = message.interpretation;

  if (interpretation.type === InterpretationType.offer) {
    pushLog(state, 'OFERTA_ENVIADA', `Oferta creada para ${interpretation.data.targetAudience || 'clientes'}`, {
      Producto: interpretation.data.productDescription || message.text,
    });
  }
  if (interpretation.type === InterpretationType.purchaseOrder) {
    createPurchaseOrder(state, interpretation.data);
  }

  updateMessage(state, messageId, (current) => ({
    ...current,
    status: 'approved',
    undoState: {
      ...current.undoState,
      approval: { snapshot, previousStatus: current.status },
    },
  }));
  return receipt('message_approve', 'ok', 'Interpretacion aprobada.', { messageId });
};

export const revertInterpretation = (state, messageId) => {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) return receipt('message_revert', 'skipped', 'Mensaje no encontrado.');
  const approvalSnapshot = message.undoState?.approval?.snapshot;
  if (approvalSnapshot) {
    restoreState(state, approvalSnapshot);
    return receipt('message_revert', 'ok', 'Aprobacion revertida.', { messageId });
  }
  const correction = message.undoState?.correction;
  if (!correction) return receipt('message_revert', 'skipped', 'No hay cambio para revertir.');
  updateMessage(state, messageId, (current) => {
    const undoState = { ...current.undoState };
    delete undoState.correction;
    return {
      ...current,
      interpretation: correction.previousInterpretation,
      status: correction.previousStatus,
      undoState: Object.keys(undoState).length ? undoState : undefined,
    };
  });
  return receipt('message_revert', 'ok', 'Correccion revertida.', { messageId });
};

export const updateMessageTemplate = (state, templateId, updates) => {
  const template = state.messageTemplates.find((item) => item.id === templateId);
  if (!template) return receipt('message_template_update', 'skipped', 'Plantilla no encontrada.');
  Object.assign(template, updates);
  return receipt('message_template_update', 'ok', `Plantilla actualizada: ${template.name}`, { templateId });
};

export const updateSystemPrompt = (state, prompt) => {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) return receipt('ai_prompt_update', 'skipped', 'Prompt vacio.');
  state.systemPrompt = cleanPrompt;
  pushLog(state, 'PLANTILLA_MENSAJE_UPD', 'Prompt de IA actualizado', { Longitud: cleanPrompt.length });
  return receipt('ai_prompt_update', 'ok', 'Prompt de IA actualizado.');
};

export const appendTrainingKnowledge = (state, note) => {
  const cleanNote = String(note || '').trim();
  if (!cleanNote) return receipt('ai_training_note', 'skipped', 'Nota de entrenamiento vacia.');
  const separator = state.systemPrompt?.trim() ? '\n' : '';
  state.systemPrompt = `${state.systemPrompt || ''}${separator}- Jerga adicional: "${cleanNote}".`;
  pushLog(state, 'PLANTILLA_MENSAJE_UPD', 'Conocimiento agregado a IA', { Nota: cleanNote });
  return receipt('ai_training_note', 'ok', 'Conocimiento agregado a IA.', { note: cleanNote });
};

export const generateOfferMessage = (idea) =>
  `Oferta Fideo: ${String(idea || 'producto destacado').trim()}. Responde para reservar hoy.`;

export const sendPromotion = (state, message, customerIds) => {
  const targets = state.customers.filter((customer) => customerIds.includes(customer.id));
  if (!message || targets.length === 0) return receipt('promotion_send', 'skipped', 'Promocion incompleta.');
  targets.forEach((customer) => {
    state.messages.push({
      id: makeId('promo'),
      sender: 'Fideo',
      text: `${customer.name}: ${message}`,
      timestamp: nowIso(),
      status: 'approved',
      isSystemNotification: true,
    });
  });
  pushLog(state, 'OFERTA_ENVIADA', 'Campana promocional enviada', {
    Clientes: targets.length,
  });
  return receipt('promotion_send', 'ok', `Promocion enviada a ${targets.length} clientes.`, {
    targets: targets.map((customer) => customer.id),
  });
};
