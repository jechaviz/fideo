import * as InitialData from '../../data/initialData';
import {
    ActivityLog,
    BusinessState,
    CashDrawer,
    CashDrawerActivity,
    CrateInventory,
    CrateLoan,
    CrateType,
    Customer,
    Employee,
    EmployeeActivity,
    Expense,
    FixedAsset,
    InventoryBatch,
    Message,
    MessageUndoState,
    MessageTemplate,
    ParsedMessage,
    Payment,
    Price,
    ProductGroup,
    PurchaseOrder,
    Quality,
    RipeningRule,
    Sale,
    SaleStatus,
    PaymentStatus,
    Supplier,
    TaskAssignment,
    TaskReport,
    TaskReportInput,
    UserRole,
    View,
    Warehouse,
} from '../../types';
import { AuthSessionProfile } from './auth';
import { requirePocketBaseClient } from './client';

export interface RemoteWorkspaceSnapshot {
    workspaceId: string;
    workspaceSlug: string;
    snapshotRecordId: string;
    version: number;
    snapshot: Record<string, unknown>;
    profile: AuthSessionProfile;
}

export interface PersistResult {
    version: number;
    snapshotRecordId: string;
    updatedAt: string;
}

type PocketBaseNotification = { text: string; isError: boolean };

export interface ApproveInterpretationResult extends PersistResult {
    snapshot: Record<string, unknown>;
    notification?: PocketBaseNotification | null;
    actionLogId?: string;
}

export interface InterpretMessageResult {
    interpretation?: ParsedMessage;
    snapshot?: Record<string, unknown>;
    version?: number;
    snapshotRecordId?: string;
    updatedAt?: string;
    actionLogId?: string;
}

export type CorrectInterpretationResult = InterpretMessageResult;
export type RevertInterpretationResult = InterpretMessageResult;
export interface SubmitTaskReportResult {
    report?: TaskReport;
    taskAssignment?: TaskAssignment;
    snapshot?: Record<string, unknown>;
    version?: number;
    snapshotRecordId?: string;
    updatedAt?: string;
    actionLogId?: string;
    notification?: PocketBaseNotification | null;
}

type PocketBaseErrorLike = {
    status?: number;
    response?: Record<string, unknown>;
    isAbort?: boolean;
    originalError?: unknown;
    message?: string;
};

export type PocketBaseSyncErrorCode = 'auth' | 'forbidden' | 'conflict' | 'offline' | 'cancelled' | 'unknown';

interface PocketBaseSyncErrorOptions {
    code: PocketBaseSyncErrorCode;
    status?: number | null;
    retryable?: boolean;
    conflictVersion?: number;
    snapshotRecordId?: string;
    cause?: unknown;
}

export class PocketBaseSyncError extends Error {
    code: PocketBaseSyncErrorCode;
    status: number | null;
    retryable: boolean;
    conflictVersion?: number;
    snapshotRecordId?: string;

    constructor(message: string, options: PocketBaseSyncErrorOptions) {
        super(message);
        this.name = 'PocketBaseSyncError';
        this.code = options.code;
        this.status = options.status ?? null;
        this.retryable = options.retryable ?? false;
        this.conflictVersion = options.conflictVersion;
        this.snapshotRecordId = options.snapshotRecordId;

        if (options.cause !== undefined) {
            (this as Error & { cause?: unknown }).cause = options.cause;
        }
    }
}

const CORE_STORAGE_KEY = 'fideo/businessData';
const DATE_RE =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

const readNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
};

const readPocketBaseError = (error: unknown): PocketBaseErrorLike | null => {
    if (!isRecord(error)) return null;

    const response = isRecord(error.response) ? error.response : undefined;
    return {
        status: readNumber(error.status),
        response,
        isAbort: Boolean(error.isAbort),
        originalError: error.originalError,
        message: readString(error.message) || undefined,
    };
};

const getPocketBaseErrorMessage = (error: PocketBaseErrorLike | null): string | null => {
    if (!error) return null;
    return readString(error.response?.message) || error.message || null;
};

const getConflictVersion = (error: PocketBaseErrorLike | null): number | undefined => readNumber(error?.response?.version);

