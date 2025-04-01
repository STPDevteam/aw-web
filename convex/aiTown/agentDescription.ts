import { ObjectType, v } from 'convex/values';
import { GameId, agentId, parseGameId } from './ids';

export class AgentDescription {
  agentId: GameId<'agents'>;
  identity: string;
  plan: string;
  walletAddress?: string;
  walletPublicKey?: string;
  encryptedPrivateKey?: string;
  energy: number; // Initial value 100, maximum value 100
  inferences: number; // Initial value 0
  tips: number; // Initial value 0, maximum value 10000

  constructor(serialized: SerializedAgentDescription) {
    const { agentId, identity, plan, walletAddress, walletPublicKey, encryptedPrivateKey, energy, inferences, tips } = serialized;
    this.agentId = parseGameId('agents', agentId);
    this.identity = identity;
    this.plan = plan;
    this.walletAddress = walletAddress;
    this.walletPublicKey = walletPublicKey;
    this.encryptedPrivateKey = encryptedPrivateKey;
    this.energy = energy ?? 100; // Default value is 100
    this.inferences = inferences ?? 0; // Default value is 0
    this.tips = tips ?? 0; // Default value is 0
  }

  serialize(): SerializedAgentDescription {
    const { agentId, identity, plan, walletAddress, walletPublicKey, encryptedPrivateKey, energy, inferences, tips } = this;
    return { 
      agentId, 
      identity, 
      plan,
      walletAddress,
      walletPublicKey, 
      encryptedPrivateKey,
      energy,
      inferences,
      tips
    };
  }
}

export const serializedAgentDescription = {
  agentId,
  identity: v.string(),
  plan: v.string(),
  walletAddress: v.optional(v.string()),
  walletPublicKey: v.optional(v.string()),
  encryptedPrivateKey: v.optional(v.string()),
  energy: v.optional(v.number()), // Initial value 100, maximum value 100
  inferences: v.optional(v.number()), // Initial value 0
  tips: v.optional(v.number()), // Initial value 0, maximum value 10000
};
export type SerializedAgentDescription = ObjectType<typeof serializedAgentDescription>;
