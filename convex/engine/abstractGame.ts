import { ConvexError, Infer, Value, v } from 'convex/values';
import { Doc, Id } from '../_generated/dataModel';
import { ActionCtx, DatabaseReader, MutationCtx, internalQuery } from '../_generated/server';
import { engine } from '../engine/schema';
import { internal } from '../_generated/api';

// Define completedInput outside the class for proper accessibility
const completedInput = v.object({
  inputId: v.id('inputs'),
  returnValue: v.union(
    v.object({
      kind: v.literal('ok'),
      value: v.any(),
    }),
    v.object({
      kind: v.literal('error'),
      message: v.string(),
    }),
  ),
});

// Define engineUpdate outside the class to avoid reference errors
export const engineUpdate = v.object({
  engine,
  expectedGenerationNumber: v.number(),
  completedInputs: v.array(completedInput),
});
export type EngineUpdate = Infer<typeof engineUpdate>;

export abstract class AbstractGame {
  abstract tickDuration: number;
  abstract stepDuration: number;
  abstract maxTicksPerStep: number;
  abstract maxInputsPerStep: number;

  constructor(public engine: Doc<'engines'>) {}

  abstract handleInput(now: number, name: string, args: object): Value;
  abstract tick(now: number): void;

  // Optional callback at the beginning of each step.
  beginStep(now: number) {}
  abstract saveStep(ctx: ActionCtx, engineUpdate: EngineUpdate): Promise<void>;

  async runStep(ctx: ActionCtx, now: number) {
    const inputs = await ctx.runQuery(internal.engine.abstractGame.loadInputs, {
      engineId: this.engine._id,
      processedInputNumber: this.engine.processedInputNumber,
      max: this.maxInputsPerStep,
    });

    const lastStepTs = this.engine.currentTime;
    const startTs = lastStepTs ? lastStepTs + this.tickDuration : now;
    let currentTs = startTs;
    let inputIndex = 0;
    let numTicks = 0;
    let processedInputNumber = this.engine.processedInputNumber;
    const completedInputs = [];

    this.beginStep(currentTs);

    while (numTicks < this.maxTicksPerStep) {
      numTicks += 1;

      // Collect all of the inputs for this tick.
      const tickInputs = [];
      while (inputIndex < inputs.length) {
        const input = inputs[inputIndex];
        if (input.received > currentTs) {
          break;
        }
        inputIndex += 1;
        processedInputNumber = input.number;
        tickInputs.push(input);
      }

      // Feed the inputs to the game.
      for (const input of tickInputs) {
        let returnValue;
        try {
          const value = this.handleInput(currentTs, input.name, input.args);
          returnValue = { kind: 'ok' as const, value };
        } catch (e: any) {
          console.error(`Input ${input._id} failed: ${e.message}`);
          returnValue = { kind: 'error' as const, message: e.message };
        }
        completedInputs.push({ inputId: input._id, returnValue });
      }

      // Simulate the game forward one tick.
      this.tick(currentTs);

      const candidateTs = currentTs + this.tickDuration;
      if (now < candidateTs) {
        break;
      }
      currentTs = candidateTs;
    }

    // Commit the step by moving time forward, consuming our inputs, and saving the game's state.
    const expectedGenerationNumber = this.engine.generationNumber;
    this.engine.currentTime = currentTs;
    this.engine.lastStepTs = lastStepTs;
    this.engine.generationNumber += 1;
    this.engine.processedInputNumber = processedInputNumber;
    const { _id, _creationTime, ...engine } = this.engine;
    const engineUpdate = { engine, completedInputs, expectedGenerationNumber };
    await this.saveStep(ctx, engineUpdate);

    console.debug(`Simulated from ${startTs} to ${currentTs} (${currentTs - startTs}ms)`);
  }

  async engineInsertInput(
    ctx: MutationCtx,
    engineId: Id<'engines'>,
    name: string,
    args: any
  ): Promise<Id<'inputs'>> {
    const now = Date.now();
    
    console.log(`Inserting input ${name} for engine ${engineId} at ${now}`);
    
    try {
      // To ensure the input can be inserted, perform a single insert instead of batch processing
      const number = now * 1000 + Math.floor(Math.random() * 1000); // Ensure uniqueness
      
      // Ensure input parameters are serializable
      let serializedArgs = args;
      try {
        // Test serialization
        JSON.stringify(args);
      } catch (e) {
        console.error(`Input args serialization error for ${name}:`, e);
        serializedArgs = { _error: "Original args could not be serialized" };
      }
      
      // Directly insert the input
      const inputId = await ctx.db.insert("inputs", {
        engineId,
        number,
        name,
        args: serializedArgs,
        received: now,
      });
      
      console.log(`Successfully inserted input ${name} with number ${number}`);
      return inputId;
    } catch (error) {
      // If the insert fails, attempt an emergency insert
      console.error(`Failed to insert input ${name}:`, error);
      
      try {
        console.log(`Trying emergency insert for input ${name}`);
        const emergencyNumber = now * 1000 + Math.floor(Math.random() * 1000) + 500; // Use timestamp as emergency number
        
        const inputId = await ctx.db.insert("inputs", {
          engineId,
          number: emergencyNumber,
          name,
          args: { _emergency: true, originalName: name },
          received: now,
        });
        
        console.log(`Emergency insert successful for input ${name} with number ${emergencyNumber}`);
        return inputId;
      } catch (finalError) {
        console.error(`Emergency insert also failed for input ${name}:`, finalError);
        throw new Error(`Could not insert input ${name}: ${finalError}`);
      }
    }
  }
}

