import { ConvexError, Infer, Value, v } from 'convex/values';
import { Doc, Id } from '../_generated/dataModel';
import { ActionCtx, DatabaseReader, MutationCtx, internalQuery } from '../_generated/server';
import { engine } from '../engine/schema';
import { internal } from '../_generated/api';

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
}

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

export const engineUpdate = v.object({
  engine,
  expectedGenerationNumber: v.number(),
  completedInputs: v.array(completedInput),
});
export type EngineUpdate = Infer<typeof engineUpdate>;

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
const BATCH_MAX_WAIT = 100; // 降低最大等待时间，确保更快处理批次

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
    // 降低批处理阈值，确保更多批次被处理
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
      
      // 批处理失败处理策略：将批次分拆，尝试逐个插入
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
        // 最后的兜底策略：保留批次但减小大小，下次会再次尝试
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
 * Optimized function to insert input with intelligent batching
 * to reduce database operations and prevent stuttering
 */
export async function engineInsertInput(
  ctx: MutationCtx,
  engineId: Id<'engines'>,
  name: string,
  args: any,
): Promise<Id<'inputs'>> {
  const now = Date.now();
  
  // Clean up old cache entries and process pending batches
  cleanupOldCache();
  await processPendingBatches(ctx);
  
  // Initialize cache for this engine if it doesn't exist
  if (!recentInputNumbers.has(engineId)) {
    recentInputNumbers.set(engineId, new Set());
    (recentInputNumbers.get(engineId) as any).lastCleanup = now;
  }
  
  // Track input frequency to detect high-frequency inputs
  const freqKey = `${engineId}:${name}`;
  if (!inputFrequencies.has(freqKey)) {
    inputFrequencies.set(freqKey, { count: 0, lastReset: now });
  }
  
  const freq = inputFrequencies.get(freqKey)!;
  
  // Reset frequency counter every 5 seconds
  if (now - freq.lastReset > 5000) {
    freq.count = 0;
    freq.lastReset = now;
  }
  
  freq.count++;
  
  // Determine input category for specialized handling
  const isCriticalInput = name.includes('start') || 
                          name.includes('leave') || 
                          name.includes('Message') || 
                          name.includes('conversation') ||
                          name.includes('Remember');
  
  const isMovementInput = name === 'finishDoSomething' && args.destination;
  const isLowPriorityInput = name.startsWith('update') || isMovementInput;
  
  // Generate a unique input number
  const numbersCache = recentInputNumbers.get(engineId)!;
  let number = now * 1000;
  
  // Try to find a unique number with minimal randomness
  for (let offset = 0; offset < 100; offset++) {
    const candidateNumber = number + offset;
    if (!numbersCache.has(candidateNumber)) {
      number = candidateNumber;
      numbersCache.add(number);
      break;
    }
  }
  
  // Always process critical inputs immediately
  if (isCriticalInput) {
    const inputId = await ctx.db.insert('inputs', {
      engineId,
      number,
      name,
      args,
      received: now,
    });
    return inputId;
  }
  
  // 降低过滤门槛，让更多移动请求通过
  if (isMovementInput && freq.count > 30) {
    // 改为10个移动输入中通过4个（之前是3个中通过1个）
    if (freq.count % 10 > 6) {
      // 避免使用假ID，而是实际插入数据库
      const inputId = await ctx.db.insert('inputs', {
        engineId,
        number,
        name,
        args,
        received: now,
      });
      return inputId;
    }
  }
  
  // Apply batching for non-critical inputs to reduce database load
  if (isLowPriorityInput) {
    // Create a batch key based on input type and entity
    const batchKey = `${engineId}:${name}:${getBatchEntityKey(args)}`;
    
    // Initialize batch if needed
    if (!pendingInputBatches.has(batchKey)) {
      pendingInputBatches.set(batchKey, []);
      lastBatchTimes.set(batchKey, now);
    }
    
    // Add to batch
    const batch = pendingInputBatches.get(batchKey)!;
    
    // For movement inputs, only keep the latest position
    if (isMovementInput && batch.length > 0) {
      // Replace the previous movement input to reduce redundant movements
      batch[batch.length-1] = {
        engineId,
        name,
        args,
        number,
        received: now
      };
    } else {
      // Add new input to batch
      batch.push({
        engineId,
        name,
        args,
        number,
        received: now
      });
    }
    
    // Update last batch time
    lastBatchTimes.set(batchKey, now);
    
    // 移动请求的批处理阈值降低，让批次更快处理
    const threshold = isMovementInput ? 3 : BATCH_SIZE;
    
    // If batch is full, process it immediately
    if (batch.length >= threshold) {
      try {
        // 处理批次
        for (const input of batch) {
          await ctx.db.insert('inputs', {
            engineId: input.engineId,
            number: input.number,
            name: input.name,
            args: input.args,
            received: input.received,
          });
        }
        
        // Clear the batch after successful processing
        pendingInputBatches.delete(batchKey);
        lastBatchTimes.delete(batchKey);
        
        // Return the ID of the last input in the batch
        return `${engineId}_${batch[batch.length-1].number}` as Id<'inputs'>;
      } catch (error) {
        console.error(`Failed to process batch ${batchKey}:`, error);
        
        // 批处理失败后，尝试单独处理当前输入
        try {
          const inputId = await ctx.db.insert('inputs', {
            engineId,
            number,
            name,
            args,
            received: now,
          });
          return inputId;
        } catch (finalError) {
          console.error('Failed to insert input even after batch failure:', finalError);
          return `${engineId}_${number}_error` as Id<'inputs'>;
        }
      }
    }
    
    // 减少等待时间，较早的批次应该已经处理了
    if (now - (lastBatchTimes.get(batchKey) || 0) > BATCH_MAX_WAIT) {
      try {
        // 处理该批次
        for (const input of batch) {
          await ctx.db.insert('inputs', {
            engineId: input.engineId,
            number: input.number,
            name: input.name,
            args: input.args,
            received: input.received,
          });
        }
        
        // 清理批次
        pendingInputBatches.delete(batchKey);
        lastBatchTimes.delete(batchKey);
        
        return `${engineId}_${batch[batch.length-1].number}` as Id<'inputs'>;
      } catch (error) {
        console.error(`Failed to process timeout batch ${batchKey}:`, error);
      }
    }
    
    // 对于重要的移动请求，不要太依赖批处理，保证至少部分请求直接处理
    if (isMovementInput && Math.random() < 0.3) {  // 30%概率直接处理
      const inputId = await ctx.db.insert('inputs', {
        engineId,
        number,
        name,
        args,
        received: now,
      });
      return inputId;
    }
    
    // Return a temporary ID, the batch will be processed later
    return `${engineId}_${number}_batched` as Id<'inputs'>;
  }
  
  // For all other inputs, process them normally
  const inputId = await ctx.db.insert('inputs', {
    engineId,
    number,
    name,
    args,
    received: now,
  });
  return inputId;
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
    // 增大网格单元大小，减少细粒度的批处理分组
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
    if (input.returnValue) {
      throw new Error(`Input ${completedInput.inputId} already completed`);
    }
    input.returnValue = completedInput.returnValue;
    await ctx.db.replace(input._id, input);
  }
}
