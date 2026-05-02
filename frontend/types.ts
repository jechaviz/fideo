
export type FruitState = 'Verde' | 'Entrado' | 'Maduro' | 'Suave';
export type Quality = 'Normal' | 'Con Defectos' | 'Merma';
export type CreditStatus = 'Confiable' | 'En Observación' | 'Contado Solamente';
export type UserRole = 'Admin' | 'Repartidor' | 'Empacador' | 'Cajero' | 'Cliente' | 'Proveedor';

export type StorageLocation = 'Cámara Fría' | 'Maduración' | 'Piso de Venta';
export type SaleStatus = 'Pendiente de Empaque' | 'Listo para Entrega' | 'En Ruta' | 'Completado' | 'Cancelado';
export type PaymentStatus = 'Pagado' | 'En Deuda' | 'Pendiente';
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Crédito' | 'N/A';
export type ActivityType = 'VENTA' | 'PRESTAMO_CAJA' | 'MOVIMIENTO_ESTADO' | 'ACTUALIZACION_PRECIO' | 'LLEGADA_EMPLEADO' | 'TRANSFERENCIA_BODEGA' | 'ASIGNACION_ENTREGA' | 'COMPLETA_VENTA' | 'INVENTARIO_AJUSTE' | 'PRODUCTO_CRUD' | 'GASTO' | 'NAVEGACION' | 'FILTRO' | 'MERMA_REGISTRO' | 'BODEGA_CRUD' | 'TICKET_ENVIADO' | 'PAGO_REGISTRADO' | 'PAGO_VENCIDO_ALERTA' | 'OFERTA_ENVIADA' | 'MOVIMIENTO_CALIDAD' | 'REGLA_MADURACION_CRUD' | 'PROVEEDOR_CRUD' | 'ORDEN_COMPRA_CRUD' | 'PAYMENT_CRUD' | 'CREDIT_REJECTED' | 'CREDIT_LIMIT_EXCEEDED' | 'VENTA_ACTIVO_CRUD' | 'DEVOLUCION_CAJA_CRUD' | 'CAJA_NO_DEVUELTA' | 'PEDIDO_EMPACADO' | 'CAJA_OPERACION' | 'PLANTILLA_MENSAJE_UPD';
export type View = 'dashboard' | 'messages' | 'deliveries' | 'salesLog' | 'inventory' | 'customers' | 'history' | 'training' | 'settings' | 'assets' | 'finances' | 'promotions' | 'ripening' | 'suppliers' | 'actions' | 'planogram';


export type FixedAssetCategory = 'Vehículos' | 'Equipo de Carga' | 'Contenedores' | 'Mobiliario' | 'Electrónicos' | 'Básculas';
export type AssetStatus = 'Operativo' | 'Dañado' | 'En Reparación' | 'Fuera de Servicio';

export interface FixedAsset {
    id: string;
    name: string;
    category: FixedAssetCategory;
    status: AssetStatus;
    purchaseDate: Date;
    cost: number;
    metadata: Record<string, string | number>;
    photoUrl?: string;
}

export type CrateLoanStatus = 'Prestado' | 'Devuelto' | 'No Devuelto';

export interface CrateType {
    id: string;
    name: string; // e.g., "Caja Grande Verde"
    shortCode: string; // e.g., "GF", "M", "R"
    color: string;
    size: string;
    cost: number;
    capacity: number; // Capacity in Kg
    dimensions?: {
        width: number; // cm
        depth: number; // cm
        height: number; // cm
    };
}

export interface CrateInventory {
    crateTypeId: string;
    quantityOwned: number;
}


export type ExpenseCategory = 'Reparación' | 'Compra Activo' | 'Combustible' | 'Servicios' | 'Merma' | 'Otros';

export interface Expense {
    id: string;
    description: string;
    amount: number;
    date: Date;
    category: ExpenseCategory;
    relatedAssetId?: string;
}

export interface RipeningRule {
    id: string;
    varietyId: string;
    fromState: FruitState;
    toState: FruitState;
    days: number;
}

export type RecommendationActionType = 'MOVE_INVENTORY' | 'PURCHASE_ORDER' | 'PROACTIVE_MESSAGE';

export interface InventoryRecommendation {
  id: string;
  reason: string;
  type: RecommendationActionType;
  data: StateChangeInterpretation | PurchaseOrderInterpretation | { customerName: string; suggestedMessage: string; };
}

