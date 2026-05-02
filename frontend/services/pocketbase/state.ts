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
    OperationalException,
    OperationalExceptionFollowUpInput,
    OperationalExceptionReassignInput,
    OperationalExceptionResolveInput,
    ParsedMessage,
    Payment,
    Price,
    ProductGroup,
    PresenceRosterEntry,
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
import { AuthPresenceState, AuthSessionProfile } from './auth';
import { requirePocketBaseClient } from './client';

export interface WorkspaceRuntimeOverview {
    generatedAt?: string;
    workspaceId?: string;
    workspaceSlug?: string;
    staffPresence?: {
        summary?: Record<string, unknown>;
        roster?: PresenceRosterEntry[];
    } | null;
    operationalExceptions?: {
        summary?: Record<string, unknown>;
        items?: OperationalException[];
    } | null;
}

export interface RemoteWorkspaceSnapshot {
    workspaceId: string;
    workspaceSlug: string;
    snapshotRecordId: string;
    version: number;
    snapshot: Record<string, unknown>;
    profile: AuthSessionProfile;
    runtimeOverview?: WorkspaceRuntimeOverview | null;
    staffPresence?: PresenceRosterEntry[];
    exceptionInbox?: OperationalException[];
}

export interface PersistResult {
    version: number;
    snapshotRecordId: string;
    updatedAt: string;
}

export interface PresencePingPayload {
    workspaceId: string;
    sessionId: string;
    deviceId?: string;
    deviceName?: string;
    installationId?: string;
    platform?: string;
    appVersion?: string;
    status?: AuthPresenceState['status'];
    pushExternalId?: string | null;
    meta?: Record<string, unknown>;
}

export interface PresencePingResult {
    ok: boolean;
    workspaceId: string;
    pushExternalId: string | null;
    lastSeenAt: string | null;
    presence: AuthPresenceState | null;
}

export interface RuntimeOverviewResult {
    workspaceId: string;
    workspaceSlug?: string;
    snapshotRecordId?: string | null;
    version?: number;
    runtimeOverview?: WorkspaceRuntimeOverview | null;
    staffPresence?: PresenceRosterEntry[];
    exceptionInbox?: OperationalException[];
}

