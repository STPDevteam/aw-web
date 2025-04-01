import { httpRouter } from 'convex/server';
import { handleReplicateWebhook } from './music';
import { httpAction } from './_generated/server';
import { api } from './_generated/api';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';

const http = httpRouter();

// Existing webhook route
http.route({
  path: '/api/replicate_webhook',
  method: 'POST',
  handler: handleReplicateWebhook,
});

// Simple test endpoint
http.route({
  path: '/test',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ success: true, message: "Test endpoint works!" }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

// New routes to expose Convex functions via HTTP

// Get background music
http.route({
  path: '/api/background-music',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const musicUrl = await ctx.runQuery(api.music.getBackgroundMusic);
    return new Response(JSON.stringify({ url: musicUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

// Get world status
http.route({
  path: '/api/world-status',
  method: 'GET',
  handler: httpAction(async (ctx) => {    
    const worldStatus = await ctx.runQuery(api.world.defaultWorldStatus);
    return new Response(JSON.stringify(worldStatus), {
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

// Get all agents - using query parameters instead of path parameters
http.route({
  path: '/api/agents',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    
    // Get the worldId parameter from the query string
    const worldId = url.searchParams.get('worldId');
    if (!worldId) {
      return new Response(JSON.stringify({ error: 'worldId query parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get the sortBy parameter from the query string if present
    const sortByParam = url.searchParams.get('sortBy');
    // Validate sortBy parameter
    const validSortOptions = ['name', 'inferences', 'tips'];
    const sortBy = sortByParam && validSortOptions.includes(sortByParam) 
      ? sortByParam as 'name' | 'inferences' | 'tips' 
      : undefined;
    
    try {
      // Use the public query instead of internal query
      const agents = await ctx.runQuery(api.aiTown.game.getAllAgentsPublic, { 
        worldId: worldId as Id<'worlds'>,
        sortBy
      });
      return new Response(JSON.stringify(agents), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Generic endpoint to run any query function - using query parameters
http.route({
  path: '/api/query',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    
    // Get the module and function from query parameters
    const module = url.searchParams.get('module');
    const func = url.searchParams.get('func');
    
    if (!module || !func) {
      return new Response(JSON.stringify({ error: 'module and func query parameters are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Type guard to ensure the module and function exist in the API
    if (!isValidApiPath(module, func)) {
      return new Response(JSON.stringify({ error: 'Invalid query path' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get query arguments from request body
    let args = {};
    try {
      if (request.headers.get('Content-Type')?.includes('application/json')) {
        args = await request.json();
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Access the API safely with the validated module and function
      // @ts-ignore - We've validated the path exists with isValidApiPath
      const result = await ctx.runQuery(api[module][func], args);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Generic endpoint to run any mutation function - using query parameters
http.route({
  path: '/api/mutation',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    
    // Get the module and function from query parameters
    const module = url.searchParams.get('module');
    const func = url.searchParams.get('func');
    
    if (!module || !func) {
      return new Response(JSON.stringify({ error: 'module and func query parameters are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Type guard to ensure the module and function exist in the API
    if (!isValidApiPath(module, func)) {
      return new Response(JSON.stringify({ error: 'Invalid mutation path' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get mutation arguments from request body
    let args = {};
    try {
      if (request.headers.get('Content-Type')?.includes('application/json')) {
        args = await request.json();
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Access the API safely with the validated module and function
      // @ts-ignore - We've validated the path exists with isValidApiPath
      const result = await ctx.runMutation(api[module][func], args);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Direct agents endpoint with hardcoded worldId for testing
http.route({
  path: '/agents-direct',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const worldId = "mn7av4kb76fb65eaygyzgxxcg97cqvfn";
    try {
      const agents = await ctx.runQuery(api.aiTown.game.getAllAgentsPublic, { 
        worldId: worldId as Id<'worlds'>
      });
      return new Response(JSON.stringify(agents), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Add favorite agent endpoint
http.route({
  path: '/api/favorites/add',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let args = {};
    try {
      if (request.headers.get('Content-Type')?.includes('application/json')) {
        args = await request.json();
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Validate required fields
    const { userId, worldId, agentId } = args as any;
    if (!userId || !worldId || !agentId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: userId, worldId, and agentId are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      const result = await ctx.runMutation(api.favorites.favoriteAgent, {
        userId,
        worldId,
        agentId
      });
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Remove favorite agent endpoint
http.route({
  path: '/api/favorites/remove',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let args = {};
    try {
      if (request.headers.get('Content-Type')?.includes('application/json')) {
        args = await request.json();
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Validate required fields
    const { userId, agentId } = args as any;
    if (!userId || !agentId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: userId and agentId are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      const result = await ctx.runMutation(api.favorites.unfavoriteAgent, {
        userId,
        agentId
      });
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Get user favorites list
http.route({
  path: '/api/favorites',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const worldId = url.searchParams.get('worldId');
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId query parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      const result = await ctx.runQuery(api.favorites.getUserFavorites, { 
        userId: userId as any,
        worldId: worldId as any || undefined 
      });
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Check if agent is favorited
http.route({
  path: '/api/favorites/check',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const agentId = url.searchParams.get('agentId');
    
    if (!userId || !agentId) {
      return new Response(JSON.stringify({ 
        error: 'userId and agentId query parameters are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      const isFavorited = await ctx.runQuery(api.favorites.isAgentFavorited, { 
        userId: userId as any, 
        agentId 
      });
      return new Response(JSON.stringify({ isFavorited }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Get agent details endpoint
http.route({
  path: '/api/agent/details',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const worldId = url.searchParams.get('worldId');
    const agentId = url.searchParams.get('agentId');
    
    if (!worldId || !agentId) {
      return new Response(JSON.stringify({ 
        error: 'worldId and agentId query parameters are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Use runtime access to bypass type checking
      const tipsModule = api as any;
      const result = await ctx.runQuery(tipsModule.tips.getAgentDetails, { 
        worldId: worldId as Id<"worlds">,
        agentId
      });
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Get agent tippers list endpoint
http.route({
  path: '/api/agent/tippers',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const worldId = url.searchParams.get('worldId');
    const agentId = url.searchParams.get('agentId');
    const limit = url.searchParams.get('limit');
    const cursor = url.searchParams.get('cursor');
    
    if (!worldId || !agentId) {
      return new Response(JSON.stringify({ 
        error: 'worldId and agentId query parameters are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Use runtime access to bypass type checking
      const tipsModule = api as any;
      
      // Prepare request parameters object
      const requestParams: any = { 
        worldId: worldId as Id<"worlds">,
        agentId,
      };
      
      // Only add if limit exists and is valid
      if (limit && !isNaN(parseInt(limit))) {
        requestParams.limit = parseInt(limit);
      }
      
      // Only add if cursor exists and is not the string "null"
      if (cursor && cursor !== "null" && cursor !== "undefined") {
        requestParams.cursor = cursor as Id<"agentTips">;
      }
      
      const result = await ctx.runQuery(tipsModule.tips.getAgentTippers, requestParams);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Generate frontend token API
http.route({
  path: '/api/frontend-token',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let args = {};
    try {
      if (request.headers.get('Content-Type')?.includes('application/json')) {
        args = await request.json();
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Validate required fields
    const { userId } = args as any;
    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: userId is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Use runtime access to bypass type checking
      const tipsModule = api as any;
      const result = await ctx.runMutation(tipsModule.tips.generateFrontendToken, {
        userId: userId
      });
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Tip agent API (using frontend token verification)
http.route({
  path: '/api/tips/add',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let args = {};
    try {
      if (request.headers.get('Content-Type')?.includes('application/json')) {
        args = await request.json();
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Validate required fields
    const { userId, worldId, agentId, amount, transactionId, frontendToken, tokenTimestamp } = args as any;
    if (!userId || !worldId || !agentId || !frontendToken || !tokenTimestamp) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: userId, worldId, agentId, frontendToken and tokenTimestamp are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Use runtime access to bypass type checking
      const tipsModule = api as any;
      const result = await ctx.runMutation(tipsModule.tips.tipAgent, {
        userId,
        worldId,
        agentId,
        amount,
        transactionId,
        frontendToken,
        tokenTimestamp
      });
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Helper function to validate API paths
function isValidApiPath(module: string, func: string): boolean {
  return (
    module in api && 
    typeof api[module as keyof typeof api] === 'object' &&
    api[module as keyof typeof api] !== null &&
    func in (api[module as keyof typeof api] as Record<string, unknown>)
  );
}

export default http;