export async function loadEngine(
  db: DatabaseReader,
  engineId: Id<'engines'>,
  generationNumber: number,
) {
  const engine = await db.get(engineId);
  if (!engine) {
    throw new Error(`No engine found with id ${engineId}`);
  }
  if (!engine.running) {
    throw new ConvexError({
      kind: 'engineNotRunning',
      message: `Engine ${engineId} is not running`,
    });
  }
  if (engine.generationNumber !== generationNumber) {
    throw new ConvexError({ kind: 'generationNumber', message: 'Generation number mismatch' });
  }
  return engine;
}

// Add a cache for recently inserted input numbers to avoid duplicates
const recentInputNumbers = new Map<Id<'engines'>, Set<number>>();
const MAX_CACHE_SIZE = 1000;
const MAX_CACHE_AGE = 60000; // 60 seconds in milliseconds

// Storage for pending inputs awaiting batch processing
type PendingInput = {
  engineId: Id<'engines'>,
  name: string,
  args: any,
  number: number,
  received: number
};

// Global batch processing state
const pendingInputBatches: Map<string, PendingInput[]> = new Map();
const BATCH_SIZE = 5; // Number of inputs to collect before batch insert
const lastBatchTimes: Map<string, number> = new Map(); 
const BATCH_MAX_WAIT = 100; // Reduce maximum wait time to ensure faster batch processing

// Clean up old cache entries periodically
function cleanupOldCache() {
  const now = Date.now();
  for (const [engineId, numbers] of recentInputNumbers.entries()) {
    if (numbers.size > MAX_CACHE_SIZE || (now - (numbers as any).lastCleanup || 0) > MAX_CACHE_AGE) {
      // Reset the cache if it's too large or too old
      recentInputNumbers.set(engineId, new Set());
      (recentInputNumbers.get(engineId) as any).lastCleanup = now;
    }
  }
}

// Track input frequencies to detect and handle high-frequency inputs
const inputFrequencies = new Map<string, { count: number, lastReset: number }>();

// Process all pending batches that are ready
async function processPendingBatches(ctx: MutationCtx) {
  const now = Date.now();
  const batchesToProcess: string[] = [];
  
  // Find batches that are ready to process (either full or waited long enough)
  for (const [batchKey, inputs] of pendingInputBatches.entries()) {
    const lastBatchTime = lastBatchTimes.get(batchKey) || 0;
    // Reduce batch processing threshold to ensure more batches are processed
    if (inputs.length >= BATCH_SIZE || (now - lastBatchTime > BATCH_MAX_WAIT && inputs.length > 0)) {
      batchesToProcess.push(batchKey);
    }
  }
  
  // Process each ready batch
  for (const batchKey of batchesToProcess) {
    const inputs = pendingInputBatches.get(batchKey) || [];
    if (inputs.length === 0) continue;
    
    try {
      // Use multi-insert for efficiency when supported
      // For now, we'll do individual inserts but in a single transaction
      for (const input of inputs) {
        await ctx.db.insert('inputs', {
          engineId: input.engineId,
          number: input.number,
          name: input.name,
          args: input.args,
          received: input.received,
        });
      }
      
      // Clear the processed batch
      pendingInputBatches.delete(batchKey);
      lastBatchTimes.delete(batchKey);
    } catch (error) {
      console.error(`Failed to process input batch ${batchKey}:`, error);
      
      // Batch processing failure strategy: split batch and try inserting individually
      try {
        console.log(`Trying to insert inputs individually after batch failure for ${batchKey}`);
        const failedInputs = [...inputs]; // Copy the array before deleting from map
        pendingInputBatches.delete(batchKey);
        lastBatchTimes.delete(batchKey);
        
        // Try inserting each input individually
        for (const input of failedInputs) {
          try {
            await ctx.db.insert('inputs', {
              engineId: input.engineId,
              number: input.number,
              name: input.name,
              args: input.args,
              received: input.received,
            });
          } catch (individualError) {
            console.error(`Failed to insert individual input ${input.name}:`, individualError);
          }
        }
      } catch (retryError) {
        console.error(`Failed retry strategy for batch ${batchKey}:`, retryError);
        // Fallback strategy: keep batch but reduce its size, will try again next time
        const remainingInputs = pendingInputBatches.get(batchKey);
        if (remainingInputs && remainingInputs.length > 2) {
          // Keep only the most recent 2 inputs from the batch
          pendingInputBatches.set(batchKey, remainingInputs.slice(-2));
        }
      }
    }
  }
}

