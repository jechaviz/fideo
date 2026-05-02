import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActionItem,
    ActionResult,
    BusinessState,
    OperationalException,
    OperationalExceptionFollowUpInput,
    FixedAssetSaleInterpretation,
    FilterInterpretation,
    InventoryRecommendation,
    InterpretationType,
    Message,
    OfferInterpretation,
    ParsedMessage,
    PurchaseOrderInterpretation,
    SaleInterpretation,
    StateChangeInterpretation,
    TaskAssignment,
    TaskReportInput,
    TaskStatus,
    UserRole,
    View,
    WarehouseTransferInterpretation,
    AssignmentInterpretation,
    CrateLoanInterpretation,
    EmployeeCheckInInterpretation,
    ViewChangeInterpretation,
    PriceUpdateInterpretation,
} from '../types';
import {
    AuthSessionProfile,
} from '../services/pocketbase/auth';
import {
    ApproveInterpretationResult,
    buildPersistableSnapshot,
    CorrectInterpretationResult,
    createDefaultBusinessState,
    getBusinessDataStorageKey,
    hydrateBusinessState,
    InterpretMessageResult,
    PersistResult,
    PocketBaseSyncError,
    readRemoteOperationalRuntime,
    readLocalBusinessState,
    RevertInterpretationResult,
    SubmitTaskReportResult,
    writeLocalBusinessState,
} from '../services/pocketbase/state';
import { loanBelongsToCustomer, saleBelongsToCustomer } from '../utils/customerIdentity';
import { reassignTaskAssignment, resolveCurrentEmployee, syncOperationalTaskAssignments, updateTaskAssignmentStatus } from '../utils/taskAssignments';
import {
    followUpOperationalExceptionLocally,
    normalizeTaskReportInput,
    resolveOperationalExceptionLocally,
    submitTaskReportLocally,
    syncTaskReportsWithTasks,
} from '../utils/taskReports';
import * as Logic from '../utils/businessLogic';
import { useCatalogActions } from './useCatalogActions';
import { useInventoryActions } from './useInventoryActions';
import { useSalesActions } from './useSalesActions';
import { useSystemActions } from './useSystemActions';

interface UseBusinessDataOptions {
    storageKey?: string;
    hydratedSnapshot?: Record<string, unknown> | null;
    hydrationKey?: string | null;
    authProfile?: AuthSessionProfile | null;
    authEnabled?: boolean;
    authError?: string | null;
    workspaceLabel?: string | null;
    remoteVersion?: number;
    staffPresence?: Array<Record<string, unknown>>;
    exceptionInbox?: Array<Record<string, unknown>>;
    onPersistRemoteState?: (snapshot: ReturnType<typeof buildPersistableSnapshot>, expectedVersion: number) => Promise<PersistResult>;
    onApproveRemoteInterpretation?: (
        snapshot: ReturnType<typeof buildPersistableSnapshot>,
        messageId: string,
        message: Message,
        expectedVersion: number,
    ) => Promise<ApproveInterpretationResult>;
    onInterpretRemoteMessage?: (
        snapshot: ReturnType<typeof buildPersistableSnapshot>,
        messageId: string,
        message: Message,
        expectedVersion: number,
    ) => Promise<InterpretMessageResult | null>;
    onCorrectRemoteInterpretation?: (
        snapshot: ReturnType<typeof buildPersistableSnapshot>,
        messageId: string,
        message: Message,
        interpretation: ParsedMessage,
        expectedVersion: number,
    ) => Promise<CorrectInterpretationResult | null>;
    onRevertRemoteInterpretation?: (
        snapshot: ReturnType<typeof buildPersistableSnapshot>,
        messageId: string,
        message: Message,
        expectedVersion: number,
        actionId?: string,
    ) => Promise<RevertInterpretationResult | null>;
    onSubmitRemoteTaskReport?: (
        snapshot: ReturnType<typeof buildPersistableSnapshot>,
        taskId: string,
        report: TaskReportInput,
        expectedVersion: number,
    ) => Promise<SubmitTaskReportResult | null>;
    onReassignRemoteTask?: (
        snapshot: ReturnType<typeof buildPersistableSnapshot>,
        exception: OperationalException,
        assignee: { employeeId?: string | null; employeeName?: string | null; reason?: string },
        expectedVersion: number,
    ) => Promise<{
        snapshot?: Record<string, unknown>;
        version?: number;
        snapshotRecordId?: string;
        updatedAt?: string;
        actionLogId?: string;
    } | null>;
    onResolveRemoteException?: (
        snapshot: ReturnType<typeof buildPersistableSnapshot>,
        exception: OperationalException,
        resolution: { nextTaskStatus?: TaskStatus; resolutionNote?: string },
        expectedVersion: number,
    ) => Promise<{
        snapshot?: Record<string, unknown>;
        version?: number;
        snapshotRecordId?: string;
        updatedAt?: string;
        actionLogId?: string;
    } | null>;
    onFollowUpRemoteException?: (
        snapshot: ReturnType<typeof buildPersistableSnapshot>,
        exception: OperationalException,
        followUp: OperationalExceptionFollowUpInput,
        expectedVersion: number,
    ) => Promise<{
        snapshot?: Record<string, unknown>;
        version?: number;
        snapshotRecordId?: string;
        updatedAt?: string;
        actionLogId?: string;
    } | null>;
    onSignOut?: () => void;
}

