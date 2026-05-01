import { BusinessState, Employee, Sale, TaskAssignment, TaskAssignmentKind, TaskRole, TaskStatus, UserRole } from '../types';

const INTERNAL_ROLE_PRIORITY: TaskRole[] = ['Admin', 'Empacador', 'Repartidor', 'Cajero'];

const isInternalRole = (role: UserRole): role is TaskRole => INTERNAL_ROLE_PRIORITY.includes(role as TaskRole);

const taskIdForSale = (kind: TaskAssignmentKind, saleId: string) => {
    switch (kind) {
        case 'PACK_ORDER':
            return `task_pack_${saleId}`;
        case 'ASSIGN_DELIVERY':
            return `task_assign_${saleId}`;
        case 'DELIVER_ORDER':
            return `task_delivery_${saleId}`;
    }
};

const resolveEmployee = (employees: Employee[], employeeId?: string | null, fallbackRole?: TaskRole): Employee | undefined => {
    if (employeeId) {
        const byId = employees.find((employee) => employee.id === employeeId);
        if (byId) return byId;
    }

    if (!fallbackRole) return undefined;
    return employees.find((employee) => employee.role === fallbackRole);
};

const hydrateTask = (
    existing: TaskAssignment | undefined,
    desired: Omit<TaskAssignment, 'createdAt' | 'updatedAt'>,
    now: Date,
): TaskAssignment => {
    const nextEmployeeId = desired.employeeId ?? existing?.employeeId ?? null;
    const nextEmployeeName = desired.employeeName ?? existing?.employeeName ?? null;
    const assigneeChanged = Boolean(existing && desired.employeeId && existing.employeeId !== desired.employeeId);

    if (!existing) {
        return {
            ...desired,
            employeeId: nextEmployeeId,
            employeeName: nextEmployeeName,
            createdAt: now,
            updatedAt: now,
        };
    }

    const resetForReassignment = assigneeChanged
        ? {
              status: 'assigned' as TaskStatus,
              acknowledgedAt: undefined,
              startedAt: undefined,
              blockedAt: undefined,
              completedAt: undefined,
              blockReason: undefined,
          }
        : {};

    const reopened = existing.status === 'done'
        ? {
              status: 'assigned' as TaskStatus,
              acknowledgedAt: undefined,
              startedAt: undefined,
              blockedAt: undefined,
              completedAt: undefined,
              blockReason: undefined,
          }
        : {};

    const candidate: TaskAssignment = {
        ...existing,
        ...desired,
        employeeId: nextEmployeeId,
        employeeName: nextEmployeeName,
        ...reopened,
        ...resetForReassignment,
        updatedAt: existing.updatedAt,
    };

    const previousComparable = JSON.stringify(existing);
    const nextComparable = JSON.stringify({
        ...candidate,
        updatedAt: existing.updatedAt,
    });

    if (previousComparable === nextComparable) {
        return existing;
    }

    return {
        ...candidate,
        updatedAt: now,
    };
};

const closeTask = (existing: TaskAssignment | undefined, now: Date): TaskAssignment | null => {
    if (!existing) return null;
    if (existing.status === 'done') return existing;

    return {
        ...existing,
        status: 'done',
        blockReason: undefined,
        blockedAt: undefined,
        completedAt: existing.completedAt || now,
        updatedAt: now,
    };
};

const buildPackingTask = (sale: Sale, employee?: Employee): Omit<TaskAssignment, 'createdAt' | 'updatedAt'> => ({
    id: taskIdForSale('PACK_ORDER', sale.id),
    kind: 'PACK_ORDER',
    role: 'Empacador',
    status: 'assigned',
    title: `Empacar ${sale.customer}`,
    description: `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} ${sale.size}`,
    saleId: sale.id,
    employeeId: employee?.id || null,
    employeeName: employee?.name || null,
    customerId: sale.customerId || null,
    customerName: sale.customer,
    priority: 'high',
});

const buildDispatchTask = (sale: Sale): Omit<TaskAssignment, 'createdAt' | 'updatedAt'> => ({
    id: taskIdForSale('ASSIGN_DELIVERY', sale.id),
    kind: 'ASSIGN_DELIVERY',
    role: 'Admin',
    status: 'assigned',
    title: `Asignar ruta ${sale.customer}`,
    description: `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName} ${sale.size}`,
    saleId: sale.id,
    employeeId: null,
    employeeName: null,
    customerId: sale.customerId || null,
    customerName: sale.customer,
    priority: 'high',
});

const buildDeliveryTask = (sale: Sale, employee?: Employee): Omit<TaskAssignment, 'createdAt' | 'updatedAt'> => ({
    id: taskIdForSale('DELIVER_ORDER', sale.id),
    kind: 'DELIVER_ORDER',
    role: 'Repartidor',
    status: 'assigned',
    title: `Entregar ${sale.customer}`,
    description: sale.destination || sale.locationQuery || `${sale.quantity} x ${sale.productGroupName} ${sale.varietyName}`,
    saleId: sale.id,
    employeeId: employee?.id || sale.assignedEmployeeId || null,
    employeeName: employee?.name || null,
    customerId: sale.customerId || null,
    customerName: sale.customer,
    priority: 'high',
});