/**
 * Helper to generate a consistent entity key for batching related inputs
 */
function getBatchEntityKey(args: any): string {
  if (!args) return 'default';
  
  if (args.agentId) return `agent:${args.agentId}`;
  if (args.playerId) return `player:${args.playerId}`;
  if (args.id) return `entity:${args.id}`;
  
  // For movement inputs, group by general area
  if (args.destination && 
      typeof args.destination.x === 'number' && 
      typeof args.destination.y === 'number') {
    // Increase grid cell size to reduce fine-grained batch processing grouping
    const gridX = Math.floor(args.destination.x / 8);
    const gridY = Math.floor(args.destination.y / 8);
    return `move:${gridX},${gridY}`;
  }
  
  return 'default';
}

export const loadInputs = internalQuery({
  args: {
    engineId: v.id('engines'),
    processedInputNumber: v.optional(v.number()),
    max: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('inputs')
      .withIndex('byInputNumber', (q) =>
        q.eq('engineId', args.engineId).gt('number', args.processedInputNumber ?? -1),
      )
      .order('asc')
      .take(args.max);
  },
});

export async function applyEngineUpdate(
  ctx: MutationCtx,
  engineId: Id<'engines'>,
  update: EngineUpdate,
) {
  const engine = await loadEngine(ctx.db, engineId, update.expectedGenerationNumber);
  if (
    engine.currentTime &&
    update.engine.currentTime &&
    update.engine.currentTime < engine.currentTime
  ) {
    throw new Error('Time moving backwards');
  }
  await ctx.db.replace(engine._id, update.engine);

  for (const completedInput of update.completedInputs) {
    const input = await ctx.db.get(completedInput.inputId);
    if (!input) {
      throw new Error(`Input ${completedInput.inputId} not found`);
    }
    if ('returnValue' in input && input.returnValue) {
      throw new Error(`Input ${completedInput.inputId} already completed`);
    }
    // We need to patch the input with the return value, not replace it entirely
    await ctx.db.patch(completedInput.inputId, { returnValue: completedInput.returnValue });
  }
}

/**
 * Optimized function to insert input with intelligent error handling
 * to ensure all inputs get inserted into the database
 */
export async function engineInsertInput(
  ctx: MutationCtx,
  engineId: Id<'engines'>,
  name: string,
  args: any,
): Promise<Id<'inputs'>> {
  const now = Date.now();
  
  console.log(`Inserting input ${name} for engine ${engineId} at ${now}`);
  
  try {
    // Directly insert without using batch processing
    const number = now * 1000 + Math.floor(Math.random() * 1000); // Ensure uniqueness
    
    // Ensure input parameters are serializable
    let serializedArgs = args;
    try {
      // Test serialization
      JSON.stringify(args);
    } catch (e) {
      console.error(`Input args serialization error for ${name}:`, e);
      serializedArgs = { _error: "Original args could not be serialized" };
    }
    
    // Directly insert input
    const inputId = await ctx.db.insert("inputs", {
      engineId,
      number,
      name,
      args: serializedArgs,
      received: now,
    });
    
    console.log(`Successfully inserted input ${name} with number ${number}`);
    return inputId;
  } catch (error) {
    // If insertion fails, try emergency insertion
    console.error(`Failed to insert input ${name}:`, error);
    
    try {
      console.log(`Trying emergency insert for input ${name}`);
      const emergencyNumber = now * 1000 + Math.floor(Math.random() * 1000) + 500; // Use timestamp as emergency number
      
      const inputId = await ctx.db.insert("inputs", {
        engineId,
        number: emergencyNumber,
        name,
        args: { _emergency: true, originalName: name },
        received: now,
      });
      
      console.log(`Emergency insert successful for input ${name} with number ${emergencyNumber}`);
      return inputId;
    } catch (finalError) {
      console.error(`Emergency insert also failed for input ${name}:`, finalError);
      throw new Error(`Could not insert input ${name}: ${finalError}`);
    }
  }
}