export interface RemoteOperationalRuntime {
    presenceRoster: PresenceRosterEntry[];
    operationalExceptions: OperationalException[];
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

interface RuntimeActionResponseBase {
    snapshot?: Record<string, unknown>;
    version?: number;
    snapshotRecordId?: string;
    updatedAt?: string;
    actionLogId?: string;
    notification?: PocketBaseNotification | null;
    runtimeOverview?: WorkspaceRuntimeOverview | null;
    staffPresence?: PresenceRosterEntry[];
    exceptionInbox?: OperationalException[];
    taskAssignment?: TaskAssignment;
    report?: TaskReport;
    exception?: OperationalException;
}

export type ResolveOperationalExceptionResult = RuntimeActionResponseBase;
export type ReassignOperationalExceptionResult = RuntimeActionResponseBase;
export type FollowUpOperationalExceptionResult = RuntimeActionResponseBase;

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
    | 'presenceRoster'
    | 'operationalExceptions'
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

const USER_ROLES: UserRole[] = ['Admin', 'Repartidor', 'Empacador', 'Cajero', 'Cliente', 'Proveedor'];
const PRESENCE_KEYS = ['presenceRoster', 'globalPresence', 'staffPresence', 'staffRoster', 'roster'] as const;
const OPERATIONAL_EXCEPTION_KEYS = ['operationalExceptions', 'exceptionInbox', 'exceptionQueue', 'runtimeExceptions', 'exceptions'] as const;

const normalizeUserRole = (value: unknown): UserRole => (USER_ROLES.includes(value as UserRole) ? (value as UserRole) : 'Admin');

const normalizePresenceRosterStatus = (value: unknown): PresenceRosterEntry['status'] => {
    if (value === 'background' || value === 'idle' || value === 'offline') return value;
    return 'active';
};

const normalizeOperationalExceptionKind = (value: unknown): OperationalException['kind'] => {
    switch (value) {
        case 'task_report':
        case 'task_blocked':
        case 'cash_drawer':
        case 'sla':
        case 'system':
            return value;
        default:
            return 'other';
    }
};

const normalizeOperationalExceptionSeverity = (value: unknown): OperationalException['severity'] => {
    if (value === 'critical' || value === 'high') return value;
    return 'normal';
};

const normalizeOperationalExceptionStatus = (value: unknown): OperationalException['status'] => {
    if (value === 'acknowledged' || value === 'resolved') return value;
    return 'open';
};

const readArrayCandidate = (source: unknown, keys: readonly string[]): unknown[] | null => {
    if (!isRecord(source)) return null;

    for (const key of keys) {
        const direct = source[key];
        if (Array.isArray(direct)) {
            return direct;
        }

        if (isRecord(direct)) {
            if (Array.isArray(direct.items)) return direct.items;
            if (Array.isArray(direct.entries)) return direct.entries;
            if (Array.isArray(direct.rows)) return direct.rows;
        }
    }

    return null;
};

const collectRuntimeSources = (snapshot: Record<string, unknown> | null | undefined, sources: Array<unknown>): Array<Record<string, unknown>> => {
    const candidates: Array<Record<string, unknown>> = [];
    const append = (value: unknown) => {
        if (!isRecord(value)) return;
        candidates.push(value);
        if (isRecord(value.runtime)) candidates.push(value.runtime);
        if (isRecord(value.snapshot)) candidates.push(value.snapshot);
        if (isRecord(value.data)) candidates.push(value.data);
    };

    sources.forEach(append);
    append(snapshot);
    return candidates;
};

const normalizePresenceRosterEntry = (value: unknown): PresenceRosterEntry | null => {
    if (!isRecord(value)) return null;

    const nestedPresence = isRecord(value.presence) ? value.presence : null;
    const actorId = readString(value.actorId) || readString(value.userId) || readString(value.profileId) || null;
    const employeeId = readString(value.employeeId) || readString(value.ownerEmployeeId) || null;
    const sessionKey = readString(value.sessionKey) || readString(nestedPresence?.sessionKey) || null;
    const name =
        readString(value.name)
        || readString(value.employeeName)
        || readString(value.displayName)
        || readString(value.userName)
        || readString(value.email)
        || null;
    const id =
        readString(value.id)
        || actorId
        || employeeId
        || sessionKey
        || readString(value.sessionId)
        || null;

    if (!id || !name) return null;

    return cloneWithDates<PresenceRosterEntry>({
        id,
        actorId,
        workspaceId: readString(value.workspaceId) || readString(value.workspace) || null,
        employeeId,
        employeeName: readString(value.employeeName) || name,
        name,
        role: normalizeUserRole(value.role),
        status: normalizePresenceRosterStatus(value.status ?? nestedPresence?.status),
        lastSeenAt:
            readString(value.lastSeenAt)
            || readString(value.timestamp)
            || readString(nestedPresence?.lastSeenAt)
            || null,
        sessionKey,
        sessionId: readString(value.sessionId) || readString(nestedPresence?.sessionId) || null,
        deviceId: readString(value.deviceId) || readString(nestedPresence?.deviceId) || null,
        deviceName: readString(value.deviceName) || readString(nestedPresence?.deviceName) || null,
        installationId: readString(value.installationId) || readString(nestedPresence?.installationId) || null,
        platform: readString(value.platform) || readString(nestedPresence?.platform) || null,
        appVersion: readString(value.appVersion) || readString(nestedPresence?.appVersion) || null,
        pushExternalId: readString(value.pushExternalId) || readString(nestedPresence?.pushExternalId) || null,
        meta: isRecord(value.meta) ? value.meta : isRecord(nestedPresence?.meta) ? nestedPresence.meta : null,
    });
};

const buildPresenceEntryFromProfile = (profile: AuthSessionProfile | null | undefined): PresenceRosterEntry | null => {
    if (!profile) return null;

    const name = readString(profile.name) || readString(profile.email) || null;
    const id = readString(profile.employeeId) || readString(profile.id) || readString(profile.presence?.sessionKey) || null;
    if (!name || !id) return null;

    return cloneWithDates<PresenceRosterEntry>({
        id,
        actorId: readString(profile.id),
        workspaceId: readString(profile.workspaceId),
        employeeId: readString(profile.employeeId),
        employeeName: name,
        name,
        role: normalizeUserRole(profile.role),
        status: normalizePresenceRosterStatus(profile.presence?.status || (profile.lastSeenAt ? 'active' : 'offline')),
        lastSeenAt: readString(profile.lastSeenAt) || null,
        sessionKey: readString(profile.presence?.sessionKey),
        sessionId: readString(profile.presence?.sessionId),
        deviceId: readString(profile.presence?.deviceId),
        deviceName: readString(profile.presence?.deviceName),
        installationId: readString(profile.presence?.installationId),
        platform: readString(profile.presence?.platform),
        appVersion: readString(profile.presence?.appVersion),
        pushExternalId: readString(profile.pushExternalId) || readString(profile.presence?.pushExternalId),
        meta: profile.presence?.meta || null,
    });
};

const dedupePresenceRoster = (
    entries: PresenceRosterEntry[],
    profile: AuthSessionProfile | null | undefined,
): PresenceRosterEntry[] => {
    const nextEntries = entries.slice();
    const profileEntry = buildPresenceEntryFromProfile(profile);

    if (profileEntry) {
        const matchIndex = nextEntries.findIndex(
            (entry) =>
                entry.id === profileEntry.id
                || (entry.actorId && profileEntry.actorId && entry.actorId === profileEntry.actorId)
                || (entry.employeeId && profileEntry.employeeId && entry.employeeId === profileEntry.employeeId)
                || (entry.sessionKey && profileEntry.sessionKey && entry.sessionKey === profileEntry.sessionKey),
        );

        if (matchIndex >= 0) {
            nextEntries[matchIndex] = {
                ...nextEntries[matchIndex],
                ...profileEntry,
                meta: profileEntry.meta ?? nextEntries[matchIndex].meta ?? null,
            };
        } else {
            nextEntries.unshift(profileEntry);
        }
    }

    const deduped = new Map<string, PresenceRosterEntry>();
    nextEntries.forEach((entry) => {
        const key = entry.sessionKey || entry.actorId || entry.employeeId || entry.id;
        const current = deduped.get(key);
        const currentTime = current?.lastSeenAt instanceof Date ? current.lastSeenAt.getTime() : 0;
        const nextTime = entry.lastSeenAt instanceof Date ? entry.lastSeenAt.getTime() : 0;
        if (!current || nextTime >= currentTime) {
            deduped.set(key, entry);
        }
    });

    return Array.from(deduped.values()).sort((left, right) => {
        const rightTime = right.lastSeenAt instanceof Date ? right.lastSeenAt.getTime() : 0;
        const leftTime = left.lastSeenAt instanceof Date ? left.lastSeenAt.getTime() : 0;
        return rightTime - leftTime;
    });
};

const normalizeOperationalException = (value: unknown): OperationalException | null => {
    if (!isRecord(value)) return null;

    const kind = normalizeOperationalExceptionKind(value.kind ?? value.type);
    const summary = readString(value.summary) || readString(value.description) || readString(value.detail) || '';
    const title = readString(value.title) || summary || 'Excepcion operativa';
    const id =
        readString(value.id)
        || readString(value.externalId)
        || readString(value.reportId)
        || readString(value.taskId)
        || `${kind}:${title}`;

    return cloneWithDates<OperationalException>({
        id,
        kind,
        severity: normalizeOperationalExceptionSeverity(value.severity),
        status: normalizeOperationalExceptionStatus(value.status),
        title,
        summary,
        detail: readString(value.detail) || readString(value.notes) || undefined,
        createdAt:
            readString(value.createdAt)
            || readString(value.timestamp)
            || readString(value.detectedAt)
            || new Date(0).toISOString(),
        updatedAt: readString(value.updatedAt) || readString(value.escalatedAt) || undefined,
        resolvedAt: readString(value.resolvedAt) || undefined,
        lastSeenAt: readString(value.lastSeenAt) || undefined,
        workspaceId: readString(value.workspaceId) || readString(value.workspace) || null,
        role: (readString(value.role) as OperationalException['role']) || null,
        employeeId: readString(value.employeeId) || null,
        employeeName: readString(value.employeeName) || null,
        customerId: readString(value.customerId) || null,
        customerName: readString(value.customerName) || null,
        taskId: readString(value.taskId) || null,
        saleId: readString(value.saleId) || null,
        reportId: readString(value.reportId) || null,
        drawerId: readString(value.drawerId) || null,
        drawerName: readString(value.drawerName) || null,
        escalationStatus:
            readString(value.escalationStatus) as OperationalException['escalationStatus'],
        source: readString(value.source) || readString(value.origin) || 'remote',
        meta: isRecord(value.meta) ? value.meta : null,
    });
};

const deriveOperationalExceptionsFromSnapshot = (snapshot: Record<string, unknown> | null | undefined): OperationalException[] => {
    if (!isRecord(snapshot)) return [];

    const reportExceptions = cloneWithDates<TaskReport[]>(Array.isArray(snapshot.taskReports) ? snapshot.taskReports : [])
        .filter((report) => report.status === 'open' || report.escalationStatus === 'pending' || report.escalationStatus === 'sent')
        .map((report) => ({
            id: `task-report:${report.id}`,
            kind: report.kind === 'blocker' ? 'task_blocked' : 'task_report',
            severity: report.severity === 'high' || report.kind === 'blocker' ? 'high' : 'normal',
            status: report.status === 'resolved' ? 'resolved' : 'open',
            title: report.kind === 'blocker' ? 'Bloqueo operativo' : 'Reporte operativo',
            summary: report.summary,
            detail: report.detail,
            createdAt: report.createdAt,
            updatedAt: report.escalatedAt || report.createdAt,
            resolvedAt: report.resolvedAt,
            employeeId: report.employeeId || null,
            employeeName: report.employeeName || null,
            customerId: report.customerId || null,
            customerName: report.customerName || null,
            taskId: report.taskId,
            saleId: report.saleId || null,
            reportId: report.id,
            role: report.role,
            escalationStatus: report.escalationStatus,
            source: 'snapshot',
            meta: {
                reportKind: report.kind,
                evidence: report.evidence || null,
            },
        } as OperationalException));

    const openTaskIds = new Set(reportExceptions.map((item) => item.taskId).filter(Boolean));

    const blockedTaskExceptions = cloneWithDates<TaskAssignment[]>(Array.isArray(snapshot.taskAssignments) ? snapshot.taskAssignments : [])
        .filter((task) => task.status === 'blocked' && !openTaskIds.has(task.id))
        .map((task) => ({
            id: `task-blocked:${task.id}`,
            kind: 'task_blocked',
            severity: 'high',
            status: 'open',
            title: 'Tarea bloqueada',
            summary: task.blockReason || task.title,
            detail: task.description,
            createdAt: task.blockedAt || task.updatedAt || task.createdAt,
            updatedAt: task.updatedAt,
            employeeId: task.employeeId || null,
            employeeName: task.employeeName || null,
            customerId: task.customerId || null,
            customerName: task.customerName || null,
            taskId: task.id,
            saleId: task.saleId || null,
            role: task.role,
            escalationStatus: 'pending',
            source: 'snapshot',
            meta: {
                priority: task.priority,
                status: task.status,
            },
        } as OperationalException));

    return [...reportExceptions, ...blockedTaskExceptions].sort((left, right) => {
        const rightTime = right.createdAt instanceof Date ? right.createdAt.getTime() : 0;
        const leftTime = left.createdAt instanceof Date ? left.createdAt.getTime() : 0;
        return rightTime - leftTime;
    });
};

export const readRemoteOperationalRuntime = (
    snapshot: Record<string, unknown> | null | undefined,
    options: {
        profile?: AuthSessionProfile | null;
        sources?: unknown[];
    } = {},
): RemoteOperationalRuntime => {
    const runtimeSources = collectRuntimeSources(snapshot, options.sources || []);

    const explicitPresenceRoster = runtimeSources
        .map((source) => readArrayCandidate(source, PRESENCE_KEYS))
        .find((value) => value !== null);

    const explicitOperationalExceptions = runtimeSources
        .map((source) => readArrayCandidate(source, OPERATIONAL_EXCEPTION_KEYS))
        .find((value) => value !== null);

    const presenceRoster = dedupePresenceRoster(
        explicitPresenceRoster
            ? explicitPresenceRoster
                  .map((entry) => normalizePresenceRosterEntry(entry))
                  .filter((entry): entry is PresenceRosterEntry => Boolean(entry))
            : [],
        options.profile,
    );

    const operationalExceptions = explicitOperationalExceptions
        ? explicitOperationalExceptions
              .map((entry) => normalizeOperationalException(entry))
              .filter((entry): entry is OperationalException => Boolean(entry))
        : deriveOperationalExceptionsFromSnapshot(snapshot);

    return {
        presenceRoster,
        operationalExceptions,
    };
};

export const mergeRemoteOperationalRuntimeSnapshot = (
    snapshot: Record<string, unknown> | null | undefined,
    options: {
        profile?: AuthSessionProfile | null;
        sources?: unknown[];
    } = {},
): Record<string, unknown> => {
    const baseSnapshot = isRecord(snapshot) ? snapshot : {};
    const runtime = readRemoteOperationalRuntime(baseSnapshot, options);

    return {
        ...baseSnapshot,
        presenceRoster: runtime.presenceRoster,
        operationalExceptions: runtime.operationalExceptions,
    };
};

const normalizeRuntimeOverview = (value: unknown): WorkspaceRuntimeOverview | null => {
    if (!isRecord(value)) return null;

    const staffPresenceRecord = isRecord(value.staffPresence) ? value.staffPresence : null;
    const operationalExceptionsRecord = isRecord(value.operationalExceptions) ? value.operationalExceptions : null;

    return {
        generatedAt: readString(value.generatedAt) || undefined,
        workspaceId: readString(value.workspaceId) || undefined,
        workspaceSlug: readString(value.workspaceSlug) || undefined,
        staffPresence: staffPresenceRecord
            ? {
                summary: isRecord(staffPresenceRecord.summary) ? staffPresenceRecord.summary : undefined,
                roster: Array.isArray(staffPresenceRecord.roster)
                    ? dedupePresenceRoster(
                        staffPresenceRecord.roster
                            .map((item) => normalizePresenceRosterEntry(item))
                            .filter((item): item is PresenceRosterEntry => Boolean(item)),
                        null,
                    )
                    : [],
            }
            : null,
        operationalExceptions: operationalExceptionsRecord
            ? {
                summary: isRecord(operationalExceptionsRecord.summary) ? operationalExceptionsRecord.summary : undefined,
                items: Array.isArray(operationalExceptionsRecord.items)
                    ? operationalExceptionsRecord.items
                          .map((item) => normalizeOperationalException(item))
                          .filter((item): item is OperationalException => Boolean(item))
                    : [],
            }
            : null,
    };
};

const buildRuntimeOverviewResult = (payload: Record<string, unknown>): RuntimeOverviewResult => {
    const runtimeOverview = normalizeRuntimeOverview(payload.runtimeOverview);
    const runtime = readRemoteOperationalRuntime(
        isRecord(payload.snapshot) ? payload.snapshot : {},
        {
            profile: isRecord(payload.profile) ? cloneWithDates<AuthSessionProfile>(payload.profile as unknown) : null,
            sources: [
                payload,
                {
                    staffPresence: runtimeOverview?.staffPresence?.roster || [],
                    exceptionInbox: runtimeOverview?.operationalExceptions?.items || [],
                },
            ],
        },
    );

    return {
        workspaceId: readString(payload.workspaceId) || '',
        workspaceSlug: readString(payload.workspaceSlug) || undefined,
        snapshotRecordId: readString(payload.snapshotRecordId),
        version: readNumber(payload.version),
        runtimeOverview,
        staffPresence: runtime.presenceRoster,
        exceptionInbox: runtime.operationalExceptions,
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
    presenceRoster: [],
    operationalExceptions: [],
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
        presenceRoster: (state.presenceRoster as PresenceRosterEntry[]) || base.presenceRoster,
        operationalExceptions: (state.operationalExceptions as OperationalException[]) || base.operationalExceptions,
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
        presenceRoster: _presenceRoster,
        operationalExceptions: _operationalExceptions,
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

const REMOTE_TRANSPORT_OMIT_KEYS = ['productGroups', 'customers', 'suppliers'] as const;

const areTransportValuesEqual = (
    snapshot: PersistableBusinessState,
    referenceSnapshot: PersistableBusinessState | null | undefined,
    key: (typeof REMOTE_TRANSPORT_OMIT_KEYS)[number],
) => {
    try {
        return JSON.stringify(snapshot[key] ?? null) === JSON.stringify(referenceSnapshot?.[key] ?? null);
    } catch {
        return false;
    }
};

const compactRemoteTransportSnapshot = (
    snapshot: PersistableBusinessState,
    referenceSnapshot?: PersistableBusinessState | null,
): PersistableBusinessState => {
    const compactSnapshot = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
    REMOTE_TRANSPORT_OMIT_KEYS.forEach((key) => {
        if (!referenceSnapshot || areTransportValuesEqual(snapshot, referenceSnapshot, key)) {
            delete compactSnapshot[key];
        }
    });
    return compactSnapshot as PersistableBusinessState;
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
    const hydrated = mergeCollectionsWithDefaults(
        JSON.parse(JSON.stringify(mergeRemoteOperationalRuntimeSnapshot(snapshot, { profile })), reviveDates) as Partial<BusinessState>,
    );
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

const normalizeRemoteWorkspaceSnapshot = (response: unknown): RemoteWorkspaceSnapshot => {
    const payload = isRecord(response) ? response : {};
    const profile = cloneWithDates<AuthSessionProfile>((isRecord(payload.profile) ? payload.profile : {}) as unknown);
    const runtime = buildRuntimeOverviewResult(payload);
    const snapshot = mergeRemoteOperationalRuntimeSnapshot(isRecord(payload.snapshot) ? payload.snapshot : {}, {
        profile,
        sources: [
            payload,
            {
                staffPresence: runtime.staffPresence || [],
                exceptionInbox: runtime.exceptionInbox || [],
            },
        ],
    });

    return {
        workspaceId: readString(payload.workspaceId) || '',
        workspaceSlug: readString(payload.workspaceSlug) || 'main',
        snapshotRecordId: readString(payload.snapshotRecordId) || '',
        version: readNumber(payload.version) || 0,
        snapshot,
        profile,
        runtimeOverview: runtime.runtimeOverview,
        staffPresence: runtime.staffPresence,
        exceptionInbox: runtime.exceptionInbox,
    };
};

const normalizeApproveInterpretationResponse = (response: unknown): ApproveInterpretationResult => {
    const payload = isRecord(response) ? response : {};
    const runtime = buildRuntimeOverviewResult(payload);

    return {
        version: readNumber(payload.version) || 0,
        snapshotRecordId: readString(payload.snapshotRecordId) || '',
        updatedAt: readString(payload.updatedAt) || new Date().toISOString(),
        snapshot: mergeRemoteOperationalRuntimeSnapshot(isRecord(payload.snapshot) ? payload.snapshot : {}, {
            sources: [payload, { staffPresence: runtime.staffPresence || [], exceptionInbox: runtime.exceptionInbox || [] }],
        }),
        notification: normalizeNotification(payload.notification),
        actionLogId: readString(payload.actionLogId) || undefined,
    };
};

export const bootstrapRemoteWorkspace = async (): Promise<RemoteWorkspaceSnapshot> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/bootstrap', {
        method: 'POST',
        body: {
            seedSnapshot: buildSeedSnapshot(),
        },
    });

    return normalizeRemoteWorkspaceSnapshot(response);
};

export const fetchRemoteWorkspaceRuntimeOverview = async (
    workspaceId: string,
): Promise<RuntimeOverviewResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/runtime/overview', {
        method: 'POST',
        body: {
            workspaceId,
        },
    });

    const payload = isRecord(response) ? response : {};
    return buildRuntimeOverviewResult(payload);
};

