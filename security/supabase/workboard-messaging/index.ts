// Edge entrypoint for the existing messaging services. The platform JWT check
// must be replaced by the handler's Firebase ID-token verification, never by
// accepting anonymous application requests. Runtime configuration is deny-first.
import { cert, initializeApp, deleteApp } from 'npm:firebase-admin@14.5.0/app';
import { getAuth } from 'npm:firebase-admin@14.5.0/auth';
import { getDatabase, ServerValue } from 'npm:firebase-admin@14.5.0/database';
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { createMessagingRuntime } from '../../messaging-runtime.mjs';
import { createFirebaseMessagingHistoryService } from '../../messaging-history-service.mjs';
import { createFirebaseMessagingMutationService } from '../../messaging-mutation-service.mjs';
import { createFirebaseMessagingDirectoryServices } from '../../messaging-directory-service.mjs';
import { createFirebaseMessagingConversationService } from '../../messaging-conversation-service.mjs';
import { createMessagingApiHandler } from '../../messaging-api-handler.mjs';
import { createFirebaseSupabaseAttachmentUploadService } from '../../messaging-attachment-storage.mjs';
import { createFirebaseMessagingRecordOriginService } from '../../messaging-record-origin-service.mjs';

// Option shapes come from the trusted service factories themselves, so the
// adapters passed by the runtime stay checked against each service contract.
// What createMessagingRuntime passes to each factory (security/messaging-runtime.mjs).
type SharedAdmin = { auth: ReturnType<typeof getAuth>; database: ReturnType<typeof getDatabase> };
type MutationOptions = SharedAdmin & {
  withActorDatabase: (override: unknown, operation: (database: unknown) => Promise<unknown>) => Promise<unknown>;
  digestKey: Uint8Array;
  reserveSend: unknown;
  claimAttachments?: unknown;
  acquireAttachmentLease?: unknown;
};
type RecordOriginOptions = SharedAdmin;

Deno.serve(createMessagingRuntime({
  getEnv: (name: string) => Deno.env.get(name),
  cert, initializeApp, deleteApp, getAuth, getDatabase,
  createHistory: createFirebaseMessagingHistoryService,
  createMutation: (options: MutationOptions) => createFirebaseMessagingMutationService({...options,diagnostic: (event: {stage: string; kind: string}) => console.warn('WB_MESSAGE_FAILURE', JSON.stringify(event))}),
  createDirectory: createFirebaseMessagingDirectoryServices,
  createConversations: createFirebaseMessagingConversationService,
  createApiHandler: createMessagingApiHandler,
  createSupabase: (url: string, key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
  createAttachments: createFirebaseSupabaseAttachmentUploadService,
  // Deferred feature: wired only when WORKBOARD_MESSAGING_RECORD_LINKS_ENABLED is 'true'.
  createRecordOrigins: (options: RecordOriginOptions) => createFirebaseMessagingRecordOriginService({...options, serverTimestamp: ServerValue.TIMESTAMP}),
}));
