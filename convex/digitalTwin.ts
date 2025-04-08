import { v } from 'convex/values';
import { internalMutation, internalQuery, internalAction, MutationCtx, QueryCtx, ActionCtx } from './_generated/server';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { chatCompletion } from './util/llm';

// Define response types for better type safety
interface DigitalTwin {
  _id: Id<"digitalTwins">;
  userWalletAddress: string;
  name: string;
  description: string;
  profession: string;
  interest: string;
  createdAt: number;
}

interface WalletUser {
  _id: Id<"walletUsers">;
  walletAddress: string;
  points: number;
  [key: string]: any; // For other fields we don't need to explicitly type
}

interface EngageAgentResult {
  conversation: string[];
  agent: {
    agentId: string;
    name: string;
    identity?: string;
    avatarUrl?: string;
  };
  twin: {
    name: string;
    description: string;
  };
  pointsAwarded: number;
}

// --- Internal Query: Get Digital Twin ---
export const internal_getDigitalTwin = internalQuery({
  args: {
    userWalletAddress: v.string(),
  },
  async handler(ctx: QueryCtx, args): Promise<DigitalTwin | null> {
    const digitalTwin = await ctx.db
      .query("digitalTwins")
      .withIndex("by_userWalletAddress", (q) => q.eq("userWalletAddress", args.userWalletAddress))
      .unique();
    return digitalTwin; // Returns the twin object or null if not found
  },
});

// --- Internal Action: Generate Description using chatCompletion ---
export const internal_generateDescription = internalAction({
    args: {
      profession: v.string(),
      interest: v.string(),
    },
    async handler(ctx: ActionCtx, args): Promise<string> {
      try {
        const prompt = `
          Create a short, compelling, first-person backstory (2-3 sentences) for a digital character
          with the profession "${args.profession}" and primary interest "${args.interest}".
          Focus on making them sound intriguing and unique within a virtual social world.
          Example: "I've wandered these digital streets for longer than I can remember, always searching for the next great story. As a cosmic cartographer, I chart the unseen connections between worlds, but my real passion is uncovering ancient, forgotten melodies."
          ---
          Profession: ${args.profession}
          Interest: ${args.interest}
          ---
          Backstory:
        `;

        const { content: description } = await chatCompletion({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
        });

        if (!description || description.trim() === '') {
          throw new Error('LLM returned an empty description.');
        }

        return description.trim();

      } catch (error) {
        console.error("Error generating description with chatCompletion:", error);
        return `A ${args.profession} deeply interested in ${args.interest}. They possess a unique perspective shaped by their experiences in the digital realm.`;
      }
    },
});

// --- Internal Action: Generate Conversation with Agent ---
export const internal_generateConversation = internalAction({
  args: {
    twinName: v.string(),
    twinDescription: v.string(),
    agentName: v.string(),
    agentDescription: v.string(),
  },
  async handler(ctx: ActionCtx, args): Promise<string[]> {
    try {
      const prompt = `
        Create a natural, friendly conversation between two characters in a virtual world.
        
        CHARACTER 1: ${args.twinName}
        DESCRIPTION: ${args.twinDescription}
        
        CHARACTER 2: ${args.agentName}
        DESCRIPTION: ${args.agentDescription}
        
        Generate exactly 8 messages total - 4 from each character, alternating. Start with ${args.twinName} greeting ${args.agentName}.
        Format each message as "NAME: message text" on separate lines.
        Make the conversation feel natural, friendly, and reflective of both characters' backgrounds and personalities.
        Keep each message relatively short (1-3 sentences).
      `;

      const { content: conversation } = await chatCompletion({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.8,
      });

      if (!conversation || conversation.trim() === '') {
        throw new Error('Failed to generate conversation.');
      }

      // Parse the conversation into an array of messages
      const messages = conversation
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => line.trim());
      
      return messages;
    } catch (error) {
      console.error("Error generating conversation:", error);
      // Fallback basic conversation
      return [
        `${args.twinName}: Hello there! I'm ${args.twinName}.`,
        `${args.agentName}: Nice to meet you! I'm ${args.agentName}.`,
        `${args.twinName}: I'm interested in ${args.twinDescription.split(' ').slice(-5).join(' ')}...`,
        `${args.agentName}: That's fascinating! I'm focused on ${args.agentDescription.split(' ').slice(-5).join(' ')}...`,
        `${args.twinName}: How did you end up in this virtual world?`,
        `${args.agentName}: It's a long story, but I've found my place here.`,
        `${args.twinName}: I hope we can talk again sometime.`,
        `${args.agentName}: Definitely! Looking forward to our next conversation.`
      ];
    }
  },
});

// --- Internal Mutation: Create Digital Twin ---
export const internal_createDigitalTwin = internalMutation({
  args: {
    userWalletAddress: v.string(),
    profession: v.string(),
    interest: v.string(),
    description: v.string(), // Description generated by the action
    name: v.string(), // Name for the twin
    // Add other relevant fields as needed, e.g., avatarUrl, initial stats, etc.
  },
  async handler(ctx: MutationCtx, args): Promise<Id<"digitalTwins">> {
    // 1. Check if a twin already exists for this wallet address
    const existingTwin = await ctx.db
      .query("digitalTwins")
      .withIndex("by_userWalletAddress", (q) => q.eq("userWalletAddress", args.userWalletAddress))
      .unique();

    if (existingTwin) {
      // Throw an error if a twin already exists to prevent duplicates
      // The HTTP handler should catch this and return an appropriate status code (e.g., 409 Conflict)
      throw new Error(`Digital twin already exists for wallet address: ${args.userWalletAddress}`);
    }

    // 2. Find the walletUser to update points
    const walletUser = await ctx.db
      .query("walletUsers")
      .withIndex("walletAddress", (q) => q.eq("walletAddress", args.userWalletAddress))
      .unique();

    if (!walletUser) {
      throw new Error(`User with wallet address ${args.userWalletAddress} not found`);
    }

    // 3. Update the user's points by adding 500
    await ctx.db.patch(walletUser._id, {
      points: (walletUser.points || 0) + 500, // Add 500 points, defaulting to 0 if points is undefined
    });

    // 4. Insert the new digital twin document
    const twinId = await ctx.db.insert("digitalTwins", {
      userWalletAddress: args.userWalletAddress,
      profession: args.profession,
      interest: args.interest,
      description: args.description,
      name: args.name,
      // Initialize any other fields here
      createdAt: Date.now(), // Add a timestamp
    });

    return twinId; // Return the ID of the newly created twin
  },
});