export interface ProactiveMessageRecommendation extends InventoryRecommendation {
    type: 'PROACTIVE_MESSAGE';
    data: {
        customerName: string;
        suggestedMessage: string;
    };
}

export type ActionItemType = 'PACK_ORDER' | 'ASSIGN_DELIVERY' | 'CONFIRM_PURCHASE_ORDER' | 'FOLLOW_UP_CRATE' | 'SMART_MOVE';

export type TaskRole = 'Admin' | 'Repartidor' | 'Empacador' | 'Cajero';
export type TaskStatus = 'assigned' | 'acknowledged' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'normal' | 'high';
export type TaskAssignmentKind = 'PACK_ORDER' | 'ASSIGN_DELIVERY' | 'DELIVER_ORDER';
export type TaskReportKind = 'note' | 'incident' | 'blocker' | 'completion';
export type TaskReportSeverity = 'normal' | 'high';
export type TaskReportStatus = 'open' | 'resolved';
export type TaskReportEscalationStatus = 'none' | 'pending' | 'sent';
export type PresenceRosterStatus = 'active' | 'background' | 'idle' | 'offline';
export type OperationalExceptionKind = 'task_report' | 'task_blocked' | 'cash_drawer' | 'sla' | 'system' | 'other';
export type OperationalExceptionSeverity = 'normal' | 'high' | 'critical';
export type OperationalExceptionStatus = 'open' | 'acknowledged' | 'resolved';

export interface OperationalExceptionResolveInput {
    resolutionNote?: string;
    nextTaskStatus?: TaskStatus;
}

export interface OperationalExceptionReassignInput {
    employeeId: string;
    employeeName?: string | null;
    nextTaskStatus?: TaskStatus;
    reason?: string;
}

export interface OperationalExceptionFollowUpInput {
    note?: string;
    reason?: string;
    employeeId?: string | null;
    employeeName?: string | null;
    nextTaskStatus?: TaskStatus;
}

export interface TaskAssignment {
    id: string;
    kind: TaskAssignmentKind;
    role: TaskRole;
    status: TaskStatus;
    title: string;
    description: string;
    saleId?: string;
    employeeId?: string | null;
    employeeName?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    priority: TaskPriority;
    createdAt: Date;
    updatedAt: Date;
    acknowledgedAt?: Date;
    startedAt?: Date;
    blockedAt?: Date;
    completedAt?: Date;
    blockReason?: string;
}

export interface TaskReportInput {
    kind: TaskReportKind;
    summary: string;
    detail?: string;
    severity?: TaskReportSeverity;
    evidence?: string;
    nextTaskStatus?: TaskStatus;
}

export interface TaskReport {
    id: string;
    taskId: string;
    saleId?: string | null;
    role: TaskRole;
    employeeId?: string | null;
    employeeName?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    taskTitle: string;
    kind: TaskReportKind;
    status: TaskReportStatus;
    severity: TaskReportSeverity;
    summary: string;
    detail?: string;
    evidence?: string;
    escalationStatus: TaskReportEscalationStatus;
    createdAt: Date;
    resolvedAt?: Date;
    escalatedAt?: Date;
}

export interface PresenceRosterEntry {
    id: string;
    actorId?: string | null;
    workspaceId?: string | null;
    employeeId?: string | null;
    employeeName?: string | null;
    name: string;
    role: UserRole;
    status: PresenceRosterStatus;
    lastSeenAt?: Date | null;
    sessionKey?: string | null;
    sessionId?: string | null;
    deviceId?: string | null;
    deviceName?: string | null;
    installationId?: string | null;
    platform?: string | null;
    appVersion?: string | null;
    pushExternalId?: string | null;
    meta?: Record<string, unknown> | null;
}

export interface OperationalException {
    id: string;
    kind: OperationalExceptionKind;
    severity: OperationalExceptionSeverity;
    status: OperationalExceptionStatus;
    title: string;
    summary: string;
    detail?: string;
    createdAt: Date;
    updatedAt?: Date;
    resolvedAt?: Date;
    lastSeenAt?: Date;
    workspaceId?: string | null;
    role?: TaskRole | UserRole | null;
    employeeId?: string | null;
    employeeName?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    taskId?: string | null;
    saleId?: string | null;
    reportId?: string | null;
    drawerId?: string | null;
    drawerName?: string | null;
    escalationStatus?: TaskReportEscalationStatus | null;
    source?: string | null;
    meta?: Record<string, unknown> | null;
}