const applyUiInterpretationState = (currentState: BusinessState, interpretation: ParsedMessage): BusinessState => {
    switch (interpretation.type) {
        case InterpretationType.CAMBIO_VISTA:
            return {
                ...currentState,
                currentView: interpretation.data.view,
                aiCustomerSummary: interpretation.data.view !== 'customers' ? null : currentState.aiCustomerSummary,
            };
        case InterpretationType.APLICAR_FILTRO: {
            const nextState = { ...currentState };
            const { filterType, filterValue, targetView } = interpretation.data;

            if (targetView === 'inventory') {
                if (filterType === 'product') {
                    const productGroup = currentState.productGroups.find((item) => item.name.toLowerCase() === filterValue.toLowerCase());
                    nextState.productFilter = productGroup ? productGroup.id : 'all';
                } else if (filterType === 'warehouse') {
                    const warehouse = currentState.warehouses.find((item) => item.name.toLowerCase() === filterValue.toLowerCase());
                    nextState.warehouseFilter = warehouse ? warehouse.id : 'all';
                }
            } else if (targetView === 'salesLog') {
                if (filterType === 'saleStatus') {
                    nextState.saleStatusFilter = filterValue as BusinessState['saleStatusFilter'];
                } else if (filterType === 'paymentStatus') {
                    nextState.paymentStatusFilter = filterValue as BusinessState['paymentStatusFilter'];
                }
            }

            return nextState;
        }
        default:
            return currentState;
    }
};

const applyInterpretationLocally = (
    currentState: BusinessState,
    messageId: string,
): { nextState: BusinessState; interpretation: ParsedMessage | null } => {
    const message = currentState.messages.find((item) => item.id === messageId);
    if (!message?.interpretation) {
        return { nextState: currentState, interpretation: null as ParsedMessage | null };
    }

    const interpretation = message.interpretation;
    let result: ActionResult = { nextState: currentState };

    switch (interpretation.type) {
        case InterpretationType.VENTA:
            result = Logic.addSaleAction(currentState, interpretation as SaleInterpretation);
            break;
        case InterpretationType.ORDEN_COMPRA:
            result = Logic.addPurchaseOrderAction(currentState, interpretation as PurchaseOrderInterpretation);
            break;
        case InterpretationType.VENTA_ACTIVO_FIJO:
            result = Logic.addFixedAssetSaleAction(currentState, interpretation as FixedAssetSaleInterpretation);
            break;
        case InterpretationType.ACTUALIZACION_PRECIO:
            result = Logic.updatePriceAction(currentState, interpretation as PriceUpdateInterpretation);
            break;
        case InterpretationType.MOVIMIENTO_ESTADO:
            result.nextState = Logic.changeProductStateAction(currentState, interpretation as StateChangeInterpretation);
            break;
        case InterpretationType.TRANSFERENCIA_BODEGA:
            result.nextState = Logic.transferWarehouseAction(currentState, interpretation as WarehouseTransferInterpretation);
            break;
        case InterpretationType.ASIGNACION_ENTREGA:
            result.nextState = Logic.assignDeliveryAction(currentState, interpretation as AssignmentInterpretation);
            break;
        case InterpretationType.PRESTAMO_CAJA:
            result = Logic.addCrateLoanAction(currentState, interpretation as CrateLoanInterpretation);
            break;
        case InterpretationType.LLEGADA_EMPLEADO:
            result.nextState = Logic.addActivityAction(currentState, interpretation as EmployeeCheckInInterpretation);
            break;
        case InterpretationType.CAMBIO_VISTA:
            result.nextState = Logic.changeViewAction(currentState, interpretation as ViewChangeInterpretation);
            break;
        case InterpretationType.APLICAR_FILTRO:
            result.nextState = Logic.applyFilterAction(currentState, interpretation as FilterInterpretation);
            break;
        case InterpretationType.CREAR_OFERTA:
            result.nextState = Logic.createOfferAction(currentState, interpretation as OfferInterpretation);
            break;
    }

    const finalMessages: Message[] = result.nextState.messages.map((item) =>
        item.id === messageId ? { ...item, status: 'approved' as const } : item,
    );
    if (result.notification) {
        finalMessages.push({
            id: `msg_sys_${Date.now()}`,
            sender: 'Sistema',
            text: result.notification.text,
            timestamp: new Date(),
            status: 'approved' as const,
            isSystemNotification: true,
        });
    }

    return {
        nextState: {
            ...result.nextState,
            messages: finalMessages,
        },
        interpretation,
    };
};

const canUserSwitchRoles = (profile: AuthSessionProfile | null | undefined) =>
    !profile || profile.role === 'Admin' || profile.canSwitchRoles;

const getTaskTargetView = (task: TaskAssignment): View => {
    switch (task.kind) {
        case 'PACK_ORDER':
        case 'ASSIGN_DELIVERY':
        case 'DELIVER_ORDER':
            return 'deliveries';
        default:
            return 'actions';
    }
};

const getTaskActionType = (task: TaskAssignment): ActionItem['type'] => {
    switch (task.kind) {
        case 'PACK_ORDER':
            return 'PACK_ORDER';
        case 'ASSIGN_DELIVERY':
        case 'DELIVER_ORDER':
            return 'ASSIGN_DELIVERY';
        default:
            return 'SMART_MOVE';
    }
};

const buildHydratedState = (
    storageKey: string,
    snapshot: Record<string, unknown> | null | undefined,
    profile: AuthSessionProfile | null | undefined,
) => {
    const localFallbackState = readLocalBusinessState(storageKey) || createDefaultBusinessState();
    return snapshot ? hydrateBusinessState(snapshot, localFallbackState, profile || null) : localFallbackState;
};

const normalizeCorrectedInterpretation = (message: Message, interpretation: ParsedMessage): ParsedMessage => ({
    ...interpretation,
    originalMessage: interpretation.originalMessage || message.text,
    sender: interpretation.sender || message.sender,
});