const getConflictSnapshotRecordId = (error: PocketBaseErrorLike | null): string | undefined =>
    readString(error?.response?.snapshotRecordId) || undefined;

const looksOffline = (error: PocketBaseErrorLike | null): boolean => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return true;
    }

    if (!error) return false;
    if ((error.status || 0) === 0) return true;

    const originalErrorMessage =
        error.originalError instanceof Error
            ? error.originalError.message
            : typeof error.originalError === 'string'
              ? error.originalError
              : '';

    const combinedMessage = [error.message, readString(error.response?.message), originalErrorMessage]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return (
        combinedMessage.includes('failed to fetch')
        || combinedMessage.includes('fetch')
        || combinedMessage.includes('network')
        || combinedMessage.includes('load failed')
        || combinedMessage.includes('offline')
        || combinedMessage.includes('connection')
    );
};

export type PersistableBusinessState = Omit<
    BusinessState,
    | 'inventoryRecommendations'
    | 'actionItems'
    | 'aiCustomerSummary'
    | 'isGeneratingSummary'
    | 'theme'
    | 'currentView'
    | 'currentRole'
    | 'currentCustomerId'
    | 'currentSupplierId'
    | 'productFilter'
    | 'warehouseFilter'
    | 'saleStatusFilter'
    | 'paymentStatusFilter'
>;

const reviveDates = (_key: string, value: unknown) => {
    if (typeof value === 'string' && DATE_RE.test(value)) return new Date(value);
    return value;
};

const cloneWithDates = <T,>(value: unknown): T => JSON.parse(JSON.stringify(value), reviveDates) as T;

const normalizeNotification = (value: unknown): PocketBaseNotification | null | undefined => {
    if (value === undefined) return undefined;
    if (!isRecord(value)) return null;

    const text = readString(value.text);
    if (!text) return null;

    return {
        text,
        isError: Boolean(value.isError),
    };
};

export const getBusinessDataStorageKey = (scope = 'local') => `${CORE_STORAGE_KEY}:${scope}`;

export const createDefaultBusinessState = (): BusinessState => ({
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
    taskAssignments: [],
    taskReports: [],
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
});

const mergeCollectionsWithDefaults = (state: Partial<BusinessState>): BusinessState => {
    const base = createDefaultBusinessState();
    return {
        ...base,
        ...state,
        productGroups: (state.productGroups as ProductGroup[]) || base.productGroups,
        warehouses: (state.warehouses as Warehouse[]) || base.warehouses,
        employees: (state.employees as Employee[]) || base.employees,
        prices: (state.prices as Price[]) || base.prices,
        inventory: (state.inventory as InventoryBatch[]) || base.inventory,
        customers: (state.customers as Customer[]) || base.customers,
        suppliers: (state.suppliers as Supplier[]) || base.suppliers,
        sales: (state.sales as Sale[]) || base.sales,
        payments: (state.payments as Payment[]) || base.payments,
        purchaseOrders: (state.purchaseOrders as PurchaseOrder[]) || base.purchaseOrders,
        crateLoans: (state.crateLoans as CrateLoan[]) || base.crateLoans,
        crateTypes: (state.crateTypes as CrateType[]) || base.crateTypes,
        crateInventory: (state.crateInventory as CrateInventory[]) || base.crateInventory,
        activities: (state.activities as EmployeeActivity[]) || base.activities,
        activityLog: (state.activityLog as ActivityLog[]) || base.activityLog,
        messages: (state.messages as Message[]) || base.messages,
        fixedAssets: (state.fixedAssets as FixedAsset[]) || base.fixedAssets,
        expenses: (state.expenses as Expense[]) || base.expenses,
        ripeningRules: (state.ripeningRules as RipeningRule[]) || base.ripeningRules,
        inventoryRecommendations: [],
        taskAssignments: (state.taskAssignments as TaskAssignment[]) || base.taskAssignments,
        taskReports: (state.taskReports as TaskReport[]) || base.taskReports,
        actionItems: [],
        cashDrawers: (state.cashDrawers as CashDrawer[]) || base.cashDrawers,
        cashDrawerActivities: (state.cashDrawerActivities as CashDrawerActivity[]) || base.cashDrawerActivities,
        messageTemplates: (state.messageTemplates as MessageTemplate[]) || base.messageTemplates,
        aiCustomerSummary: null,
        isGeneratingSummary: false,
        categoryIcons: state.categoryIcons || base.categoryIcons,
        sizes: state.sizes || base.sizes,
        qualities: (state.qualities as Record<Quality, { icon: string }>) || base.qualities,
        stateIcons: state.stateIcons || base.stateIcons,
        systemPrompt: state.systemPrompt || base.systemPrompt,
        theme: state.theme || base.theme,
        currentView: (state.currentView as View) || base.currentView,
        currentRole: (state.currentRole as UserRole) || base.currentRole,
        currentCustomerId: state.currentCustomerId ?? base.currentCustomerId,
        currentSupplierId: state.currentSupplierId ?? base.currentSupplierId,
        productFilter: state.productFilter || base.productFilter,
        warehouseFilter: state.warehouseFilter || base.warehouseFilter,
        saleStatusFilter: (state.saleStatusFilter as SaleStatus | 'all') || base.saleStatusFilter,
        paymentStatusFilter: (state.paymentStatusFilter as PaymentStatus | 'all') || base.paymentStatusFilter,
    };
};