export interface ActionItem {
    id: string;
    type: ActionItemType;
    title: string;
    description: string;
    relatedId: string; // e.g., saleId, purchaseOrderId, crateLoanId
    cta: {
        text: string;
        targetView: View;
    }
}

export interface PackagingOption {
    name: string; // e.g., "Caja 10kg", "Arpilla", "Tonelada"
    cost: number; // additional cost for this packaging
}

export interface SuppliedProduct {
    varietyId: string;
    baseCost: number; // Cost per unit (e.g., per caja)
    freightCost: number; // Cost per unit
    availableSizes: string[];
    packagingOptions: PackagingOption[];
    notes?: string; // e.g., "Fruta de invernadero, madura más lento"
}

export interface Supplier {
    id: string;
    name: string;
    contact: string;
    supplies: SuppliedProduct[];
}

export interface PurchaseOrder {
    id: string;
    supplierId: string;
    varietyId: string;
    size: string;
    packaging: string;
    quantity: number;
    totalCost: number;
    status: 'Pendiente' | 'Ordenado' | 'Recibido';
    orderDate: Date;
    expectedArrivalDate?: Date;
    paymentMethod: PaymentMethod;
}

export interface ProductVariety {
  id: string;
  name: string;
  icon: string;
  aliases: string[];
  sizes: string[];
  archived: boolean;
}

export interface ProductGroup {
  id: string;
  name:string;
  icon: string;
  category: string;
  unit: 'cajas' | 'kilos' | 'unidades';
  varieties: ProductVariety[];
  archived: boolean;
}

export interface Employee {
    id: string;
    name: string;
    role: UserRole;
}

export interface Warehouse {
    id: string;
    name: string;
    icon: string;
    archived: boolean;
}

export interface Price {
    varietyId: string;
    size: string;
    quality: Quality;
    state: FruitState;
    price: number;
}

export interface InventoryBatch {
  id: string;
  varietyId: string;
  size: string;
  quality: Quality;
  quantity: number;
  state: FruitState;
  location: StorageLocation;
  warehouseId: string;
  packagingId?: string;
  entryDate: Date;
}

export interface Customer {
    id: string;
    name: string;
    contacts: { name: string; isPrimary: boolean }[];
    specialPrices: {
        varietyId: string;
        size: string;
        quality: Quality;
        state: FruitState;
        price: number;
    }[];
    schedule?: {
        days: string[];
        time: string;
    };
    deliveryNotes?: string;
    creditStatus: CreditStatus;
    creditLimit?: number;
}

export interface Payment {
    id: string;
    customerId: string;
    amount: number;
    date: Date;
    saleId?: string; // Link payment to a specific sale if applicable
}

export interface Sale {
  id:string;
  productGroupId: string;
  varietyId: string;
  customerId?: string;
  productGroupName: string;
  varietyName: string;
  size: string;
  quality: Quality;
  state: FruitState;
  quantity: number;
  price: number;
  cogs: number; // Cost of Goods Sold for this sale
  unit: string;
  customer: string;
  destination: string;
  locationQuery?: string;
  status: SaleStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentNotes?: string;
  assignedEmployeeId?: string;
  timestamp: Date;
  deliveryDeadline: Date;
}

export interface CrateLoan {
  id: string;
  customerId?: string;
  customer: string;
  crateTypeId: string;
  quantity: number;
  timestamp: Date;
  dueDate: Date;
  status: CrateLoanStatus;
}

export interface EmployeeActivity {
  id: string;
  employee: string;
  activity: string;
  timestamp: Date;
}

export interface ActivityLog {
    id: string;
    type: ActivityType;
    timestamp: Date;
    description: string;
    details: Record<string, string | number>;
}

export type MessageStatus = 'pending' | 'interpreting' | 'interpreted' | 'approved';

export interface MessageUndoState {
  correction?: {
    actionId?: string;
    previousInterpretation?: ParsedMessage;
    previousStatus: MessageStatus;
  };
  approval?: {
    actionId?: string;
    snapshot?: Record<string, unknown>;
    previousStatus: MessageStatus;
  };
}

export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  status: MessageStatus;
  interpretation?: ParsedMessage;
  isSystemNotification?: boolean;
  undoState?: MessageUndoState;
}

export type CashDrawerStatus = 'Abierta' | 'Cerrada';

