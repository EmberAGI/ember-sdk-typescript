export * from './lib/types/client.js';
export * from './lib/client/ember-client.js';
export * from './generated/onchain-actions.js';

// Re-export the client implementation as the default export
export { EmberGrpcClient as default } from './lib/client/ember-client.js'; 