import { compactRemoteSnapshot, normalizePersistResult, SnapshotConflictError } from '../domain/snapshotTransport.js';
import { createJsonClient } from './httpClient.js';

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

  return {
    async inspect() {
      const dry = requireBaseUrl();
      if (dry) return dry;

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
      return postSnapshotAction('/api/fideo/bootstrap', { seedSnapshot });
    },
    persist(workspaceId, snapshot, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction('/api/fideo/state/persist', {
        workspaceId,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    followUpException(workspaceId, exception, followUp, expectedVersion) {
      return postSnapshotAction('/api/fideo/exceptions/follow-up', {
        workspaceId,
        exceptionId: exception.id,
        exception,
        followUp,
        expectedVersion,
      });
    },
    reassignException(workspaceId, snapshot, exception, reassignment, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction('/api/fideo/exceptions/reassign', {
        workspaceId,
        exceptionId: exception.id,
        exception,
        reassignment,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
    resolveException(workspaceId, snapshot, exception, resolution, expectedVersion, referenceSnapshot = null) {
      return postSnapshotAction('/api/fideo/exceptions/resolve', {
        workspaceId,
        exceptionId: exception.id,
        exception,
        resolution,
        expectedVersion,
        snapshot: compactRemoteSnapshot(snapshot, referenceSnapshot),
      });
    },
  };
};