export const readLocalBusinessState = (storageKey: string): BusinessState | null => {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        return mergeCollectionsWithDefaults(JSON.parse(raw, reviveDates) as Partial<BusinessState>);
    } catch (error) {
        console.error('No se pudo leer el estado local de Fideo.', error);
        return null;
    }
};

export const writeLocalBusinessState = (storageKey: string, state: BusinessState) => {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
        console.error('No se pudo guardar el estado local de Fideo.', error);
    }
};

export const buildPersistableSnapshot = (state: BusinessState): PersistableBusinessState => {
    const {
        inventoryRecommendations: _inventoryRecommendations,
        actionItems: _actionItems,
        aiCustomerSummary: _aiCustomerSummary,
        isGeneratingSummary: _isGeneratingSummary,
        theme: _theme,
        currentView: _currentView,
        currentRole: _currentRole,
        currentCustomerId: _currentCustomerId,
        currentSupplierId: _currentSupplierId,
        productFilter: _productFilter,
        warehouseFilter: _warehouseFilter,
        saleStatusFilter: _saleStatusFilter,
        paymentStatusFilter: _paymentStatusFilter,
        ...persistableState
    } = state;

    const sanitizeUndoState = (undoState: MessageUndoState | undefined): MessageUndoState | undefined => {
        if (!undoState) return undefined;

        const nextUndoState: MessageUndoState = {};
        if (undoState.correction) {
            nextUndoState.correction = {
                actionId: undoState.correction.actionId,
                previousInterpretation: undoState.correction.previousInterpretation,
                previousStatus: undoState.correction.previousStatus,
            };
        }
        if (undoState.approval) {
            nextUndoState.approval = {
                actionId: undoState.approval.actionId,
                snapshot: undoState.approval.snapshot
                    ? (JSON.parse(JSON.stringify(undoState.approval.snapshot)) as Record<string, unknown>)
                    : undefined,
                previousStatus: undoState.approval.previousStatus,
            };
        }

        return Object.keys(nextUndoState).length > 0 ? nextUndoState : undefined;
    };

    const sanitizedState = {
        ...persistableState,
        messages: persistableState.messages.map((message) => ({
            ...message,
            undoState: sanitizeUndoState(message.undoState),
        })),
    };

    return JSON.parse(JSON.stringify(sanitizedState)) as PersistableBusinessState;
};

export const buildSeedSnapshot = () => buildPersistableSnapshot(createDefaultBusinessState());

