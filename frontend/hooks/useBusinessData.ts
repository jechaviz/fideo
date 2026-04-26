import { useState, useCallback, useEffect } from 'react';
import { 
    ParsedMessage, InterpretationType, Message, View, InventoryRecommendation,
    PurchaseOrderInterpretation, ActionItem, UserRole, BusinessState, ActionResult, SaleInterpretation,
    FixedAssetSaleInterpretation, PriceUpdateInterpretation, StateChangeInterpretation, 
    WarehouseTransferInterpretation, AssignmentInterpretation, CrateLoanInterpretation, 
    EmployeeCheckInInterpretation, ViewChangeInterpretation, FilterInterpretation, 
    OfferInterpretation
} from '../types';
import { generateCustomerInsights } from '../services/geminiService';
import * as InitialData from '../data/initialData';
import * as Logic from '../utils/businessLogic';
import { useInventoryActions } from './useInventoryActions';
import { useSalesActions } from './useSalesActions';
import { useCatalogActions } from './useCatalogActions';
import { useSystemActions } from './useSystemActions';

const BUSINESS_DATA_STORAGE_KEY = 'miApp/businessData';

const reviveDates = (key: string, value: unknown) => {
    const isISO8601 = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value);
    if (isISO8601) { return new Date(value); }
    return value;
};

const getInitialState = (): BusinessState => {
    try {
        const savedData = window.localStorage.getItem(BUSINESS_DATA_STORAGE_KEY);
        if (savedData) {
            const parsed = JSON.parse(savedData, reviveDates);
            if (!parsed.suppliers) parsed.suppliers = InitialData.INITIAL_SUPPLIERS;
            if (!parsed.purchaseOrders) parsed.purchaseOrders = InitialData.INITIAL_PURCHASE_ORDERS;
            if (!parsed.payments) parsed.payments = [];
            if (!parsed.crateTypes) parsed.crateTypes = InitialData.INITIAL_CRATE_TYPES;
            if (!parsed.crateInventory) parsed.crateInventory = InitialData.INITIAL_CRATE_INVENTORY;
            if (!parsed.aiCustomerSummary) parsed.aiCustomerSummary = null;
            if (parsed.isGeneratingSummary === undefined) parsed.isGeneratingSummary = false;
            if (!parsed.currentRole) parsed.currentRole = 'Admin';
            if (!parsed.cashDrawers) parsed.cashDrawers = [{ id: 'cd1', name: 'Caja Principal', balance: 5000, status: 'Cerrada' }];
            if (!parsed.cashDrawerActivities) parsed.cashDrawerActivities = [];
            if (!parsed.messageTemplates) parsed.messageTemplates = InitialData.INITIAL_MESSAGE_TEMPLATES;
            return parsed;
        }
    } catch (e) {
        console.error("Failed to load state from localStorage", e);
    }
    return {
        productGroups: InitialData.INITIAL_PRODUCT_GROUPS,
        warehouses: InitialData.INITIAL_WAREHOUSES,
        employees: InitialData.INITIAL_EMPLOYEES,
        prices: InitialData.INITIAL_PRICES,
        inventory: InitialData.INITIAL_INVENTORY,
        customers: InitialData.INITIAL_CUSTOMERS,
        suppliers: InitialData.INITIAL_SUPPLIERS,
        sales: [],
        payments: [],
        purchaseOrders: InitialData.INITIAL_PURCHASE_ORDERS,
        crateLoans: [],
        crateTypes: InitialData.INITIAL_CRATE_TYPES,
        crateInventory: InitialData.INITIAL_CRATE_INVENTORY,
        activities: [],
        activityLog: [],
        messages: InitialData.INITIAL_INTERPRETED_MESSAGES,
        systemPrompt: InitialData.INITIAL_SYSTEM_PROMPT,
        fixedAssets: InitialData.INITIAL_FIXED_ASSETS,
        expenses: InitialData.INITIAL_EXPENSES,
        categoryIcons: InitialData.INITIAL_CATEGORY_ICONS,
        sizes: InitialData.INITIAL_SIZES,
        qualities: InitialData.INITIAL_QUALITIES,
        stateIcons: InitialData.INITIAL_STATE_ICONS,
        ripeningRules: InitialData.INITIAL_RIPENING_RULES,
        inventoryRecommendations: [],
        actionItems: [],
        cashDrawers: [{ id: 'cd1', name: 'Caja Principal', balance: 5000, status: 'Cerrada' }],
        cashDrawerActivities: [],
        messageTemplates: InitialData.INITIAL_MESSAGE_TEMPLATES,
        aiCustomerSummary: null,
        isGeneratingSummary: false,
        theme: 'dark',
        currentView: 'dashboard',
        currentRole: 'Admin',
        currentCustomerId: null,
        currentSupplierId: null,
        productFilter: 'all',
        warehouseFilter: 'all',
        saleStatusFilter: 'all',
        paymentStatusFilter: 'all',
    };
};