export interface CashDrawer {
    id: string;
    name: string;
    balance: number;
    status: CashDrawerStatus;
    lastOpened?: Date;
    lastClosed?: Date;
}

export type CashDrawerActivityType = 'INGRESO_VENTA' | 'EGRESO_COMPRA' | 'DEPOSITO_BANCO' | 'RETIRO_EFECTIVO' | 'SALDO_INICIAL' | 'CORTE_CIERRE';

export interface CashDrawerActivity {
    id: string;
    drawerId: string;
    type: CashDrawerActivityType;
    amount: number; // positive for income, negative for outcome
    timestamp: Date;
    notes?: string;
    relatedId?: string; // saleId, purchaseOrderId, etc.
}

export type MessageTemplateType = 'ticket' | 'payment_reminder' | 'promotion' | 'welcome';

export interface MessageTemplate {
    id: string;
    type: MessageTemplateType;
    name: string;
    content: string;
    variables: string[]; // e.g., ['{nombre}', '{total}']
}


export enum InterpretationType {
    VENTA = "VENTA",
    ACTUALIZACION_INVENTARIO = "ACTUALIZACION_INVENTARIO",
    LLEGADA_EMPLEADO = "LLEGADA_EMPLEADO",
    PRESTAMO_CAJA = "PRESTAMO_CAJA",
    ACTUALIZACION_PRECIO = "ACTUALIZACION_PRECIO",
    MOVIMIENTO_ESTADO = "MOVIMIENTO_ESTADO",
    MOVIMIENTO_CALIDAD = "MOVIMIENTO_CALIDAD",
    TRANSFERENCIA_BODEGA = "TRANSFERENCIA_BODEGA",
    ASIGNACION_ENTREGA = "ASIGNACION_ENTREGA",
    CAMBIO_VISTA = "CAMBIO_VISTA",
    APLICAR_FILTRO = "APLICAR_FILTRO",
    CREAR_OFERTA = "CREAR_OFERTA",
    ORDEN_COMPRA = "ORDEN_COMPRA",
    VENTA_ACTIVO_FIJO = "VENTA_ACTIVO_FIJO",
    CONSULTA = "CONSULTA",
    DESCONOCIDO = "DESCONOCIDO",
}

export interface BaseInterpretation {
    type: InterpretationType;
    originalMessage: string;
    certainty: number;
    explanation: string;
    sender?: string;
}

export interface SaleInterpretation extends BaseInterpretation {
    type: InterpretationType.VENTA;
    data: {
        productGroup: string;
        variety: string;
        size: string;
        quality?: Quality;
        state: FruitState;
        quantity: number;
        unit: string;
        customer: string;
        destination?: string;
        locationQuery?: string;
        suggestedPayment?: number;
    };
}

export interface FixedAssetSaleInterpretation extends BaseInterpretation {
    type: InterpretationType.VENTA_ACTIVO_FIJO;
    data: {
        customer: string;
        assetName: string;
        quantity: number;
    };
}

export interface OfferInterpretation extends BaseInterpretation {
    type: InterpretationType.CREAR_OFERTA;
    data: {
        productDescription: string;
        price: number;
        targetAudience: string;
    };
}

export interface PurchaseOrderInterpretation extends BaseInterpretation {
    type: InterpretationType.ORDEN_COMPRA;
    data: {
        supplierName: string;
        productGroup: string;
        variety: string;
        size: string;
        quantity: number;
        packaging: string; // "caja 10kg", "arpilla", etc.
    };
}

export interface AssignmentInterpretation extends BaseInterpretation {
    type: InterpretationType.ASIGNACION_ENTREGA;
    data: {
        employeeName: string;
        customerName: string;
    }
}

export interface PriceUpdateInterpretation extends BaseInterpretation {
    type: InterpretationType.ACTUALIZACION_PRECIO;
    data: {
        productGroup: string;
        variety: string;
        size: string;
        quality: Quality;
        state: FruitState;
        price: number;
        unit: string;
    };
}

export interface StateChangeInterpretation extends BaseInterpretation {
    type: InterpretationType.MOVIMIENTO_ESTADO;
    data: {
        productGroup: string;
        variety: string;
        size: string;
        quality: Quality;
        quantity: number;
        fromState: FruitState;
        toState: FruitState;
    };
}

