import { ObjectType, v } from 'convex/values';
import { GameId, agentId, parseGameId } from './ids';

export class AgentDescription {
  agentId: GameId<'agents'>;
  identity: string;
  plan: string;
  walletAddress?: string;  // agent  wallet address
  walletPublicKey?: string;
  encryptedPrivateKey?: string;
  energy: number; // Initial value 100, maximum value 100
  inferences: number; // Initial value 0
  tips: number; // Initial value 0, maximum value 10000
  avatarUrl?: string; // Agent avatar URL
  userWalletAddress?: string; // agent owner's wallet address
  status?: any; // Agent status information
  events?: any[]; // Agent daily events

  constructor(serialized: SerializedAgentDescription) {
    const { agentId, identity, plan, walletAddress, walletPublicKey, encryptedPrivateKey, energy, inferences, tips, avatarUrl, userWalletAddress, status, events } = serialized;
    this.agentId = parseGameId('agents', agentId);
    this.identity = identity;
    this.plan = plan;
    this.walletAddress = walletAddress;
    this.walletPublicKey = walletPublicKey;
    this.encryptedPrivateKey = encryptedPrivateKey;
    this.energy = energy ?? 100; // Default value is 100
    this.inferences = inferences ?? 0; // Default value is 0
    this.tips = tips ?? 0; // Default value is 0
    this.avatarUrl = avatarUrl;
    this.userWalletAddress = userWalletAddress;
    this.status = status;
    this.events = events;
  }

  serialize(): SerializedAgentDescription {
    const { agentId, identity, plan, walletAddress, walletPublicKey, encryptedPrivateKey, energy, inferences, tips, avatarUrl, userWalletAddress, status, events } = this;
    return { 
      agentId, 
      identity, 
      plan,
      walletAddress,
      walletPublicKey, 
      encryptedPrivateKey,
      energy,
      inferences,
      tips,
      avatarUrl,
      userWalletAddress,
      status,
      events
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
  avatarUrl: v.optional(v.string()), // Agent avatar URL
  userWalletAddress: v.optional(v.string()), // agent owner's wallet address
  // Agent status information (optional for backward compatibility)
  status: v.optional(
    v.union(
      v.array(v.object({
        title: v.string(),
        icon: v.string(),
      })),
      v.object({
        emotion: v.string(),
        status: v.string(),
        current_work: v.string(),
        energy_level: v.string(),
        location: v.string(),
        mood_trend: v.string(),
      })
    )
  ),
  // Agent daily events (optional for backward compatibility)
  events: v.optional(v.array(v.object({
    time: v.string(),
    action: v.string(),
    details: v.string(),
  }))),
};
export type SerializedAgentDescription = ObjectType<typeof serializedAgentDescription>;


