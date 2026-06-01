import { compactRemoteSnapshot, normalizePersistResult, SnapshotConflictError } from '../domain/snapshotTransport.js';
import { createJsonClient } from './httpClient.js';
import { pocketBaseRouteManifest, routeById } from './pocketbaseRoutes.js';

const dryReceipt = (message) => ({
  kind: 'pocketbase',
  status: 'dry-run',
  message,
});

export const createPocketBaseGateway = ({ baseUrl = '' } = {}) => {
  const client = createJsonClient({ baseUrl, browserClient: '' });

  const requireBaseUrl = () => {
    if (!baseUrl) {
      return dryReceipt('PocketBase no esta configurado en este slice estatico.');
    }
    return null;
  };

  const postSnapshotAction = async (path, body) => {
    const dry = requireBaseUrl();
    if (dry) return dry;
    try {
      return normalizePersistResult(await client.post(path, body));
    } catch (error) {
      if (error.payload && Number(error.payload.status) === 409) {
        throw new SnapshotConflictError(error.message, error.payload);
      }
      throw error;
    }
  };

  const routePath = (routeId) => {
    const route = routeById(routeId);
    if (!route) throw new Error(`Ruta PocketBase no registrada: ${routeId}`);
    return route.path;
  };

  return {
    routes() {
      return pocketBaseRouteManifest.map((route) => ({ ...route }));
    },
    async inspect() {
      const dry = requireBaseUrl();
      if (dry) {
        return {
          ...dry,
          routes: pocketBaseRouteManifest.length,
        };
      }

      const response = await fetch(new URL('/api/health', baseUrl).href, {
        credentials: 'same-origin',
      });

      return {
        kind: 'pocketbase',
        status: response.ok ? 'ok' : 'failed',
        message: response.ok ? 'PocketBase responde health.' : `PocketBase HTTP ${response.status}`,
      };
    },
    bootstrap(seedSnapshot) {
      return postSnapshotAction(routePath('bootstrap'), { seedSnapshot });
    },
    presencePing(workspaceId, presence) {
      return postSnapshotAction(routePath('presence_ping'), { workspaceId, presence });
    },
    runtimeOverview(workspaceId) {
      const dry = requireBaseUrl();
      if (dry) return Promise.resolve(dry);
      return client.get(`${routePath('runtime_overview')}?workspaceId=${encodeURIComponent(workspaceId)}`);
    },
    realtimePlan(workspaceId, snapshotRecordId = '') {
      const dry = requireBaseUrl();
      if (dry) return Promise.resolve({ ...dry, realtime: 'disabled' });
      return Promise.resolve({
        kind: 'pocketbase_realtime',
        status: 'planned',
        message: 'Realtime subscribe listo para el adaptador PocketBase.',
        workspaceId,
        snapshotRecordId,
      });
    },
    persist(workspaceId, snapshot, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction(routePath('state_persist'), {
        workspaceId,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    submitTaskReport(workspaceId, snapshot, taskId, report, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction(routePath('tasks_report'), {
        workspaceId,
        taskId,
        report,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    followUpException(workspaceId, exception, followUp, expectedVersion) {
      return postSnapshotAction(routePath('exceptions_follow_up'), {
        workspaceId,
        exceptionId: exception.id,
        exception,
        followUp,
        expectedVersion,
      });
    },
    reassignException(workspaceId, snapshot, exception, reassignment, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction(routePath('exceptions_reassign'), {
        workspaceId,
        exceptionId: exception.id,
        exception,
        reassignment,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    resolveException(workspaceId, snapshot, exception, resolution, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction(routePath('exceptions_resolve'), {
        workspaceId,
        exceptionId: exception.id,
        exception,
        resolution,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    interpretMessage(workspaceId, snapshot, messageId, message, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction(routePath('messages_interpret'), {
        workspaceId,
        messageId,
        message,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    approveMessage(workspaceId, snapshot, messageId, message, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction(routePath('messages_approve'), {
        workspaceId,
        messageId,
        message,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    correctMessage(workspaceId, snapshot, messageId, message, interpretation, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction(routePath('messages_correct'), {
        workspaceId,
        messageId,
        message,
        interpretation,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    revertMessage(workspaceId, snapshot, messageId, message, expectedVersion, actionId = '', referenceSnapshot = null) {
      return postSnapshotAction(routePath('messages_revert'), {
        workspaceId,
        messageId,
        message,
        actionId,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
  };
};