export const useBusinessData = () => {
  const [state, setState] = useState<BusinessState>(getInitialState);

  const inventoryActions = useInventoryActions(setState);
  const salesActions = useSalesActions(setState);
  const catalogActions = useCatalogActions(setState);
  const systemActions = useSystemActions(setState);

  useEffect(() => {
    try { window.localStorage.setItem(BUSINESS_DATA_STORAGE_KEY, JSON.stringify(state)); } 
    catch (e) { console.error("Failed to save state to localStorage", e); }
  }, [state]);

  const addInterpretedMessage = useCallback((interpretation: ParsedMessage) => {
    const newMessage: Message = { id: `msg_reco_${Date.now()}`, sender: 'Sistema (Recomendación)', text: interpretation.originalMessage, timestamp: new Date(), status: 'interpreted', interpretation: interpretation };
    setState(s => ({ ...s, messages: [...s.messages, newMessage], currentView: 'messages' }));
  }, []);
  
  const generateActionItems = useCallback(() => {
    const items: ActionItem[] = [];
    const now = new Date();
    state.sales.filter(s => s.status === 'Pendiente de Empaque').forEach(sale => { items.push({ id: `action_pack_${sale.id}`, type: 'PACK_ORDER', title: `Empacar pedido para ${sale.customer}`, description: `${sale.quantity} ${sale.unit} de ${sale.varietyName} ${sale.size}`, relatedId: sale.id, cta: { text: 'Ver Entregas', targetView: 'deliveries' } }); });
    state.sales.filter(s => s.status === 'Listo para Entrega').forEach(sale => { items.push({ id: `action_assign_${sale.id}`, type: 'ASSIGN_DELIVERY', title: `Asignar repartidor para ${sale.customer}`, description: `${sale.quantity} ${sale.unit} de ${sale.varietyName} ${sale.size}`, relatedId: sale.id, cta: { text: 'Asignar', targetView: 'deliveries' } }); });
    state.crateLoans.filter(l => l.status === 'Prestado' && new Date(l.dueDate) < now).forEach(loan => { const crateType = state.crateTypes.find(ct => ct.id === loan.crateTypeId); items.push({ id: `action_crate_${loan.id}`, type: 'FOLLOW_UP_CRATE', title: `Seguimiento de caja vencida`, description: `${loan.quantity} x ${crateType?.name || 'Caja'} para ${loan.customer}`, relatedId: loan.id, cta: { text: 'Ver Cliente', targetView: 'customers' } }); });
    state.purchaseOrders.filter(po => po.status === 'Ordenado').forEach(po => { items.push({ id: `action_po_${po.id}`, type: 'CONFIRM_PURCHASE_ORDER', title: 'Confirmar recepción de mercancía', description: `De ${state.suppliers.find(s=>s.id === po.supplierId)?.name || 'N/A'}`, relatedId: po.id, cta: { text: 'Ver Orden', targetView: 'suppliers' } }); });
    state.inventory.forEach(batch => { if ((batch.state === 'Maduro' || batch.state === 'Suave') && batch.location === 'Cámara Fría') { const productInfo = state.productGroups.flatMap(pg => pg.varieties.map(v => ({...v, groupName: pg.name}))).find(v => v.id === batch.varietyId); items.push({ id: `action_move_out_${batch.id}`, type: 'SMART_MOVE', title: 'Sacar a Piso (Afuera)', description: `${batch.quantity} ${productInfo?.name} ${batch.size} (${batch.state}) en Cámara.`, relatedId: batch.id, cta: { text: 'Ir a Inventario', targetView: 'inventory' } }); } });
    setState(s => ({ ...s, actionItems: items }));
  }, [state.sales, state.crateLoans, state.purchaseOrders, state.suppliers, state.crateTypes, state.inventory, state.productGroups]);

  const generateProactiveRecommendations = useCallback(() => {
    let recommendations: InventoryRecommendation[] = [];
    const weekday = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const today = new Date();
    const todayDay = weekday[today.getDay()];
    state.customers.forEach(customer => {
        if (customer.schedule?.days.includes(todayDay)) {
            const customerDebt = state.sales.filter(s => s.customer === customer.name && s.paymentStatus === 'En Deuda' && s.status === 'Completado').reduce((sum, s) => sum + s.price, 0);
            const pendingCrates = state.crateLoans.filter(l => l.customer === customer.name && l.status === 'Prestado' && new Date(l.dueDate) < today);
            if (customerDebt > 1000 || pendingCrates.length > 0) {
                let message = `¡Hola ${customer.name}! ¿Te preparamos tu pedido de hoy?`;
                if (customerDebt > 1000) { const suggestedPayment = Math.round(customerDebt * 0.15 / 100) * 100; message += ` Para ayudarte a ponerte al día, ¿te gustaría abonar ${suggestedPayment.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} a tu cuenta?`; }
                if (pendingCrates.length > 0) { const crateCount = pendingCrates.reduce((sum, l) => sum + l.quantity, 0); message += ` Adicionalmente, te recordamos devolver ${crateCount} caja(s) pendiente(s).`; }
                recommendations.push({ id: `reco_msg_${customer.id}`, type: 'PROACTIVE_MESSAGE', reason: `${customer.name} tiene una deuda o cajas pendientes y compra los ${todayDay}.`, data: { customerName: customer.name, suggestedMessage: message } });
            }
        }
    });
    setState(s => ({ ...s, inventoryRecommendations: recommendations }));
  }, [state.customers, state.sales, state.crateLoans]);

  useEffect(() => {
    const recoTimer = setTimeout(generateProactiveRecommendations, 2000);
    const actionTimer = setTimeout(generateActionItems, 1000);
    return () => { clearTimeout(recoTimer); clearTimeout(actionTimer); };
  }, [generateProactiveRecommendations, generateActionItems]);

  const addMessage = useCallback((text: string, sender: string) => { setState(s => ({...s, messages: [...s.messages, { id: `msg_${Date.now()}`, sender, text, timestamp: new Date(), status: 'pending' }]})); }, []);
  const markMessageAsInterpreting = useCallback((messageId: string) => { setState(s => ({...s, messages: s.messages.map(msg => msg.id === messageId ? {...msg, status: 'interpreting'} : msg)})); }, []);
  const setInterpretationForMessage = useCallback((messageId: string, interpretation: ParsedMessage) => { setState(s => ({...s, messages: s.messages.map(msg => msg.id === messageId ? {...msg, interpretation, status: 'interpreted'} : msg)})); }, []);
  
  const approveInterpretation = useCallback((messageId: string) => {
    setState(s => {
        const message = s.messages.find(m => m.id === messageId);
        if (!message || !message.interpretation) return s;
        const { interpretation } = message;
        let result: ActionResult = { nextState: s };
        switch (interpretation.type) {
            case InterpretationType.VENTA: result = Logic.addSaleAction(s, interpretation as SaleInterpretation); break;
            case InterpretationType.ORDEN_COMPRA: result = Logic.addPurchaseOrderAction(s, interpretation as PurchaseOrderInterpretation); break;
            case InterpretationType.VENTA_ACTIVO_FIJO: result = Logic.addFixedAssetSaleAction(s, interpretation as FixedAssetSaleInterpretation); break;
            case InterpretationType.ACTUALIZACION_PRECIO: result = Logic.updatePriceAction(s, interpretation as PriceUpdateInterpretation); break;
            case InterpretationType.MOVIMIENTO_ESTADO: result.nextState = Logic.changeProductStateAction(s, interpretation as StateChangeInterpretation); break;
            case InterpretationType.TRANSFERENCIA_BODEGA: result.nextState = Logic.transferWarehouseAction(s, interpretation as WarehouseTransferInterpretation); break;
            case InterpretationType.ASIGNACION_ENTREGA: result.nextState = Logic.assignDeliveryAction(s, interpretation as AssignmentInterpretation); break;
            case InterpretationType.PRESTAMO_CAJA: result = Logic.addCrateLoanAction(s, interpretation as CrateLoanInterpretation); break;
            case InterpretationType.LLEGADA_EMPLEADO: result.nextState = Logic.addActivityAction(s, interpretation as EmployeeCheckInInterpretation); break;
            case InterpretationType.CAMBIO_VISTA: result.nextState = Logic.changeViewAction(s, interpretation as ViewChangeInterpretation); break;
            case InterpretationType.APLICAR_FILTRO: result.nextState = Logic.applyFilterAction(s, interpretation as FilterInterpretation); break;
            case InterpretationType.CREAR_OFERTA: result.nextState = Logic.createOfferAction(s, interpretation as OfferInterpretation); break;
        }
        const finalMessages: Message[] = result.nextState.messages.map(msg => { if (msg.id === messageId) return { ...msg, status: 'approved' }; return msg; });
        if(result.notification) { finalMessages.push({ id: `msg_sys_${Date.now()}`, sender: 'Sistema', text: result.notification.text, timestamp: new Date(), status: 'approved', isSystemNotification: true }); }
        return {...result.nextState, messages: finalMessages};
    });
  }, []);

  const generateCustomerSummary = useCallback(async (customerId: string) => {
    setState(s => ({ ...s, isGeneratingSummary: true, aiCustomerSummary: null }));
    const customer = state.customers.find(c => c.id === customerId);
    if (!customer) { setState(s => ({...s, isGeneratingSummary: false, aiCustomerSummary: { content: '', error: 'Cliente no encontrado' }})); return; }
    const customerSales = state.sales.filter(sale => sale.customer === customer.name);
    const customerPayments = state.payments.filter(p => p.customerId === customerId);
    const customerCrateLoans = state.crateLoans.filter(l => l.customer === customer.name);
    try {
        const summary = await generateCustomerInsights(customer, customerSales, customerPayments, customerCrateLoans, state.crateTypes);
        setState(s => ({ ...s, isGeneratingSummary: false, aiCustomerSummary: { content: summary, error: null } }));
    } catch (e: unknown) {
        setState(s => ({ ...s, isGeneratingSummary: false, aiCustomerSummary: { content: '', error: e instanceof Error ? e.message : 'Error al generar resumen.' } }));
    }
  }, [state]);

  // Adjust implementations that need state/logic not in SystemActions but conceptually there
  const setCurrentRole = useCallback((role: UserRole, entityId?: string) => {
    setState(s => {
        let customerId: string | null = null;
        let supplierId: string | null = null;
        if (role === 'Cliente') customerId = entityId || s.customers[0]?.id || null;
        if (role === 'Proveedor') supplierId = entityId || s.suppliers[0]?.id || null;
        return { ...s, currentRole: role, currentCustomerId: customerId, currentSupplierId: supplierId };
    });
  }, []);

  const toggleTheme = useCallback(() => setState(s => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' })), []);
  const setCurrentView = useCallback((view: View) => { setState(s => ({ ...s, currentView: view, aiCustomerSummary: view !== 'customers' ? null : s.aiCustomerSummary })); }, []);

  return {
    ...state,
    ...inventoryActions,
    ...salesActions,
    ...catalogActions,
    ...systemActions,
    setCurrentRole, // Override systemActions.setCurrentRole since we have a smarter one
    toggleTheme, // Override since systemActions expects a ThemeInfo string but we toggle it
    setCurrentView, // Override to clear aiCustomerSummary
    addMessage,
    markMessageAsInterpreting,
    setInterpretationForMessage,
    approveInterpretation,
    addInterpretedMessage,
    generateCustomerSummary,
  };
};

export type BusinessData = ReturnType<typeof useBusinessData>;
