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

Deno.serve(createMessagingRuntime({
  getEnv: (name: string) => Deno.env.get(name),
  cert, initializeApp, deleteApp, getAuth, getDatabase,
  createHistory: createFirebaseMessagingHistoryService,
  createMutation: options => createFirebaseMessagingMutationService({...options,diagnostic: event => console.warn('WB_MESSAGE_FAILURE', JSON.stringify(event))}),
  createDirectory: createFirebaseMessagingDirectoryServices,
  createConversations: createFirebaseMessagingConversationService,
  createApiHandler: createMessagingApiHandler,
  createSupabase: (url: string, key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
  createAttachments: createFirebaseSupabaseAttachmentUploadService,
  createRecordOrigins: options => createFirebaseMessagingRecordOriginService({...options, serverTimestamp: ServerValue.TIMESTAMP}),
}));