export const persistRemoteWorkspaceSnapshot = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    expectedVersion: number,
    referenceSnapshot?: PersistableBusinessState | null,
): Promise<PersistResult> => {
    const pb = requirePocketBaseClient();
    return pb.send('/api/fideo/state/persist', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot: compactRemoteTransportSnapshot(snapshot, referenceSnapshot),
        },
    }) as Promise<PersistResult>;
};

export const approveRemoteWorkspaceInterpretation = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    messageId: string,
    message: Message,
    expectedVersion: number,
    referenceSnapshot?: PersistableBusinessState | null,
): Promise<ApproveInterpretationResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/messages/approve', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot: compactRemoteTransportSnapshot(snapshot, referenceSnapshot),
            messageId,
            message: JSON.parse(JSON.stringify(message)),
        },
    });

    return normalizeApproveInterpretationResponse(response);
};

const normalizeInterpretationResponse = (response: unknown): InterpretMessageResult => {
    const payload = isRecord(response) ? response : {};
    const runtime = buildRuntimeOverviewResult(payload);
    const interpretationSource =
        isRecord(payload.interpretation)
            ? payload.interpretation
            : typeof payload.type === 'string' && typeof payload.explanation === 'string'
              ? payload
              : null;

    return {
        interpretation: interpretationSource ? (JSON.parse(JSON.stringify(interpretationSource)) as ParsedMessage) : undefined,
        snapshot: isRecord(payload.snapshot)
            ? mergeRemoteOperationalRuntimeSnapshot(payload.snapshot as Record<string, unknown>, {
                sources: [payload, { staffPresence: runtime.staffPresence || [], exceptionInbox: runtime.exceptionInbox || [] }],
            })
            : undefined,
        version: readNumber(payload.version),
        snapshotRecordId: readString(payload.snapshotRecordId) || undefined,
        updatedAt: readString(payload.updatedAt) || undefined,
        actionLogId: readString(payload.actionLogId) || undefined,
    };
};