const buildUnknownInterpretation = (message: Message, explanation: string): ParsedMessage => ({
    type: InterpretationType.DESCONOCIDO,
    originalMessage: message.text,
    certainty: 0.1,
    explanation,
    data: {},
    sender: message.sender,
});

const updateMessageCollection = (
    messages: Message[],
    messageId: string,
    updater: (message: Message) => Message,
) => messages.map((message) => (message.id === messageId ? updater(message) : message));

const buildCorrectionUndoState = (message: Message, actionId?: string) => ({
    actionId,
    previousInterpretation: message.interpretation,
    previousStatus: message.status,
});

const applyCorrectionToMessage = (
    message: Message,
    interpretation: ParsedMessage,
    correctionSource: Message,
    actionId?: string,
): Message => ({
    ...message,
    interpretation,
    status: 'interpreted',
    undoState: {
        ...message.undoState,
        correction: buildCorrectionUndoState(correctionSource, actionId),
    },
});

const clearCorrectionUndoState = (message: Message): Message => {
    if (!message.undoState?.correction) return message;

    const nextUndoState = { ...message.undoState };
    delete nextUndoState.correction;

    return {
        ...message,
        undoState: Object.keys(nextUndoState).length ? nextUndoState : undefined,
    };
};

const applyApprovalUndoState = (
    state: BusinessState,
    messageId: string,
    approvalSnapshot: ReturnType<typeof buildPersistableSnapshot>,
    actionId?: string,
): BusinessState => ({
    ...state,
    messages: updateMessageCollection(state.messages, messageId, (message) => ({
        ...message,
        status: 'approved',
        undoState: {
            ...message.undoState,
            approval: {
                actionId,
                snapshot: approvalSnapshot,
                previousStatus: message.status,
            },
        },
    })),
});