export const normalizePocketBaseError = (error: unknown, fallbackMessage: string): PocketBaseSyncError => {
    if (error instanceof PocketBaseSyncError) {
        return error;
    }

    const pocketBaseError = readPocketBaseError(error);
    const message = getPocketBaseErrorMessage(pocketBaseError) || (error instanceof Error ? error.message : null) || fallbackMessage;
    const status = pocketBaseError?.status ?? null;

    if (pocketBaseError?.isAbort) {
        return new PocketBaseSyncError('La operacion con PocketBase fue cancelada.', {
            code: 'cancelled',
            status,
            retryable: true,
            cause: error,
        });
    }

    if (status === 409) {
        return new PocketBaseSyncError(message, {
            code: 'conflict',
            status,
            retryable: true,
            conflictVersion: getConflictVersion(pocketBaseError),
            snapshotRecordId: getConflictSnapshotRecordId(pocketBaseError),
            cause: error,
        });
    }

    if (status === 400 || status === 401) {
        return new PocketBaseSyncError(message, {
            code: 'auth',
            status,
            retryable: false,
            cause: error,
        });
    }

    if (status === 403) {
        return new PocketBaseSyncError(message, {
            code: 'forbidden',
            status,
            retryable: false,
            cause: error,
        });
    }

    if (looksOffline(pocketBaseError)) {
        return new PocketBaseSyncError('PocketBase no disponible. Seguimos en local.', {
            code: 'offline',
            status,
            retryable: true,
            cause: error,
        });
    }

    return new PocketBaseSyncError(message, {
        code: 'unknown',
        status,
        retryable: status !== 401 && status !== 403,
        cause: error,
    });
};

export const isPocketBaseRouteUnavailable = (error: unknown): boolean => {
    const pocketBaseError = readPocketBaseError(error);
    const status = pocketBaseError?.status ?? null;
    if (status === 404 || status === 405 || status === 501) {
        return true;
    }

    const message = (getPocketBaseErrorMessage(pocketBaseError) || '').toLowerCase();
    return (
        message.includes('not found')
        || message.includes('cannot post')
        || message.includes('unknown route')
        || message.includes('not registered')
        || message.includes('missing route')
    );
};

const resolveUiStateFromProfile = (
    previousState: BusinessState,
    profile: AuthSessionProfile | null,
): Pick<BusinessState, 'currentRole' | 'currentCustomerId' | 'currentSupplierId'> => {
    if (!profile) {
        return {
            currentRole: previousState.currentRole,
            currentCustomerId: previousState.currentCustomerId,
            currentSupplierId: previousState.currentSupplierId,
        };
    }

    if (profile.role === 'Admin' || profile.canSwitchRoles) {
        return {
            currentRole: previousState.currentRole || profile.role,
            currentCustomerId: previousState.currentCustomerId,
            currentSupplierId: previousState.currentSupplierId,
        };
    }

    return {
        currentRole: profile.role,
        currentCustomerId: profile.role === 'Cliente' ? profile.customerId : null,
        currentSupplierId: profile.role === 'Proveedor' ? profile.supplierId : null,
    };
};

export const hydrateBusinessState = (
    snapshot: Record<string, unknown> | null | undefined,
    previousState: BusinessState,
    profile: AuthSessionProfile | null,
): BusinessState => {
    const hydrated = mergeCollectionsWithDefaults(JSON.parse(JSON.stringify(snapshot || {}), reviveDates) as Partial<BusinessState>);
    const scopedUiState = resolveUiStateFromProfile(previousState, profile);

    return {
        ...hydrated,
        theme: previousState.theme,
        currentView: previousState.currentView,
        productFilter: previousState.productFilter,
        warehouseFilter: previousState.warehouseFilter,
        saleStatusFilter: previousState.saleStatusFilter,
        paymentStatusFilter: previousState.paymentStatusFilter,
        aiCustomerSummary: null,
        isGeneratingSummary: false,
        inventoryRecommendations: [],
        actionItems: [],
        currentRole: scopedUiState.currentRole,
        currentCustomerId: scopedUiState.currentCustomerId,
        currentSupplierId: scopedUiState.currentSupplierId,
    };
};

export const bootstrapRemoteWorkspace = async (): Promise<RemoteWorkspaceSnapshot> => {
    const pb = requirePocketBaseClient();
    return pb.send('/api/fideo/bootstrap', {
        method: 'POST',
        body: {
            seedSnapshot: buildSeedSnapshot(),
        },
    }) as Promise<RemoteWorkspaceSnapshot>;
};