const normalizeTaskReportResponse = (response: unknown): SubmitTaskReportResult => {
    const payload = isRecord(response) ? response : {};
    const runtime = buildRuntimeOverviewResult(payload);
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
        snapshot: isRecord(payload.snapshot)
            ? mergeRemoteOperationalRuntimeSnapshot(payload.snapshot as Record<string, unknown>, {
                sources: [payload, { staffPresence: runtime.staffPresence || [], exceptionInbox: runtime.exceptionInbox || [] }],
            })
            : undefined,
        version: readNumber(payload.version),
        snapshotRecordId: readString(payload.snapshotRecordId) || undefined,
        updatedAt: readString(payload.updatedAt) || undefined,
        actionLogId: readString(payload.actionLogId) || undefined,
        notification: normalizeNotification(payload.notification),
    };
};

const normalizeRuntimeActionResponse = (response: unknown): RuntimeActionResponseBase => {
    const payload = isRecord(response) ? response : {};
    const runtime = buildRuntimeOverviewResult(payload);
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
    const exceptionSource =
        isRecord(payload.exception)
            ? payload.exception
            : isRecord(payload.operationalException)
              ? payload.operationalException
              : null;

    return {
        snapshot: isRecord(payload.snapshot)
            ? mergeRemoteOperationalRuntimeSnapshot(payload.snapshot as Record<string, unknown>, {
                sources: [payload, { staffPresence: runtime.staffPresence || [], exceptionInbox: runtime.exceptionInbox || [] }],
            })
            : undefined,
        version: readNumber(payload.version),
        snapshotRecordId: readString(payload.snapshotRecordId) || undefined,
        updatedAt: readString(payload.updatedAt) || undefined,
        actionLogId: readString(payload.actionLogId) || undefined,
        notification: normalizeNotification(payload.notification),
        runtimeOverview: runtime.runtimeOverview,
        staffPresence: runtime.staffPresence,
        exceptionInbox: runtime.exceptionInbox,
        taskAssignment: taskAssignmentSource ? cloneWithDates<TaskAssignment>(taskAssignmentSource) : undefined,
        report: reportSource ? cloneWithDates<TaskReport>(reportSource) : undefined,
        exception: exceptionSource ? normalizeOperationalException(exceptionSource) || undefined : undefined,
    };
};