export const useBusinessData = (options: UseBusinessDataOptions = {}) => {
    const storageKey = options.storageKey || getBusinessDataStorageKey(options.authProfile?.id || 'local');

    const [state, setState] = useState<BusinessState>(() => buildHydratedState(storageKey, options.hydratedSnapshot, options.authProfile));
    const stateRef = useRef(state);

    const lastStorageKeyRef = useRef(storageKey);
    const lastHydrationKeyRef = useRef<string | null>(options.hydrationKey || null);
    const remoteVersionRef = useRef<number>(options.remoteVersion || 0);
    const currentEmployee = useMemo(
        () => resolveCurrentEmployee(state, options.authProfile || null),
        [options.authProfile, state],
    );

    const syncLocalRuntimeSlices = useCallback(
        (nextState: BusinessState): BusinessState => {
            const runtime = readRemoteOperationalRuntime(
                buildPersistableSnapshot(nextState) as unknown as Record<string, unknown>,
                { profile: options.authProfile || null },
            );

            return {
                ...nextState,
                presenceRoster: runtime.presenceRoster,
                operationalExceptions: runtime.operationalExceptions,
            };
        },
        [options.authProfile],
    );

    const inventoryActions = useInventoryActions(setState);
    const salesActions = useSalesActions(setState);
    const catalogActions = useCatalogActions(setState);
    const systemActions = useSystemActions(setState);

    stateRef.current = state;

    useEffect(() => {
        if (storageKey === lastStorageKeyRef.current) return;
        setState(buildHydratedState(storageKey, options.hydratedSnapshot, options.authProfile));
        lastStorageKeyRef.current = storageKey;
    }, [options.authProfile, options.hydratedSnapshot, storageKey]);

    useEffect(() => {
        if (!options.hydrationKey || options.hydrationKey === lastHydrationKeyRef.current) return;
        setState((currentState) => hydrateBusinessState(options.hydratedSnapshot, currentState, options.authProfile || null));
        lastHydrationKeyRef.current = options.hydrationKey;
    }, [options.authProfile, options.hydratedSnapshot, options.hydrationKey]);

    useEffect(() => {
        if (typeof options.remoteVersion === 'number') {
            remoteVersionRef.current = options.remoteVersion;
        }
    }, [options.remoteVersion]);

    useEffect(() => {
        setState((currentState) => {
            const nextTaskAssignments = syncOperationalTaskAssignments(currentState);
            return nextTaskAssignments === currentState.taskAssignments
                ? currentState
                : { ...currentState, taskAssignments: nextTaskAssignments };
        });
    }, [state.employees, state.sales, state.taskAssignments]);

    useEffect(() => {
        setState((currentState) => {
            const nextTaskReports = syncTaskReportsWithTasks(currentState);
            return nextTaskReports === currentState.taskReports
                ? currentState
                : { ...currentState, taskReports: nextTaskReports };
        });
    }, [state.taskAssignments, state.taskReports]);

    useEffect(() => {
        writeLocalBusinessState(storageKey, state);
    }, [state, storageKey]);

    useEffect(() => {
        if (!options.onPersistRemoteState) return;

        const persistHandle = window.setTimeout(() => {
            const snapshot = buildPersistableSnapshot(state);
            void options
                .onPersistRemoteState?.(snapshot, remoteVersionRef.current)
                .then((result) => {
                    remoteVersionRef.current = result.version;
                })
                .catch((error) => {
                    console.error('No se pudo persistir el snapshot en PocketBase.', error);
                });
        }, 650);

        return () => window.clearTimeout(persistHandle);
    }, [options.onPersistRemoteState, state]);

    const addInterpretedMessage = useCallback((interpretation: ParsedMessage) => {
        const messageId = `msg_reco_${Date.now()}`;
        const newMessage: Message = {
            id: messageId,
            sender: interpretation.sender || 'Sistema (Recomendacion)',
            text: interpretation.originalMessage,
            timestamp: new Date(),
            status: 'interpreted',
            interpretation,
        };
        setState((currentState) => ({
            ...currentState,
            messages: [...currentState.messages, newMessage],
            currentView: 'messages',
        }));
        return messageId;
    }, []);

    const generateActionItems = useCallback(() => {
        const items: ActionItem[] = [];
        const now = new Date();
        const visibleTasks = state.taskAssignments.filter((task) => {
            if (task.status === 'done') return false;

            if (state.currentRole === 'Admin' || state.currentRole === 'Cajero') {
                return true;
            }

            if (task.role !== state.currentRole) return false;
            if (!task.employeeId) return true;
            return currentEmployee ? task.employeeId === currentEmployee.id : true;
        });

        visibleTasks.forEach((task) => {
            const ctaText =
                task.status === 'blocked'
                    ? 'Resolver'
                    : task.status === 'assigned'
                      ? 'Abrir'
                      : task.status === 'acknowledged'
                        ? 'Seguir'
                        : 'Atender';

            items.push({
                id: `action_task_${task.id}`,
                type: getTaskActionType(task),
                title: task.title,
                description:
                    task.status === 'blocked' && task.blockReason
                        ? `${task.description}. Bloqueo: ${task.blockReason}`
                        : task.description,
                relatedId: task.saleId || task.id,
                cta: { text: ctaText, targetView: getTaskTargetView(task) },
            });
        });

        state.crateLoans
            .filter((loan) => loan.status === 'Prestado' && new Date(loan.dueDate) < now)
            .forEach((loan) => {
                const crateType = state.crateTypes.find((item) => item.id === loan.crateTypeId);
                items.push({
                    id: `action_crate_${loan.id}`,
                    type: 'FOLLOW_UP_CRATE',
                    title: 'Seguimiento de caja vencida',
                    description: `${loan.quantity} x ${crateType?.name || 'Caja'} para ${loan.customer}`,
                    relatedId: loan.id,
                    cta: { text: 'Ver Cliente', targetView: 'customers' },
                });
            });

        state.purchaseOrders
            .filter((purchaseOrder) => purchaseOrder.status === 'Ordenado')
            .forEach((purchaseOrder) => {
                items.push({
                    id: `action_po_${purchaseOrder.id}`,
                    type: 'CONFIRM_PURCHASE_ORDER',
                    title: 'Confirmar recepcion de mercancia',
                    description: `De ${state.suppliers.find((supplier) => supplier.id === purchaseOrder.supplierId)?.name || 'N/A'}`,
                    relatedId: purchaseOrder.id,
                    cta: { text: 'Ver Orden', targetView: 'suppliers' },
                });
            });

        state.inventory.forEach((batch) => {
            if ((batch.state === 'Maduro' || batch.state === 'Suave') && batch.location === 'Cámara Fría') {
                const productInfo = state.productGroups
                    .flatMap((productGroup) => productGroup.varieties.map((variety) => ({ ...variety, groupName: productGroup.name })))
                    .find((variety) => variety.id === batch.varietyId);
                items.push({
                    id: `action_move_out_${batch.id}`,
                    type: 'SMART_MOVE',
                    title: 'Sacar a piso',
                    description: `${batch.quantity} ${productInfo?.name} ${batch.size} (${batch.state}) en camara.`,
                    relatedId: batch.id,
                    cta: { text: 'Ir a Inventario', targetView: 'inventory' },
                });
            }
        });

        setState((currentState) => ({ ...currentState, actionItems: items }));
    }, [
        currentEmployee,
        state.crateLoans,
        state.crateTypes,
        state.currentRole,
        state.inventory,
        state.productGroups,
        state.purchaseOrders,
        state.suppliers,
        state.taskAssignments,
    ]);

    const generateProactiveRecommendations = useCallback(() => {
        const recommendations: InventoryRecommendation[] = [];
        const weekday = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const today = new Date();
        const todayDay = weekday[today.getDay()];

        state.customers.forEach((customer) => {
            if (!customer.schedule?.days.includes(todayDay)) return;

            const customerDebt = state.sales
                .filter((sale) => saleBelongsToCustomer(sale, customer) && sale.paymentStatus === 'En Deuda' && sale.status === 'Completado')
                .reduce((sum, sale) => sum + sale.price, 0);
            const pendingCrates = state.crateLoans.filter((loan) => loanBelongsToCustomer(loan, customer) && loan.status === 'Prestado' && new Date(loan.dueDate) < today);

            if (customerDebt > 1000 || pendingCrates.length > 0) {
                let message = `Hola ${customer.name}. Te preparamos tu pedido de hoy?`;
                if (customerDebt > 1000) {
                    const suggestedPayment = Math.round((customerDebt * 0.15) / 100) * 100;
                    message += ` Para ayudarte a ponerte al dia, puedes abonar ${suggestedPayment.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}.`;
                }
                if (pendingCrates.length > 0) {
                    const crateCount = pendingCrates.reduce((sum, loan) => sum + loan.quantity, 0);
                    message += ` Tambien te recordamos devolver ${crateCount} caja(s) pendientes.`;
                }

                recommendations.push({
                    id: `reco_msg_${customer.id}`,
                    type: 'PROACTIVE_MESSAGE',
                    reason: `${customer.name} tiene deuda o cajas pendientes y compra los ${todayDay}.`,
                    data: {
                        customerName: customer.name,
                        suggestedMessage: message,
                    },
                });
            }
        });

        setState((currentState) => ({ ...currentState, inventoryRecommendations: recommendations }));
    }, [state.crateLoans, state.customers, state.sales]);

    useEffect(() => {
        const recommendationTimer = window.setTimeout(generateProactiveRecommendations, 2000);
        const actionTimer = window.setTimeout(generateActionItems, 1000);
        return () => {
            window.clearTimeout(recommendationTimer);
            window.clearTimeout(actionTimer);
        };
    }, [generateActionItems, generateProactiveRecommendations]);

    const acknowledgeTask = useCallback((taskId: string) => {
        setState((currentState) =>
            syncLocalRuntimeSlices(
                updateTaskAssignmentStatus(
                    currentState,
                    taskId,
                    'acknowledged',
                    currentEmployee ? { employeeId: currentEmployee.id, employeeName: currentEmployee.name } : undefined,
                ),
            ),
        );
    }, [currentEmployee, syncLocalRuntimeSlices]);

    const startTask = useCallback((taskId: string) => {
        setState((currentState) =>
            syncLocalRuntimeSlices(
                updateTaskAssignmentStatus(
                    currentState,
                    taskId,
                    'in_progress',
                    currentEmployee ? { employeeId: currentEmployee.id, employeeName: currentEmployee.name } : undefined,
                ),
            ),
        );
    }, [currentEmployee, syncLocalRuntimeSlices]);

    const blockTask = useCallback((taskId: string, reason: string) => {
        setState((currentState) =>
            syncLocalRuntimeSlices(
                updateTaskAssignmentStatus(
                    currentState,
                    taskId,
                    'blocked',
                    currentEmployee ? { employeeId: currentEmployee.id, employeeName: currentEmployee.name } : undefined,
                    reason,
                ),
            ),
        );
    }, [currentEmployee, syncLocalRuntimeSlices]);

    const completeTask = useCallback((taskId: string) => {
        setState((currentState) =>
            syncLocalRuntimeSlices(
                updateTaskAssignmentStatus(
                    currentState,
                    taskId,
                    'done',
                    currentEmployee ? { employeeId: currentEmployee.id, employeeName: currentEmployee.name } : undefined,
                ),
            ),
        );
    }, [currentEmployee, syncLocalRuntimeSlices]);

    const submitTaskReport = useCallback(
        async (taskId: string, report: TaskReportInput | Record<string, unknown>) => {
            const currentState = stateRef.current;
            const normalizedReport = normalizeTaskReportInput(report);
            if (!normalizedReport) return null;
            const actor = currentEmployee ? { employeeId: currentEmployee.id, employeeName: currentEmployee.name } : undefined;
            const localResult = submitTaskReportLocally(currentState, taskId, normalizedReport, actor);
            if (!localResult.report) return null;

            setState(syncLocalRuntimeSlices(localResult.nextState));

            if (options.onSubmitRemoteTaskReport) {
                try {
                    const result = await options.onSubmitRemoteTaskReport(
                        buildPersistableSnapshot(localResult.nextState),
                        taskId,
                        normalizedReport,
                        remoteVersionRef.current,
                    );

                    if (result?.snapshot && typeof result.version === 'number') {
                        remoteVersionRef.current = result.version;
                        setState((previousState) => hydrateBusinessState(result.snapshot, previousState, options.authProfile || null));
                    }
                } catch (error) {
                    if (error instanceof PocketBaseSyncError && error.code === 'conflict') {
                        console.error('No se pudo enviar el reporte de tarea en PocketBase por un conflicto de version.', error);
                        return localResult.report;
                    }

                    console.error('No se pudo enviar el reporte de tarea en PocketBase. Seguimos con el flujo local.', error);
                }
            }

            return localResult.report;
        },
        [currentEmployee, options.authProfile, options.onSubmitRemoteTaskReport, syncLocalRuntimeSlices],
    );

    const reassignTask = useCallback(
        async (
            taskId: string,
            assignee: { employeeId?: string | null; employeeName?: string | null; reason?: string },
            exception?: OperationalException | null,
        ) => {
            const currentState = stateRef.current;
            const localState = syncLocalRuntimeSlices(
                reassignTaskAssignment(currentState, taskId, assignee, { reason: assignee.reason }),
            );

            setState(localState);

            if (!options.onReassignRemoteTask) {
                return true;
            }

            try {
                const exceptionRecord =
                    exception
                    || currentState.operationalExceptions.find(
                        (item) => item.taskId === taskId && item.status !== 'resolved',
                    )
                    || ({
                        id: `task-reassign:${taskId}`,
                        kind: 'task_blocked',
                        severity: 'high',
                        status: 'open',
                        title: 'Reasignacion operativa',
                        summary: assignee.reason || 'Reasignada desde operacion',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        taskId,
                        employeeId: assignee.employeeId || null,
                        employeeName: assignee.employeeName || null,
                        source: 'local',
                        meta: null,
                    } satisfies OperationalException);
                const result = await options.onReassignRemoteTask(
                    buildPersistableSnapshot(localState),
                    exceptionRecord,
                    assignee,
                    remoteVersionRef.current,
                );

                if (result?.snapshot && typeof result.version === 'number') {
                    remoteVersionRef.current = result.version;
                    setState((previousState) => hydrateBusinessState(result.snapshot, previousState, options.authProfile || null));
                }
            } catch (error) {
                if (error instanceof PocketBaseSyncError && error.code === 'conflict') {
                    console.error('No se pudo reasignar la tarea en PocketBase por un conflicto de version.', error);
                    return false;
                }

                console.error('No se pudo reasignar la tarea en PocketBase. Seguimos con el flujo local.', error);
            }

            return true;
        },
        [options.authProfile, options.onReassignRemoteTask, syncLocalRuntimeSlices],
    );

    const resolveException = useCallback(
        async (
            exception: OperationalException,
            resolution: { nextTaskStatus?: TaskStatus; resolutionNote?: string } = {},
        ) => {
            const currentState = stateRef.current;
            const actor = currentEmployee ? { employeeId: currentEmployee.id, employeeName: currentEmployee.name } : undefined;
            const localResult = resolveOperationalExceptionLocally(currentState, exception, actor, resolution);
            const localState = syncLocalRuntimeSlices(localResult.nextState);
            setState(localState);

            if (!options.onResolveRemoteException) {
                return true;
            }

            try {
                const result = await options.onResolveRemoteException(
                    buildPersistableSnapshot(localState),
                    exception,
                    resolution,
                    remoteVersionRef.current,
                );

                if (result?.snapshot && typeof result.version === 'number') {
                    remoteVersionRef.current = result.version;
                    setState((previousState) => hydrateBusinessState(result.snapshot, previousState, options.authProfile || null));
                }
            } catch (error) {
                if (error instanceof PocketBaseSyncError && error.code === 'conflict') {
                    console.error('No se pudo resolver la excepcion en PocketBase por un conflicto de version.', error);
                    return false;
                }

                console.error('No se pudo resolver la excepcion en PocketBase. Seguimos con el flujo local.', error);
            }

            return true;
        },
        [currentEmployee, options.authProfile, options.onResolveRemoteException, syncLocalRuntimeSlices],
    );

    const followUpException = useCallback(
        async (
            exception: OperationalException,
            followUp: OperationalExceptionFollowUpInput = {},
        ) => {
            const currentState = stateRef.current;
            const actor = currentEmployee ? { employeeId: currentEmployee.id, employeeName: currentEmployee.name } : undefined;
            const localResult = followUpOperationalExceptionLocally(currentState, exception, actor, followUp);
            const localState = syncLocalRuntimeSlices(localResult.nextState);
            setState(localState);

            if (!options.onFollowUpRemoteException) {
                return true;
            }

            try {
                const result = await options.onFollowUpRemoteException(
                    buildPersistableSnapshot(localState),
                    exception,
                    followUp,
                    remoteVersionRef.current,
                );

                if (result?.snapshot && typeof result.version === 'number') {
                    remoteVersionRef.current = result.version;
                    setState((previousState) => hydrateBusinessState(result.snapshot, previousState, options.authProfile || null));
                }
            } catch (error) {
                if (error instanceof PocketBaseSyncError && error.code === 'conflict') {
                    console.error('No se pudo registrar el seguimiento en PocketBase por un conflicto de version.', error);
                    return false;
                }

                console.error('No se pudo registrar el seguimiento en PocketBase. Seguimos con el flujo local.', error);
            }

            return true;
        },
        [currentEmployee, options.authProfile, options.onFollowUpRemoteException, syncLocalRuntimeSlices],
    );

    const addMessage = useCallback((text: string, sender: string) => {
        setState((currentState) => ({
            ...currentState,
            messages: [...currentState.messages, { id: `msg_${Date.now()}`, sender, text, timestamp: new Date(), status: 'pending' }],
        }));
    }, []);

    const markMessageAsInterpreting = useCallback((messageId: string) => {
        setState((currentState) => ({
            ...currentState,
            messages: currentState.messages.map((message) => (message.id === messageId ? { ...message, status: 'interpreting' } : message)),
        }));
    }, []);

    const setInterpretationForMessage = useCallback((messageId: string, interpretation: ParsedMessage) => {
        setState((currentState) => ({
            ...currentState,
            messages: currentState.messages.map((message) =>
                message.id === messageId ? { ...message, interpretation, status: 'interpreted' } : message,
            ),
        }));
    }, []);

    const correctInterpretation = useCallback(
        async (messageId: string, interpretation: ParsedMessage) => {
            const currentState = stateRef.current;
            const message = currentState.messages.find((item) => item.id === messageId);
            if (!message) return;

            const normalizedInterpretation = normalizeCorrectedInterpretation(message, interpretation);
            const correctedMessages = updateMessageCollection(currentState.messages, messageId, (currentMessage) =>
                currentMessage.id === messageId
                    ? applyCorrectionToMessage(currentMessage, normalizedInterpretation, message)
                    : currentMessage,
            );
            const correctedState = {
                ...currentState,
                messages: correctedMessages,
            };
            const correctedMessage = correctedMessages.find((currentMessage) => currentMessage.id === messageId) || {
                ...message,
                interpretation: normalizedInterpretation,
                status: 'interpreted' as const,
            };

            setState(correctedState);

            if (options.onCorrectRemoteInterpretation) {
                try {
                    const result = await options.onCorrectRemoteInterpretation(
                        buildPersistableSnapshot(correctedState),
                        messageId,
                        correctedMessage,
                        normalizedInterpretation,
                        remoteVersionRef.current,
                    );

                    if (result?.snapshot && typeof result.version === 'number') {
                        remoteVersionRef.current = result.version;
                        setState((previousState) => {
                            const hydratedState = hydrateBusinessState(result.snapshot, previousState, options.authProfile || null);
                            return {
                                ...hydratedState,
                                messages: updateMessageCollection(hydratedState.messages, messageId, (currentMessage) =>
                                    currentMessage.id === messageId
                                        ? applyCorrectionToMessage(
                                              currentMessage,
                                              normalizeCorrectedInterpretation(message, result.interpretation || normalizedInterpretation),
                                              message,
                                              result.actionLogId,
                                          )
                                        : currentMessage,
                                ),
                            };
                        });
                        return;
                    }

                    if (result?.interpretation) {
                        setState((previousState) => ({
                            ...previousState,
                            messages: updateMessageCollection(previousState.messages, messageId, (currentMessage) =>
                                currentMessage.id === messageId
                                    ? applyCorrectionToMessage(
                                          currentMessage,
                                          normalizeCorrectedInterpretation(message, result.interpretation as ParsedMessage),
                                          message,
                                          result.actionLogId,
                                      )
                                    : currentMessage,
                            ),
                        }));
                        return;
                    }
                } catch (error) {
                    if (error instanceof PocketBaseSyncError && error.code === 'conflict') {
                        console.error('No se pudo corregir la interpretacion en PocketBase por un conflicto de version.', error);
                        return;
                    }

                    console.error('No se pudo corregir la interpretacion en PocketBase. Seguimos con el flujo local.', error);
                }
            }
        },
        [options.authProfile, options.onCorrectRemoteInterpretation],
    );

    const interpretPendingMessage = useCallback(
        async (messageId: string) => {
            const currentState = stateRef.current;
            const message = currentState.messages.find((item) => item.id === messageId);
            if (!message || message.status !== 'pending') return;

            markMessageAsInterpreting(messageId);

            const interpretLocally = async () => {
                const { interpretMessage } = await import('../services/geminiService');
                return interpretMessage(message.text, message.sender, currentState.systemPrompt);
            };

            try {
                if (options.onInterpretRemoteMessage) {
                    const remoteResult = await options.onInterpretRemoteMessage(
                        buildPersistableSnapshot(currentState),
                        messageId,
                        message,
                        remoteVersionRef.current,
                    );

                    if (remoteResult?.snapshot && typeof remoteResult.version === 'number') {
                        remoteVersionRef.current = remoteResult.version;
                        setState((previousState) => {
                            const hydratedState = hydrateBusinessState(remoteResult.snapshot, previousState, options.authProfile || null);
                            if (!remoteResult.interpretation) {
                                return hydratedState;
                            }

                            return {
                                ...hydratedState,
                                messages: hydratedState.messages.map((currentMessage) =>
                                    currentMessage.id === messageId
                                        ? { ...currentMessage, interpretation: remoteResult.interpretation, status: 'interpreted' }
                                        : currentMessage,
                                ),
                            };
                        });
                        return;
                    }

                    if (remoteResult?.interpretation) {
                        setInterpretationForMessage(messageId, remoteResult.interpretation);
                        return;
                    }
                }
            } catch (error) {
                if (error instanceof PocketBaseSyncError && error.code === 'conflict') {
                    console.error('No se pudo interpretar el mensaje en PocketBase por un conflicto de version.', error);
                    setState((previousState) => ({
                        ...previousState,
                        messages: previousState.messages.map((currentMessage) =>
                            currentMessage.id === messageId && currentMessage.status === 'interpreting'
                                ? { ...currentMessage, status: 'pending' }
                                : currentMessage,
                        ),
                    }));
                    return;
                }

                console.error('No se pudo interpretar el mensaje en PocketBase. Seguimos con la interpretacion local.', error);
            }

            try {
                const localInterpretation = await interpretLocally();
                setInterpretationForMessage(messageId, localInterpretation);
            } catch (error) {
                console.error('No se pudo interpretar el mensaje ni en remoto ni en local.', error);
                setInterpretationForMessage(
                    messageId,
                    buildUnknownInterpretation(message, 'No se pudo procesar el mensaje en este momento.'),
                );
            }
        },
        [markMessageAsInterpreting, options.authProfile, options.onInterpretRemoteMessage, setInterpretationForMessage],
    );

    const approveInterpretation = useCallback(
        async (messageId: string) => {
            const currentState = stateRef.current;
            const message = currentState.messages.find((item) => item.id === messageId);
            if (!message?.interpretation) return;
            const approvalSnapshot = buildPersistableSnapshot(currentState);

            if (options.onApproveRemoteInterpretation) {
                try {
                    const result = await options.onApproveRemoteInterpretation(
                        buildPersistableSnapshot(currentState),
                        messageId,
                        message,
                        remoteVersionRef.current,
                    );
                    remoteVersionRef.current = result.version;
                    setState((previousState) =>
                        applyApprovalUndoState(
                            applyUiInterpretationState(
                                hydrateBusinessState(result.snapshot, previousState, options.authProfile || null),
                                message.interpretation as ParsedMessage,
                            ),
                            messageId,
                            approvalSnapshot,
                            result.actionLogId,
                        ),
                    );
                    return;
                } catch (error) {
                    if (!(error instanceof PocketBaseSyncError) || (error.code !== 'offline' && error.code !== 'cancelled')) {
                        console.error('No se pudo aprobar la accion en PocketBase.', error);
                        return;
                    }
                }
            }

            setState((previousState) => applyApprovalUndoState(applyInterpretationLocally(previousState, messageId).nextState, messageId, approvalSnapshot));
        },
        [options.authProfile, options.onApproveRemoteInterpretation],
    );

    const revertInterpretation = useCallback(
        async (messageId: string) => {
            const currentState = stateRef.current;
            const message = currentState.messages.find((item) => item.id === messageId);
            if (!message) return;

            const approvalUndo = message.undoState?.approval;
            const approvalSnapshot = approvalUndo?.snapshot;
            if (approvalUndo) {
                if (options.onRevertRemoteInterpretation) {
                    try {
                        const result = await options.onRevertRemoteInterpretation(
                            buildPersistableSnapshot(currentState),
                            messageId,
                            message,
                            remoteVersionRef.current,
                            approvalUndo.actionId,
                        );

                        if (result?.snapshot && typeof result.version === 'number') {
                            remoteVersionRef.current = result.version;
                            setState((previousState) => hydrateBusinessState(result.snapshot, previousState, options.authProfile || null));
                            return;
                        }
                    } catch (error) {
                        if (error instanceof PocketBaseSyncError && error.code === 'conflict') {
                            console.error('No se pudo revertir la aprobacion en PocketBase por un conflicto de version.', error);
                        } else {
                            console.error('No se pudo revertir la aprobacion en PocketBase. Seguimos con el flujo local.', error);
                        }
                    }
                }

                if (!approvalSnapshot) return;

                const revertedState = hydrateBusinessState(approvalSnapshot, currentState, options.authProfile || null);
                setState(revertedState);
                return;
            }

            const correctionUndo = message.undoState?.correction;
            if (!correctionUndo) return;

            const revertedMessages = updateMessageCollection(currentState.messages, messageId, (currentMessage) =>
                currentMessage.id === messageId
                    ? clearCorrectionUndoState({
                          ...currentMessage,
                          interpretation: correctionUndo.previousInterpretation,
                          status: correctionUndo.previousStatus,
                      })
                    : currentMessage,
            );
            const revertedState = {
                ...currentState,
                messages: revertedMessages,
            };
            const revertedMessage = revertedMessages.find((item) => item.id === messageId);

            setState(revertedState);

            if (!options.onRevertRemoteInterpretation || !revertedMessage) return;

            try {
                const result = await options.onRevertRemoteInterpretation(
                    buildPersistableSnapshot(revertedState),
                    messageId,
                    revertedMessage,
                    remoteVersionRef.current,
                    correctionUndo.actionId,
                );

                if (result?.snapshot && typeof result.version === 'number') {
                    remoteVersionRef.current = result.version;
                    setState((previousState) => hydrateBusinessState(result.snapshot, previousState, options.authProfile || null));
                }
            } catch (error) {
                if (error instanceof PocketBaseSyncError && error.code === 'conflict') {
                    console.error('No se pudo revertir la correccion en PocketBase por un conflicto de version.', error);
                    return;
                }

                console.error('No se pudo revertir la correccion en PocketBase. Seguimos con el flujo local.', error);
            }
        },
        [options.authProfile, options.onRevertRemoteInterpretation],
    );

    const generateCustomerSummary = useCallback(
        async (customerId: string) => {
            setState((currentState) => ({ ...currentState, isGeneratingSummary: true, aiCustomerSummary: null }));

            const customer = state.customers.find((item) => item.id === customerId);
            if (!customer) {
                setState((currentState) => ({
                    ...currentState,
                    isGeneratingSummary: false,
                    aiCustomerSummary: { content: '', error: 'Cliente no encontrado' },
                }));
                return;
            }

            const customerSales = state.sales.filter((sale) => saleBelongsToCustomer(sale, customer));
            const customerPayments = state.payments.filter((payment) => payment.customerId === customerId);
            const customerCrateLoans = state.crateLoans.filter((loan) => loanBelongsToCustomer(loan, customer));

            try {
                const { generateCustomerInsights } = await import('../services/geminiService');
                const summary = await generateCustomerInsights(customer, customerSales, customerPayments, customerCrateLoans, state.crateTypes);
                setState((currentState) => ({
                    ...currentState,
                    isGeneratingSummary: false,
                    aiCustomerSummary: { content: summary, error: null },
                }));
            } catch (error: unknown) {
                setState((currentState) => ({
                    ...currentState,
                    isGeneratingSummary: false,
                    aiCustomerSummary: { content: '', error: error instanceof Error ? error.message : 'Error al generar resumen.' },
                }));
            }
        },
        [state],
    );

    const authCanSwitchRoles = useMemo(() => canUserSwitchRoles(options.authProfile), [options.authProfile]);

    const setCurrentRole = useCallback(
        (role: UserRole, entityId?: string) => {
            setState((currentState) => {
                if (!authCanSwitchRoles && options.authProfile) {
                    return {
                        ...currentState,
                        currentRole: options.authProfile.role,
                        currentCustomerId: options.authProfile.role === 'Cliente' ? options.authProfile.customerId : null,
                        currentSupplierId: options.authProfile.role === 'Proveedor' ? options.authProfile.supplierId : null,
                    };
                }

                let customerId: string | null = null;
                let supplierId: string | null = null;
                if (role === 'Cliente') customerId = entityId || currentState.customers[0]?.id || null;
                if (role === 'Proveedor') supplierId = entityId || currentState.suppliers[0]?.id || null;

                return {
                    ...currentState,
                    currentRole: role,
                    currentCustomerId: customerId,
                    currentSupplierId: supplierId,
                };
            });
        },
        [authCanSwitchRoles, options.authProfile],
    );

    const toggleTheme = useCallback(() => {
        setState((currentState) => ({ ...currentState, theme: currentState.theme === 'light' ? 'dark' : 'light' }));
    }, []);

    const setCurrentView = useCallback((view: View) => {
        setState((currentState) => ({
            ...currentState,
            currentView: view,
            aiCustomerSummary: view !== 'customers' ? null : currentState.aiCustomerSummary,
        }));
    }, []);

    return {
        ...state,
        ...inventoryActions,
        ...salesActions,
        ...catalogActions,
        ...systemActions,
        setCurrentRole,
        toggleTheme,
        setCurrentView,
        addMessage,
        markMessageAsInterpreting,
        setInterpretationForMessage,
        correctInterpretation,
        revertInterpretation,
        interpretPendingMessage,
        approveInterpretation,
        addInterpretedMessage,
        generateCustomerSummary,
        acknowledgeTask,
        startTask,
        blockTask,
        completeTask,
        submitTaskReport,
        reassignTask,
        resolveException,
        followUpException,
        currentEmployee,
        authEnabled: Boolean(options.authEnabled),
        authProfile: options.authProfile || null,
        authError: options.authError || null,
        workspaceLabel: options.workspaceLabel || null,
        staffPresence: Array.isArray(options.staffPresence) ? options.staffPresence : [],
        exceptionInbox: Array.isArray(options.exceptionInbox) ? options.exceptionInbox : [],
        signOut: options.onSignOut,
        canSwitchRoles: authCanSwitchRoles,
    };
};

export type BusinessData = ReturnType<typeof useBusinessData>;
