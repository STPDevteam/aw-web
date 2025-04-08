import { httpRouter } from 'convex/server';
import { handleReplicateWebhook } from './music';
import { httpAction } from './_generated/server';
import { api } from './_generated/api';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { chatCompletion } from './util/llm';

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

// Add favorite agents endpoint (batch operation)
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
    const { userId, worldId, agentIds } = args as any;
    if (!userId || !worldId || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: userId, worldId, and agentIds (array) are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      const result = await ctx.runMutation(api.favorites.favoriteAgent, {
        userId,
        worldId,
        agentIds
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

// Remove favorite agents endpoint (batch operation)
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
    const { userId, agentIds } = args as any;
    if (!userId || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: userId and agentIds (array) are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      const result = await ctx.runMutation(api.favorites.unfavoriteAgent, {
        userId,
        agentIds
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

// Get user by wallet address API
http.route({
  path: '/api/user/wallet',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    try {
      // Get wallet address from query parameter
      const url = new URL(request.url);
      const walletAddress = url.searchParams.get('address');
      
      if (!walletAddress) {
        return new Response(JSON.stringify({ error: 'address query parameter is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Use runtime access to bypass type checking
      const walletModule = api as any;
      const result = await ctx.runQuery(walletModule.wallet.getUserByWalletAddress, {
        walletAddress
      });
      
      if (!result) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
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

// Wallet login API endpoint
http.route({
  path: '/api/wallet/login',
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
    const { walletAddress, username } = args as any;
    if (!walletAddress) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: walletAddress is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Use runtime access to bypass type checking
      const walletModule = api as any;
      const result = await ctx.runMutation(walletModule.wallet.walletLogin, {
        walletAddress,
        username
      });
      
      // Ensure user data is included in the response
      if (result && !result.user && result.isNewUser !== undefined) {
        // If user data is missing but we have isNewUser, fetch the user data
        const userResult = await ctx.runQuery(walletModule.wallet.getUserByWalletAddress, {
          walletAddress
        });
        
        // Combine results
        return new Response(JSON.stringify({
          user: userResult,
          isNewUser: result.isNewUser
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
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

// Migration endpoint to fill initial values for agents
http.route({
  path: '/api/migration/fill-agent-values',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // Use runtime access to bypass type checking
      const tipsModule = api as any;
      const result = await ctx.runMutation(tipsModule.tips.fillAgentInitialValues);
      
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

// Reset all agent energy to 100
http.route({
  path: '/api/reset-agent-energy',
  method: 'POST',
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
    
    try {
      // Call the resetAllAgentEnergy mutation
      const result = await ctx.runMutation(internal.aiTown.agentOperations.resetAllAgentEnergy, { 
        worldId: worldId as Id<'worlds'> 
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

// Get agent with highest inference count
http.route({
  path: '/api/agent-stats/top-inference',
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
    
    try {
      const topAgent = await ctx.runQuery(api.aiTown.game.getTopInferenceAgentPublic, { 
        worldId: worldId as Id<'worlds'>
      });
      
      return new Response(JSON.stringify(topAgent), {
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

// Get agent with most favorites
http.route({
  path: '/api/agent-stats/most-favorited',
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
    
    try {
      const topAgent = await ctx.runQuery(api.aiTown.game.getMostFavoritedAgentPublic, { 
        worldId: worldId as Id<'worlds'>
      });
      
      return new Response(JSON.stringify(topAgent), {
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

// Get all stats
http.route({
  path: '/api/agent-stats/all',
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
    
    try {
      const stats = await ctx.runQuery(api.aiTown.game.getAgentStatsPublic, { 
        worldId: worldId as Id<'worlds'>
      });
      
      return new Response(JSON.stringify(stats), {
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

// Upload image to S3
http.route({
  path: '/api/upload-image',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // Check request format
      if (!request.headers.get('Content-Type')?.includes('multipart/form-data')) {
        return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Parse form data
      const formData = await request.formData();
      const file = formData.get('image');
      
      if (!file || !(file instanceof Blob)) {
        return new Response(JSON.stringify({ error: 'No image file found in request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check file type
      const fileType = file.type;
      if (!fileType.startsWith('image/')) {
        return new Response(JSON.stringify({ error: 'Uploaded file must be an image' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check file size (limit to 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return new Response(JSON.stringify({ error: 'Image size exceeds the 5MB limit' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // First store the file in Convex Storage
      const storageId = await ctx.storage.store(file);
      
      // Get file URL
      const url = await ctx.storage.getUrl(storageId);
      
      if (!url) {
        throw new Error('Failed to generate URL for uploaded image');
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        storageId,
        url,
        message: 'Image uploaded successfully'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ 
        error: 'Failed to upload image',
        details: errorMessage 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Add allowed tip address API endpoint
http.route({
  path: '/api/allowed-tip-address/add',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // Parse request body
      const body = await request.json();
      
      // Validate required fields
      const { walletAddress, note } = body;
      
      if (!walletAddress) {
        return new Response(JSON.stringify({ 
          error: 'Missing required field: walletAddress is required' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Call the mutation to add the address
      const result = await ctx.runMutation(api.wallet.addAllowedTipAddress, {
        walletAddress,
        note
      });
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ 
        error: 'Failed to add allowed tip address',
        details: errorMessage 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Get agent bound to a wallet address
http.route({
  path: '/api/agent/by-wallet',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    try {
      // Get wallet address from query parameter
      const url = new URL(request.url);
      const walletAddress = url.searchParams.get('walletAddress');
      
      if (!walletAddress) {
        return new Response(JSON.stringify({ error: 'walletAddress query parameter is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Call the query to get the bound agent
      const result = await ctx.runQuery(api.wallet.getAgentByUserWallet, {
        walletAddress
      });
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ 
        error: 'Failed to get agent by wallet address',
        details: errorMessage 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
});

// Bind wallet address to agent - MODIFIED WITH VALIDATIONS
http.route({
  path: '/api/bind-wallet-to-agent',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // Parse request body
      const body = await request.json();
      
      // Validate required fields
      const { imageUrl, name, profession, interest, walletAddress, worldId } = body;
      
      if (!imageUrl || !name || !profession || !interest || !walletAddress || !worldId) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: imageUrl, name, profession, interest, walletAddress, worldId' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Validate that the wallet address is allowed to tip
      const allowedAddress = await ctx.runQuery(api.wallet.isAllowedToTip, {
        walletAddress
      });
      
      if (!allowedAddress || !allowedAddress.allowed) {
        return new Response(JSON.stringify({ 
          error: 'This wallet address is not eligible for tipping. Please complete the required actions first.' 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check if wallet already has a bound agent
      const existingBinding = await ctx.runQuery(api.wallet.getAgentByUserWallet, {
        walletAddress
      });
      
      if (existingBinding.bound) {
        return new Response(JSON.stringify({ 
          error: 'This wallet address is already bound to an agent',
          boundAgent: existingBinding.agent
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      try {
        // Since we don't have direct access to the database, we need to fetch all agent descriptions
        // and filter for unbound agents on the client side
        const descriptions = await ctx.runQuery(api.world.gameDescriptions, { worldId });
        const unboundAgents = descriptions.agentDescriptions.filter(agent => !agent.userWalletAddress);
        
        if (unboundAgents.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'The slots are full' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        // Randomly select an agent
        const randomIndex = Math.floor(Math.random() * unboundAgents.length);
        const selectedAgent = unboundAgents[randomIndex];
        
        // Generate identity and plan using OpenAI
        const prompt = `
You are an AI assistant helping to create a detailed profile for a virtual agent in a social world simulation. 
Please generate the following information for an agent with the given attributes:

- Profession: ${profession}
- Interest: ${interest}

Generate TWO sections:
1. "IDENTITY": A detailed first-person description of who this agent is (their background, personality, goals).
   This should be 2-3 paragraphs and be coherent and consistent.

2. "PLAN": A specific first-person description of how they approach conversations with others, what topics they like to discuss,
   and what their behavioral patterns are in social interactions.
   This should be 1-2 paragraphs.

Format your response EXACTLY as follows - just provide the text without additional commentary:
IDENTITY:
[identity text]

PLAN:
[plan text]
`;

        // Use chatCompletion for text generation
        const { content: generatedContent } = await chatCompletion({
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000
        });
        
        // Parse the generated content
        const identityMatch = /IDENTITY:\s*([\s\S]*?)(?=\s*PLAN:)/i.exec(generatedContent);
        const planMatch = /PLAN:\s*([\s\S]*?)$/i.exec(generatedContent);
        
        if (!identityMatch || !planMatch) {
          return new Response(JSON.stringify({ 
            error: 'Failed to generate proper identity and plan format' 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        const identity = identityMatch[1].trim();
        const plan = planMatch[1].trim();
        
        // Update agent description
        const result = await ctx.runMutation(api.tips.updateAgentWithWallet, {
          worldId,
          agentId: selectedAgent.agentId,
          walletAddress,
          identity,
          plan,
          avatarUrl: imageUrl
        });
        
        // Update player description (find player associated with agent from world data)
        const world = await ctx.runQuery(api.world.getWorldById, { worldId });
        
        if (!world) {
          return new Response(JSON.stringify({ 
            error: 'World not found' 
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        // Find the player associated with this agent
        let playerId = null;
        for (const agent of world.agents || []) {
          if (agent.id === selectedAgent.agentId) {
            playerId = agent.playerId;
            break;
          }
        }
        
        if (playerId) {
          // Update player description
          await ctx.runMutation(api.tips.updatePlayerWithIdentity, {
            worldId,
            playerId,
            name,
            description: identity
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          agentId: selectedAgent.agentId,
          identity: identity,
          plan: plan,
          userWalletAddress: walletAddress,
          agentWalletAddress: result.agentWalletAddress,
          message: `Successfully bound user wallet ${walletAddress} to agent ${selectedAgent.agentId}`
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (innerError) {
        console.error('Error processing request:', innerError);
        const errorMsg = innerError instanceof Error ? innerError.message : String(innerError);
        throw new Error(`Error processing wallet binding: ${errorMsg}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ 
        error: 'Failed to bind wallet to agent',
        details: errorMessage 
      }), {
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

// Create Digital Twin Endpoint
http.route({
  path: "/createDigitalTwin",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), { 
          status: 400, 
          headers: { "Content-Type": "application/json" }
      });
    }

    const { userWalletAddress, profession, interest } = body;

    if (!userWalletAddress || !profession || !interest) {
      return new Response(JSON.stringify({ error: "Missing required fields: userWalletAddress, profession, interest" }), { 
          status: 400, 
          headers: { "Content-Type": "application/json" }
      });
    }

    // Optional: Early check if twin exists (Mutation also checks)
    try {
        const existing = await ctx.runQuery(internal.digitalTwin.internal_getDigitalTwin, { userWalletAddress });
        if (existing) {
            return new Response(JSON.stringify({ error: "Digital twin already exists for this address" }), { 
                status: 409, // Conflict
                headers: { "Content-Type": "application/json" }
            });
        }
    } catch (e) {
        // Log query error but proceed, mutation will handle uniqueness
        console.error("Error checking existing twin (proceeding):", e);
    }

    try {
      // 1. Generate description via internal action
      const description = await ctx.runAction(internal.digitalTwin.internal_generateDescription, { 
          profession, 
          interest 
      });

      // 2. Generate a simple name (e.g., based on profession)
      // Customize as needed
      const name = `${profession} Twin`; 

      // 3. Create the twin via internal mutation
      const twinId = await ctx.runMutation(internal.digitalTwin.internal_createDigitalTwin, {
        userWalletAddress,
        profession,
        interest,
        description,
        name,
      });

      // 4. Fetch the created twin data to return it
      const createdTwin = await ctx.runQuery(internal.digitalTwin.internal_getDigitalTwin, { userWalletAddress });

      // 5. Return success response with created data
      return new Response(JSON.stringify({ success: true, twin: createdTwin }), {
        status: 201, // Created
        headers: { "Content-Type": "application/json" },
      });

    } catch (error: any) {
      console.error("Error creating digital twin:", error);
      // Handle potential errors like OpenAI issues or the uniqueness constraint from mutation
      if (error.message?.includes("Digital twin already exists")) {
           return new Response(JSON.stringify({ error: "Digital twin already exists for this address" }), { 
               status: 409, // Conflict
               headers: { "Content-Type": "application/json" }
           });
      }
      return new Response(JSON.stringify({ error: "Failed to create digital twin", details: error.message || String(error) }), { 
          status: 500, // Internal Server Error
          headers: { "Content-Type": "application/json" }
      });
    }
  }),
});

// Get Digital Twin Endpoint
http.route({
  path: "/getDigitalTwin",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const userWalletAddress = url.searchParams.get("userWalletAddress");

    if (!userWalletAddress) {
      return new Response(JSON.stringify({ error: "Missing required query parameter: userWalletAddress" }), { 
          status: 400, 
          headers: { "Content-Type": "application/json" }
      });
    }

    try {
        const twin = await ctx.runQuery(internal.digitalTwin.internal_getDigitalTwin, { userWalletAddress });

        if (!twin) {
            return new Response(JSON.stringify({ error: "Digital twin not found for this address" }), { 
                status: 404, // Not Found
                headers: { "Content-Type": "application/json" }
            });
        }

        // Return the found twin data
        return new Response(JSON.stringify(twin), {
            status: 200, // OK
            headers: { "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Error fetching digital twin:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch digital twin", details: error.message || String(error) }), { 
            status: 500, // Internal Server Error
            headers: { "Content-Type": "application/json" }
        });
    }
  }),
});

export default http;
