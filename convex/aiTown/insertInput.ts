import { MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { engineInsertInput } from '../engine/abstractGame';
import { InputNames, InputArgs } from './inputs';

export async function insertInput<Name extends InputNames>(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
  name: Name,
  args: InputArgs<Name>,
): Promise<Id<'inputs'>> {
  console.log(`Inserting input: World ID=${worldId}, Name=${name}, Args=`, JSON.stringify(args).substring(0, 200));
  
  try {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    
    if (!worldStatus) {
      console.error(`Engine not found: World ID=${worldId}`);
      throw new Error(`World for engine ${worldId} not found`);
    }
    
    console.log(`Engine found: ID=${worldStatus.engineId}, World ID=${worldId}`);
    const result = await engineInsertInput(ctx, worldStatus.engineId, name, args);
    console.log(`Insert successful: ${result}`);
    return result;
  } catch (error) {
    console.error(`Insert failed: World ID=${worldId}, Name=${name}, Error=`, error);
    throw error;
  }
}
