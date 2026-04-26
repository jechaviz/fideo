import React, { useCallback } from 'react';
import { BusinessState, UserRole, SaleStatus, PaymentStatus, ActivityLog, View, MessageTemplate, CashDrawerActivity, ProactiveMessageRecommendation } from '../types';

const isProactiveMessageRecommendation = (
  recommendation: BusinessState['inventoryRecommendations'][number],
): recommendation is ProactiveMessageRecommendation => recommendation.type === 'PROACTIVE_MESSAGE';

export const useSystemActions = (setState: React.Dispatch<React.SetStateAction<BusinessState>>) => {
  const toggleTheme = useCallback((theme: 'light' | 'dark') => { setState((s) => ({ ...s, theme })); }, [setState]);
  const setCurrentView = useCallback((view: View) => { setState((s) => ({ ...s, currentView: view })); }, [setState]);
  const setCurrentRole = useCallback((role: UserRole) => { setState((s) => ({ ...s, currentRole: role })); }, [setState]);
  
  const setProductFilter = useCallback((filter: string) => { setState((s) => ({ ...s, productFilter: filter })); }, [setState]);
  const setWarehouseFilter = useCallback((filter: string) => { setState((s) => ({ ...s, warehouseFilter: filter })); }, [setState]);
  const setSaleStatusFilter = useCallback((filter: SaleStatus | 'all') => { setState((s) => ({ ...s, saleStatusFilter: filter })); }, [setState]);
  const setPaymentStatusFilter = useCallback((filter: PaymentStatus | 'all') => { setState((s) => ({ ...s, paymentStatusFilter: filter })); }, [setState]);

  const sendPromotion = useCallback((channel: 'whatsapp' | 'email' | 'sms', targetAudience: string, message: string) => {
      setState(s => {
          const newLog: ActivityLog = { id: `log_promo_${Date.now()}`, type: 'OFERTA_ENVIADA', timestamp: new Date(), description: `Campaña promocional enviada por ${channel}`, details: { Audiencia: targetAudience, Mensaje: message.substring(0, 50) + '...' } };
          return { ...s, activityLog: [newLog, ...s.activityLog] };
      });
  }, [setState]);

  const acceptProactiveMessage = useCallback((actionId: string, channel: 'whatsapp' | 'email' | 'sms') => {
      setState(s => {
          const action = s.inventoryRecommendations.find(r => r.id === actionId);
          if (!action || !isProactiveMessageRecommendation(action)) return s;
          const newLog: ActivityLog = { id: `log_proactive_${Date.now()}`, type: 'OFERTA_ENVIADA', timestamp: new Date(), description: `Mensaje proactivo enviado por ${channel}`, details: { Tipo: action.type, Mensaje: action.data.suggestedMessage.substring(0, 50) + '...' } };
          return { ...s, activityLog: [newLog, ...s.activityLog] };
      });
  }, [setState]);
  
  const updateMessageTemplate = useCallback((templateId: string, updates: Partial<MessageTemplate>) => {
    setState(s => ({ ...s, messageTemplates: s.messageTemplates.map(t => t.id === templateId ? { ...t, ...updates } : t) }));
  }, [setState]);

  const setSystemPrompt = useCallback((prompt: string) => {
      setState(s => ({ ...s, systemPrompt: prompt }));
  }, [setState]);

  const openCashDrawer = useCallback((drawerId: string, initialBalance: number, notes?: string): Promise<{success: boolean, message: string}> => {
    return new Promise((resolve) => {
        setState(s => {
            const drawer = s.cashDrawers.find(d => d.id === drawerId);
            if (!drawer) { resolve({success: false, message: 'Caja no encontrada.'}); return s; }
            if (drawer.status === 'Abierta') { resolve({success: false, message: 'La caja ya está abierta.'}); return s; }
            const newActivity: CashDrawerActivity = { id: `cda_${Date.now()}`, drawerId, type: 'SALDO_INICIAL', amount: initialBalance, timestamp: new Date(), notes: notes || 'Apertura de caja' };
            const newLog: ActivityLog = { id: `log_drawer_open_${Date.now()}`, type: 'CAJA_OPERACION', timestamp: new Date(), description: `Apertura de caja: ${drawer.name}`, details: { SaldoInicial: initialBalance } };
            resolve({success: true, message: 'Caja abierta con éxito.'});
            return { ...s, cashDrawers: s.cashDrawers.map(d => d.id === drawerId ? { ...d, status: 'Abierta', balance: initialBalance, lastOpened: new Date() } : d), cashDrawerActivities: [newActivity, ...s.cashDrawerActivities], activityLog: [newLog, ...s.activityLog] };
        });
    });
  }, [setState]);
  
  const closeCashDrawer = useCallback((drawerId: string, finalBalance: number, notes?: string): Promise<{success: boolean, message: string}> => {
    return new Promise((resolve) => {
        setState(s => {
            const drawer = s.cashDrawers.find(d => d.id === drawerId);
            if (!drawer) { resolve({success: false, message: 'Caja no encontrada.'}); return s; }
            if (drawer.status === 'Cerrada') { resolve({success: false, message: 'La caja ya está cerrada.'}); return s; }
            const difference = finalBalance - drawer.balance;
            let type: CashDrawerActivity['type'] = 'CORTE_CIERRE';
            if (difference !== 0) type = 'CORTE_CIERRE'; 
            const activitiesToAdd: CashDrawerActivity[] = [];
            if (difference !== 0) { activitiesToAdd.push({ id: `cda_diff_${Date.now()}`, drawerId, type, amount: Math.abs(difference), timestamp: new Date(), notes: `Diferencia al cierre: ${difference}` }); }
            activitiesToAdd.push({ id: `cda_close_${Date.now()}`, drawerId, type: 'CORTE_CIERRE', amount: finalBalance, timestamp: new Date(), notes: notes || 'Cierre de caja' });
            const newLog: ActivityLog = { id: `log_drawer_close_${Date.now()}`, type: 'CAJA_OPERACION', timestamp: new Date(), description: `Cierre de caja: ${drawer.name}`, details: { SaldoFinal: finalBalance, Diferencia: difference > 0 ? `+${difference}` : difference.toString() } };
            resolve({success: true, message: `Caja cerrada.${difference !== 0 ? ` Diferencia: ${difference}` : ''}`});
            return { ...s, cashDrawers: s.cashDrawers.map(d => d.id === drawerId ? { ...d, status: 'Cerrada', balance: 0, lastClosed: new Date() } : d), cashDrawerActivities: [...activitiesToAdd, ...s.cashDrawerActivities], activityLog: [newLog, ...s.activityLog] };
        });
    });
  }, [setState]);

  return { toggleTheme, setCurrentView, setCurrentRole, setProductFilter, setWarehouseFilter, setSaleStatusFilter, setPaymentStatusFilter, sendPromotion, acceptProactiveMessage, updateMessageTemplate, setSystemPrompt, openCashDrawer, closeCashDrawer };
};