export const syncOperationalTaskAssignments = (state: BusinessState): TaskAssignment[] => {
    const now = new Date();
    const taskById = new Map(state.taskAssignments.map((task) => [task.id, task]));
    const nextTasks: TaskAssignment[] = [];
    const touched = new Set<string>();

    const pushTask = (task: TaskAssignment | null) => {
        if (!task) return;
        touched.add(task.id);
        nextTasks.push(task);
    };

    state.sales.forEach((sale) => {
        const packingTaskId = taskIdForSale('PACK_ORDER', sale.id);
        const dispatchTaskId = taskIdForSale('ASSIGN_DELIVERY', sale.id);
        const deliveryTaskId = taskIdForSale('DELIVER_ORDER', sale.id);

        if (sale.status === 'Pendiente de Empaque') {
            pushTask(
                hydrateTask(
                    taskById.get(packingTaskId),
                    buildPackingTask(sale, resolveEmployee(state.employees, taskById.get(packingTaskId)?.employeeId, 'Empacador')),
                    now,
                ),
            );
        } else {
            pushTask(closeTask(taskById.get(packingTaskId), now));
        }

        if (sale.status === 'Listo para Entrega' && !sale.assignedEmployeeId) {
            pushTask(hydrateTask(taskById.get(dispatchTaskId), buildDispatchTask(sale), now));
        } else {
            pushTask(closeTask(taskById.get(dispatchTaskId), now));
        }

        if (sale.status === 'En Ruta' && sale.assignedEmployeeId) {
            pushTask(
                hydrateTask(
                    taskById.get(deliveryTaskId),
                    buildDeliveryTask(sale, resolveEmployee(state.employees, sale.assignedEmployeeId, 'Repartidor')),
                    now,
                ),
            );
        } else if (sale.status === 'Completado' || sale.status === 'Cancelado') {
            pushTask(closeTask(taskById.get(deliveryTaskId), now));
        } else if (sale.status !== 'En Ruta') {
            pushTask(closeTask(taskById.get(deliveryTaskId), now));
        }
    });

    state.taskAssignments.forEach((task) => {
        if (!touched.has(task.id)) {
            nextTasks.push(task);
        }
    });

    nextTasks.sort((left, right) => {
        if (left.status === 'done' && right.status !== 'done') return 1;
        if (left.status !== 'done' && right.status === 'done') return -1;

        const leftPriority = left.priority === 'high' ? 1 : 0;
        const rightPriority = right.priority === 'high' ? 1 : 0;
        if (leftPriority !== rightPriority) return rightPriority - leftPriority;

        return right.updatedAt.getTime() - left.updatedAt.getTime();
    });

    const previousComparable = JSON.stringify(state.taskAssignments);
    const nextComparable = JSON.stringify(nextTasks);
    if (previousComparable === nextComparable) {
        return state.taskAssignments;
    }

    return nextTasks;
};

export const updateTaskAssignmentStatus = (
    state: BusinessState,
    taskId: string,
    nextStatus: TaskStatus,
    actor: { employeeId?: string | null; employeeName?: string | null } = {},
    blockReason?: string,
): BusinessState => {
    const now = new Date();
    let changed = false;

    const nextTasks = state.taskAssignments.map((task) => {
        if (task.id !== taskId) return task;

        changed = true;
        return {
            ...task,
            status: nextStatus,
            employeeId: actor.employeeId ?? task.employeeId ?? null,
            employeeName: actor.employeeName ?? task.employeeName ?? null,
            updatedAt: now,
            acknowledgedAt: nextStatus === 'acknowledged' ? task.acknowledgedAt || now : task.acknowledgedAt,
            startedAt: nextStatus === 'in_progress' ? task.startedAt || now : task.startedAt,
            blockedAt: nextStatus === 'blocked' ? now : undefined,
            completedAt: nextStatus === 'done' ? task.completedAt || now : task.completedAt,
            blockReason: nextStatus === 'blocked' ? blockReason || task.blockReason || 'Sin detalle' : undefined,
        };
    });

    if (!changed) return state;

    return {
        ...state,
        taskAssignments: nextTasks,
    };
};

export const resolveCurrentEmployee = (
    state: BusinessState,
    profile: { employeeId?: string | null; role?: UserRole | null; name?: string | null } | null | undefined,
): Employee | null => {
    if (!profile) return null;

    if (profile.employeeId) {
        const byId = state.employees.find((employee) => employee.id === profile.employeeId);
        if (byId) return byId;
    }

    if (profile.name) {
        const normalizedName = profile.name.trim().toLowerCase();
        const byName = state.employees.find((employee) => employee.name.trim().toLowerCase() === normalizedName);
        if (byName) return byName;
    }

    if (profile.role && isInternalRole(profile.role)) {
        return state.employees.find((employee) => employee.role === profile.role) || null;
    }

    return null;
};