const normalizePresenceState = (value: unknown): AuthPresenceState | null => {
    if (!isRecord(value)) return null;

    const normalizePresenceStatus = (status: unknown): AuthPresenceState['status'] => {
        if (status === 'background' || status === 'idle' || status === 'offline') return status;
        return 'active';
    };

    return {
        sessionKey: readString(value.sessionKey) || null,
        status: normalizePresenceStatus(value.status),
        sessionId: readString(value.sessionId) || null,
        deviceId: readString(value.deviceId) || null,
        deviceName: readString(value.deviceName) || null,
        installationId: readString(value.installationId) || null,
        platform: readString(value.platform) || null,
        appVersion: readString(value.appVersion) || null,
        pushExternalId: readString(value.pushExternalId) || null,
        meta: isRecord(value.meta) ? value.meta : null,
    };
};

const normalizePresencePingResponse = (response: unknown): PresencePingResult => {
    const payload = isRecord(response) ? response : {};

    return {
        ok: Boolean(payload.ok),
        workspaceId: readString(payload.workspaceId) || '',
        pushExternalId: readString(payload.pushExternalId) || null,
        lastSeenAt: readString(payload.lastSeenAt) || null,
        presence: normalizePresenceState(payload.presence),
    };
};

export const interpretRemoteWorkspaceMessage = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    messageId: string,
    message: Message,
    expectedVersion: number,
    referenceSnapshot?: PersistableBusinessState | null,
): Promise<InterpretMessageResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/messages/interpret', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot: compactRemoteTransportSnapshot(snapshot, referenceSnapshot),
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
    referenceSnapshot?: PersistableBusinessState | null,
): Promise<CorrectInterpretationResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/messages/correct', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot: compactRemoteTransportSnapshot(snapshot, referenceSnapshot),
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
    referenceSnapshot?: PersistableBusinessState | null,
): Promise<RevertInterpretationResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/messages/undo', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot: compactRemoteTransportSnapshot(snapshot, referenceSnapshot),
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
    referenceSnapshot?: PersistableBusinessState | null,
): Promise<SubmitTaskReportResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/tasks/report', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot: compactRemoteTransportSnapshot(snapshot, referenceSnapshot),
            taskId,
            report: JSON.parse(JSON.stringify(report)),
        },
    });

    return normalizeTaskReportResponse(response);
};