export interface QualityChangeInterpretation extends BaseInterpretation {
    type: InterpretationType.MOVIMIENTO_CALIDAD;
    data: {
        productGroup: string;
        variety: string;
        size: string;
        state: FruitState;
        quantity: number;
        fromQuality: Quality;
        toQuality: Quality;
    };
}

export interface WarehouseTransferInterpretation extends BaseInterpretation {
    type: InterpretationType.TRANSFERENCIA_BODEGA;
    data: {
        productGroup: string;
        variety: string;
        state: FruitState;
        size: string;
        quality: Quality;
        quantity: number;
        fromWarehouseName: string;
        toWarehouseName: string;
    };
}

export interface CrateLoanInterpretation extends BaseInterpretation {
    type: InterpretationType.PRESTAMO_CAJA;
    data: {
        customer: string;
        quantity: number;
        description: string;
        dueDate?: string; // ISO date string
    };
}

export interface EmployeeCheckInInterpretation extends BaseInterpretation {
    type: InterpretationType.LLEGADA_EMPLEADO;
    data: {
        employee: string;
    };
}

export interface InventoryUpdateInterpretation extends BaseInterpretation {
    type: InterpretationType.ACTUALIZACION_INVENTARIO,
    data: {
        product: string;
        quantity: number;
        action: 'add' | 'remove';
    }
}

export interface ViewChangeInterpretation extends BaseInterpretation {
    type: InterpretationType.CAMBIO_VISTA,
    data: {
      view: View;
    }
}

export interface FilterInterpretation extends BaseInterpretation {
  type: InterpretationType.APLICAR_FILTRO,
  data: {
      targetView: View;
      filterType: 'product' | 'warehouse' | 'saleStatus' | 'paymentStatus';
      filterValue: string;
  }
}

export interface QueryInterpretation extends BaseInterpretation {
    type: InterpretationType.CONSULTA;
    data: {
        topic: string;
    };
}
export interface UnknownInterpretation extends BaseInterpretation {
    type: InterpretationType.DESCONOCIDO;
    data: Record<string, never>;
}

export type ParsedMessage = SaleInterpretation | PriceUpdateInterpretation | StateChangeInterpretation | CrateLoanInterpretation | EmployeeCheckInInterpretation | InventoryUpdateInterpretation | QueryInterpretation | UnknownInterpretation | WarehouseTransferInterpretation | AssignmentInterpretation | ViewChangeInterpretation | FilterInterpretation | OfferInterpretation | QualityChangeInterpretation | PurchaseOrderInterpretation | FixedAssetSaleInterpretation;

export interface BusinessState {
    productGroups: ProductGroup[];
    warehouses: Warehouse[];
    employees: Employee[];
    prices: Price[];
    inventory: InventoryBatch[];
    customers: Customer[];
    suppliers: Supplier[];
    sales: Sale[];
    payments: Payment[];
    purchaseOrders: PurchaseOrder[];
    crateLoans: CrateLoan[];
    crateTypes: CrateType[];
    crateInventory: CrateInventory[];
    activities: EmployeeActivity[];
    activityLog: ActivityLog[];
    messages: Message[];
    systemPrompt: string;
    fixedAssets: FixedAsset[];
    expenses: Expense[];
    categoryIcons: Record<string, string>;
    sizes: Record<string, { icon: string, archived: boolean }>;
    qualities: Record<Quality, { icon: string }>;
    stateIcons: Record<string, string>;
    ripeningRules: RipeningRule[];
    inventoryRecommendations: InventoryRecommendation[];
    taskAssignments: TaskAssignment[];
    taskReports: TaskReport[];
    presenceRoster: PresenceRosterEntry[];
    operationalExceptions: OperationalException[];
    actionItems: ActionItem[];
    cashDrawers: CashDrawer[];
    cashDrawerActivities: CashDrawerActivity[];
    messageTemplates: MessageTemplate[]; 
    // AI State
    aiCustomerSummary: { content: string; error: string | null } | null;
    isGeneratingSummary: boolean;
    // UI State
    theme: 'light' | 'dark';
    currentView: View;
    currentRole: UserRole;
    currentCustomerId: string | null;
    currentSupplierId: string | null;
    productFilter: string;
    warehouseFilter: string;
    saleStatusFilter: SaleStatus | 'all';
    paymentStatusFilter: PaymentStatus | 'all';
}

export type ActionResult = {
    nextState: BusinessState;
    notification?: { text: string; isError: boolean };
}