export const persistRemoteWorkspaceSnapshot = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    expectedVersion: number,
): Promise<PersistResult> => {
    const pb = requirePocketBaseClient();
    return pb.send('/api/fideo/state/persist', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot,
        },
    }) as Promise<PersistResult>;
};

export const approveRemoteWorkspaceInterpretation = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    messageId: string,
    message: Message,
    expectedVersion: number,
): Promise<ApproveInterpretationResult> => {
    const pb = requirePocketBaseClient();
    return pb.send('/api/fideo/messages/approve', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot,
            messageId,
            message: JSON.parse(JSON.stringify(message)),
        },
    }) as Promise<ApproveInterpretationResult>;
};

const normalizeInterpretationResponse = (response: unknown): InterpretMessageResult => {
    const payload = isRecord(response) ? response : {};
    const interpretationSource =
        isRecord(payload.interpretation)
            ? payload.interpretation
            : typeof payload.type === 'string' && typeof payload.explanation === 'string'
              ? payload
              : null;

    return {
        interpretation: interpretationSource ? (JSON.parse(JSON.stringify(interpretationSource)) as ParsedMessage) : undefined,
        snapshot: isRecord(payload.snapshot) ? (payload.snapshot as Record<string, unknown>) : undefined,
        version: readNumber(payload.version),
        snapshotRecordId: readString(payload.snapshotRecordId) || undefined,
        updatedAt: readString(payload.updatedAt) || undefined,
        actionLogId: readString(payload.actionLogId) || undefined,
    };
};

const normalizeTaskReportResponse = (response: unknown): SubmitTaskReportResult => {
    const payload = isRecord(response) ? response : {};
    const taskAssignmentSource =
        isRecord(payload.taskAssignment)
            ? payload.taskAssignment
            : isRecord(payload.task)
              ? payload.task
              : null;
    const reportSource =
        isRecord(payload.report)
            ? payload.report
            : isRecord(payload.taskReport)
              ? payload.taskReport
              : null;

    return {
        report: reportSource ? cloneWithDates<TaskReport>(reportSource) : undefined,
        taskAssignment: taskAssignmentSource ? cloneWithDates<TaskAssignment>(taskAssignmentSource) : undefined,
        snapshot: isRecord(payload.snapshot) ? (payload.snapshot as Record<string, unknown>) : undefined,
        version: readNumber(payload.version),
        snapshotRecordId: readString(payload.snapshotRecordId) || undefined,
        updatedAt: readString(payload.updatedAt) || undefined,
        actionLogId: readString(payload.actionLogId) || undefined,
        notification: normalizeNotification(payload.notification),
    };
};

export const interpretRemoteWorkspaceMessage = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    messageId: string,
    message: Message,
    expectedVersion: number,
): Promise<InterpretMessageResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/messages/interpret', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot,
            messageId,
            message: JSON.parse(JSON.stringify(message)),
        },
    });

    return normalizeInterpretationResponse(response);
};

export const correctRemoteWorkspaceInterpretation = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    messageId: string,
    message: Message,
    interpretation: ParsedMessage,
    expectedVersion: number,
): Promise<CorrectInterpretationResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/messages/correct', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot,
            messageId,
            message: JSON.parse(JSON.stringify(message)),
            interpretation: JSON.parse(JSON.stringify(interpretation)),
        },
    });

    return normalizeInterpretationResponse(response);
};

export const revertRemoteWorkspaceInterpretation = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    messageId: string,
    message: Message,
    expectedVersion: number,
    actionId?: string,
): Promise<RevertInterpretationResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/messages/undo', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot,
            messageId,
            actionId,
            message: JSON.parse(JSON.stringify(message)),
        },
    });

    return normalizeInterpretationResponse(response);
};

export const submitRemoteWorkspaceTaskReport = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    taskId: string,
    report: TaskReportInput,
    expectedVersion: number,
): Promise<SubmitTaskReportResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/tasks/report', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot,
            taskId,
            report: JSON.parse(JSON.stringify(report)),
        },
    });

    return normalizeTaskReportResponse(response);
};