export const resolveRemoteOperationalException = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    exception: OperationalException,
    resolution: OperationalExceptionResolveInput,
    expectedVersion: number,
    referenceSnapshot?: PersistableBusinessState | null,
): Promise<ResolveOperationalExceptionResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/exceptions/resolve', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot: compactRemoteTransportSnapshot(snapshot, referenceSnapshot),
            exceptionId: exception.id,
            exception: JSON.parse(JSON.stringify(exception)),
            resolution: JSON.parse(JSON.stringify(resolution)),
        },
    });

    return normalizeRuntimeActionResponse(response);
};

export const reassignRemoteOperationalException = async (
    workspaceId: string,
    snapshot: PersistableBusinessState,
    exception: OperationalException,
    reassignment: OperationalExceptionReassignInput,
    expectedVersion: number,
    referenceSnapshot?: PersistableBusinessState | null,
): Promise<ReassignOperationalExceptionResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/exceptions/reassign', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            snapshot: compactRemoteTransportSnapshot(snapshot, referenceSnapshot),
            exceptionId: exception.id,
            exception: JSON.parse(JSON.stringify(exception)),
            reassignment: JSON.parse(JSON.stringify(reassignment)),
        },
    });

    return normalizeRuntimeActionResponse(response);
};

export const followUpRemoteOperationalException = async (
    workspaceId: string,
    _snapshot: PersistableBusinessState,
    exception: OperationalException,
    followUp: OperationalExceptionFollowUpInput,
    expectedVersion: number,
): Promise<FollowUpOperationalExceptionResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/exceptions/follow-up', {
        method: 'POST',
        body: {
            workspaceId,
            expectedVersion,
            exceptionId: exception.id,
            exception: JSON.parse(JSON.stringify(exception)),
            followUp: JSON.parse(JSON.stringify(followUp)),
        },
    });

    return normalizeRuntimeActionResponse(response);
};

export const pingRemoteWorkspacePresence = async (
    payload: PresencePingPayload,
): Promise<PresencePingResult> => {
    const pb = requirePocketBaseClient();
    const response = await pb.send('/api/fideo/presence/ping', {
        method: 'POST',
        body: JSON.parse(JSON.stringify(payload)),
    });

    return normalizePresencePingResponse(response);
};
