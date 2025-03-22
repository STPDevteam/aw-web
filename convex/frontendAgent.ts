import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { agentNames } from "./data/agentNames";
import { LLMMessage, chatCompletion } from "./util/llm";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Define types for agent conversation message
type AgentConversationMessage = {
  role: string;
  content: string;
  timestamp: number; // Timestamp when the message was generated
};

/**
 * Get a frontend agent by ID
 * @param ctx - Query context
 * @param id - Frontend agent ID (1-400)
 * @returns Frontend agent data or null if not found
 */
export const getFrontendAgentById = query({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    const { id } = args;
    
    // Validate ID is in range
    if (id < 1 || id > 400) {
      return null;
    }
    
    // Query the frontend agent from the database
    const agent = await ctx.db
      .query("frontendAgents")
      .withIndex("frontendAgentId", (q) => q.eq("frontendAgentId", id))
      .first();
    
    return agent;
  },
});

/**
 * Check if agents already exist
 */
export const checkExistingAgents = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("frontendAgents").collect();
    return agents.length;
  },
});

/**
 * Generate a single agent with conversation
 */
export const generateSingleAgent = action({
  args: {
    agentId: v.number(),
    timestamp: v.number()
  },
  handler: async (ctx, args) => {
    const { agentId, timestamp } = args;
    
    // Generate agent data
    const name = generateRandomName(agentId);
    const description = generateRandomDescription(name);
    const messageCount = [2, 4, 6][Math.floor(Math.random() * 3)]; // Random from [2, 4, 6]
    
    // Get a random other agent to converse with
    const otherAgentId = Math.floor(Math.random() * 400) + 1;
    const otherName = generateRandomName(otherAgentId);
    const otherDescription = generateRandomDescription(otherName);
    
    // Generate conversation using OpenAI - this is now safe in an action
    const conversation = await generateConversation(
      name, 
      description, 
      otherName, 
      otherDescription, 
      messageCount
    );
    
    // Store the agent data
    await ctx.runMutation(api.frontendAgent.insertSingleAgent, {
      agent: {
        frontendAgentId: agentId,
        name,
        description,
        conversation,
        lastUpdated: timestamp
      }
    });
    
    return { success: true };
  }
});

/**
 * Insert a single agent into the database
 */
export const insertSingleAgent = mutation({
  args: {
    agent: v.object({
      frontendAgentId: v.number(),
      name: v.string(),
      description: v.string(),
      conversation: v.array(v.object({
        role: v.string(),
        content: v.string(),
        timestamp: v.number()
      })),
      lastUpdated: v.number()
    })
  },
  handler: async (ctx, args) => {
    const { agent } = args;
    await ctx.db.insert("frontendAgents", agent);
    return { success: true };
  }
});

/**
 * Initialize frontend agents in batches
 * This function starts the process of creating agents in smaller batches
 */
export const initializeFrontendAgents = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    // Check if agents already exist
    const existingAgents: number = await ctx.runQuery(api.frontendAgent.checkExistingAgents);
    
    if (existingAgents >= 400) {
      return { 
        success: false, 
        message: `All agents already initialized (${existingAgents} agents exist)` 
      };
    }
    
    // Calculate next batch to process
    const startId = existingAgents + 1;
    const batchSize = 10; // Process 10 agents at a time
    const endId = Math.min(400, startId + batchSize - 1);
    
    // Start the initialization process
    await ctx.runAction(api.frontendAgent.initializeAgentBatch, {
      startId,
      endId,
      timestamp: Date.now()
    });
    
    return { 
      success: true, 
      message: `Started initializing agents ${startId} to ${endId}. ${existingAgents} agents already exist.` 
    };
  }
});

/**
 * Initialize a batch of agents
 */
export const initializeAgentBatch = action({
  args: {
    startId: v.number(),
    endId: v.number(),
    timestamp: v.number()
  },
  handler: async (ctx, args): Promise<{ success: boolean; createdCount: number }> => {
    const { startId, endId, timestamp } = args;
    let createdCount = 0;
    
    // Generate each agent in the batch
    for (let id = startId; id <= endId; id++) {
      try {
        await ctx.runAction(api.frontendAgent.generateSingleAgent, {
          agentId: id,
          timestamp
        });
        createdCount++;
        
        // Add a small delay between agent creation to avoid API rate limits
        if (id < endId) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error creating agent ${id}:`, error);
        // Continue with the next agent even if one fails
      }
    }
    
    // Schedule the next batch if there are more agents to create
    if (endId < 400) {
      const nextStartId = endId + 1;
      const nextEndId = Math.min(400, nextStartId + (endId - startId));
      
      // Schedule the next batch with a delay to avoid overloading
      setTimeout(async () => {
        try {
          await ctx.runAction(api.frontendAgent.initializeAgentBatch, {
            startId: nextStartId,
            endId: nextEndId,
            timestamp
          });
        } catch (error) {
          console.error("Error scheduling next batch:", error);
        }
      }, 5000); // 5 second delay between batches
    }
    
    return {
      success: true,
      createdCount
    };
  }
});

/**
 * Check initialization progress
 */
export const getInitializationProgress = query({
  args: {},
  handler: async (ctx) => {
    const existingAgents = await ctx.db.query("frontendAgents").collect();
    return {
      completed: existingAgents.length,
      total: 400,
      percentage: Math.round((existingAgents.length / 400) * 100),
      isComplete: existingAgents.length >= 400
    };
  }
});

/**
 * Update a single agent's conversation
 */
export const updateSingleAgentConversation = action({
  args: {
    agentId: v.number(),
    timestamp: v.number()
  },
  handler: async (ctx, args) => {
    const { agentId, timestamp } = args;
    
    // Get the agent
    const agent = await ctx.runQuery(api.frontendAgent.getFrontendAgentById, { id: agentId });
    
    if (!agent) {
      return { success: false, message: "Agent not found" };
    }
    
    // Generate new conversation
    const messageCount = [2, 4, 6][Math.floor(Math.random() * 3)];
    const otherAgentId = Math.floor(Math.random() * 400) + 1;
    const otherName = generateRandomName(otherAgentId);
    const otherDescription = generateRandomDescription(otherName);
    
    const conversation = await generateConversation(
      agent.name,
      agent.description,
      otherName,
      otherDescription,
      messageCount
    );
    
    // Update the agent
    await ctx.runMutation(api.frontendAgent.updateAgentConversation, {
      id: agent._id,
      conversation,
      lastUpdated: timestamp
    });
    
    return { success: true };
  }
});

/**
 * Update an agent's conversation
 */
export const updateAgentConversation = mutation({
  args: {
    id: v.id("frontendAgents"),
    conversation: v.array(v.object({
      role: v.string(),
      content: v.string(),
      timestamp: v.number()
    })),
    lastUpdated: v.number()
  },
  handler: async (ctx, args) => {
    const { id, conversation, lastUpdated } = args;
    await ctx.db.patch(id, {
      conversation,
      lastUpdated
    });
    return { success: true };
  }
});

/**
 * Update all frontend agent conversations
 * This function updates all agents in batches
 */
export const updateAllFrontendAgentConversations = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Schedule updates for all agents
    // In a real implementation, you would want to space these updates out
    const batchSize = 5;
    let updatedCount = 0;
    
    for (let startId = 1; startId <= 400; startId += batchSize) {
      const endId = Math.min(400, startId + batchSize - 1);
      
      for (let id = startId; id <= endId; id++) {
        await ctx.scheduler.runAfter(0, api.frontendAgent.updateSingleAgentConversation, {
          agentId: id,
          timestamp: Date.now()
        });
        updatedCount++;
      }
    }
    
    return { success: true, scheduled: updatedCount };
  }
});

// Helper functions to generate random data

/**
 * Get a name from the agentNames list by ID
 * @param id - The ID of the agent (1-400)
 * @returns A name from the agentNames list
 */
function generateRandomName(id: number): string {
  // Use the agent ID (1-400) to get a name from the agentNames array
  // Subtract 1 since array is 0-indexed but IDs start at 1
  const index = id - 1;
  
  // Get name from agentNames array, which contains more than 400 names
  return agentNames[index];
}

function generateRandomDescription(name: string): string {
  // Extended list of traits
  const positiveTraits = [
    "creative", "analytical", "introverted", "extroverted", "thoughtful", 
    "pragmatic", "energetic", "calm", "adventurous", "cautious", "passionate",
    "logical", "empathetic", "determined", "adaptable", "organized", "flexible",
    "ambitious", "charismatic", "curious", "diligent", "eloquent", "friendly",
    "genuine", "humorous", "imaginative", "jovial", "kind", "loyal", "meticulous",
    "nurturing", "optimistic", "patient", "quick-witted", "reliable", "sincere",
    "tenacious", "unconventional", "versatile", "wise", "zealous"
  ];
  
  const quirkTraits = [
    "always carries a notebook", "collects vintage maps", "speaks to plants", 
    "memorizes obscure facts", "uses antiquated expressions", "draws on napkins",
    "quotes philosophers", "tells dad jokes", "whistles when thinking", 
    "always has a new hobby", "names their devices", "makes up words",
    "can recite movie dialogues", "randomly breaks into song", "misuses idioms",
    "carries hot sauce everywhere", "creates elaborate theories", "loves puns",
    "adopts stray ideas", "arranges books by color", "talks in third person occasionally"
  ];
  
  // Extended list of interests
  const interests = [
    "technology", "art", "music", "literature", "science", "history", "sports",
    "cooking", "travel", "philosophy", "gaming", "photography", "nature", 
    "fashion", "film", "architecture", "politics", "economics", "education",
    "astronomy", "board games", "calligraphy", "dance", "etymology", "folklore",
    "gardening", "hiking", "improv comedy", "jazz", "knitting", "linguistics",
    "meditation", "numismatics", "origami", "poetry", "quilting", "robotics",
    "sculpture", "tea culture", "urban exploration", "vintage collecting",
    "woodworking", "yoga", "zymology"
  ];
  
  // Extended character backgrounds
  const backgrounds = [
    "grew up in a small coastal town", "was raised by librarians", 
    "lived in seven different countries", "trained as a classical musician",
    "worked on a cruise ship", "spent a year in silent retreat", 
    "was a child chess prodigy", "apprenticed with a master craftsman",
    "grew up in a theater family", "was homeschooled in the mountains",
    "studied ancient languages", "traveled with a circus briefly",
    "was raised on a farm", "grew up in a major metropolis",
    "spent summers with their eccentric aunt", "lived in a commune",
    "was a young entrepreneur", "grew up backstage at concerts"
  ];
  
  // Extended viewpoints/philosophies
  const philosophies = [
    "believes in learning something new every day",
    "thinks the best ideas come at unexpected moments",
    "values authenticity above all else",
    "believes mistakes are the best teachers",
    "sees patterns where others see chaos",
    "thinks everyone has an important story to tell",
    "believes in balancing tradition and innovation",
    "advocates for slow living in a fast world",
    "thinks questions are often more valuable than answers",
    "believes in finding beauty in ordinary things",
    "values deep conversations over small talk",
    "thinks we should all be amateur philosophers",
    "believes in embracing paradoxes"
  ];

  // Select traits and interests
  const trait1 = positiveTraits[Math.floor(Math.random() * positiveTraits.length)];
  const trait2 = positiveTraits[Math.floor(Math.random() * positiveTraits.length)];
  const quirk = quirkTraits[Math.floor(Math.random() * quirkTraits.length)];
  const interest1 = interests[Math.floor(Math.random() * interests.length)];
  const interest2 = interests[Math.floor(Math.random() * interests.length)];
  
  // Selectively add background or philosophical viewpoint
  const addBackground = Math.random() > 0.5;
  const addPhilosophy = Math.random() > 0.5;
  const background = addBackground ? backgrounds[Math.floor(Math.random() * backgrounds.length)] : null;
  const philosophy = addPhilosophy ? philosophies[Math.floor(Math.random() * philosophies.length)] : null;
  
  // Combine different description formats
  const formats = [
    // Basic format, two traits and two interests
    `${name} is a ${trait1} and ${trait2} individual with a deep passion for ${interest1} and ${interest2}.`,
    
    // Format with quirks
    `Known for being both ${trait1} and ${trait2}, ${name} has a unique interest in ${interest1} and ${interest2}, and ${quirk}.`,
    
    // Format mentioning interests first
    `With a profound love for ${interest1} and a growing interest in ${interest2}, ${name} is known for their ${trait1} nature and ${trait2} approach to life.`,
    
    // More complex format
    `A ${trait1} soul with a ${trait2} mind, ${name} divides their time between exploring ${interest1} and delving into ${interest2}.`,
    
    // Unconventional structure format
    `When not being remarkably ${trait1}, ${name} is often found expressing their ${trait2} side through ${interest1} or contemplating the nuances of ${interest2}.`
  ];
  
  // Randomly select a basic format
  let description = formats[Math.floor(Math.random() * formats.length)];
  
  // Selectively add background
  if (background) {
    const backgroundFormats = [
      ` ${name} ${background}, which influences their perspective on many things.`,
      ` Having ${background}, they bring a unique view to discussions.`,
      ` Their experience of having ${background} often shapes their approach to challenges.`
    ];
    description += backgroundFormats[Math.floor(Math.random() * backgroundFormats.length)];
  }
  
  // Selectively add philosophical viewpoint
  if (philosophy) {
    const philosophyFormats = [
      ` At their core, ${name} ${philosophy}.`,
      ` They often say that they ${philosophy}.`,
      ` Friends know that ${name} firmly ${philosophy}.`
    ];
    description += philosophyFormats[Math.floor(Math.random() * philosophyFormats.length)];
  }
  
  // Add common conclusions
  const conclusions = [
    ` They're known for their unique perspective and approach to problem-solving.`,
    ` Their distinct viewpoint makes conversations with them particularly enlightening.`,
    ` People often find their way of thinking both refreshing and insightful.`,
    ` Their unique combination of interests gives them a perspective few others have.`,
    ` Many seek them out for their thoughtful insights and unusual approach to challenges.`
  ];
  
  description += conclusions[Math.floor(Math.random() * conclusions.length)];
  
  return description;
}

/**
 * Generate a conversation between two agents using OpenAI
 * This function must only be called from an action
 */
async function generateConversation(
  name: string, 
  description: string, 
  otherName: string,
  otherDescription: string,
  messageCount: number
): Promise<AgentConversationMessage[]> {
  const now = Date.now();
  
  // Use OpenAI to generate the conversation
  try {
    // System prompt to guide the AI (only used for OpenAI, not stored in DB)
    const systemPrompt = `You are creating a conversation between two virtual agents:
1. ${name}: ${description}
2. ${otherName}: ${otherDescription}

Generate a natural conversation between these two agents with the following guidelines:
- The conversation should be authentic and reflect their personalities
- Each message should be relatively brief (under 100 words)
- The conversation should be coherent and flow naturally
- Include timestamps for each message (for reference, current time is ${new Date(now).toLocaleString()})`;

    // Create a prompt for OpenAI that asks it to generate the entire conversation
    const prompt = `Generate a natural conversation between ${name} and ${otherName} based on their descriptions.
The conversation should have exactly ${messageCount} messages total (including a greeting and responses).
Format each message as JSON with "role" (the name of the character speaking, either "${otherName}" or "${name}"), 
"content" (the message text), and a "timestamp" (in milliseconds, starting from ${now} and increasing reasonably between messages).

Example format:
[
  {"role": "${otherName}", "content": "Hello ${name}, how are you today?", "timestamp": ${now}},
  {"role": "${name}", "content": "I'm doing well, thank you for asking.", "timestamp": ${now + 60000}}
]`;

    // Call OpenAI to generate the conversation
    const result = await chatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.8,
    });
    
    // Parse the response to get the conversation
    try {
      // Try to extract a JSON array from the response
      let jsonString = result.content;
      
      // Find opening and closing brackets if there's text around the JSON
      const startBracket = jsonString.indexOf('[');
      const endBracket = jsonString.lastIndexOf(']');
      
      if (startBracket !== -1 && endBracket !== -1) {
        jsonString = jsonString.substring(startBracket, endBracket + 1);
      }
      
      const generatedMessages = JSON.parse(jsonString);
      
      // Ensure we have the right number of messages
      if (Array.isArray(generatedMessages) && generatedMessages.length > 0) {
        // Return only the generated messages (no system message)
        return generatedMessages;
      }
    } catch (error) {
      console.error("Error parsing OpenAI response:", error);
    }
  } catch (error) {
    console.error("Error calling OpenAI:", error);
  }
  
  // Fallback if OpenAI call fails
  // Create a fallback conversation directly with character names as roles
  const conversation: AgentConversationMessage[] = [];
  
  // Example conversation starters
  conversation.push({ 
    role: otherName, 
    content: `Hi ${name}, it's nice to meet you. What do you do?`,
    timestamp: now
  });
  
  // Generate alternating messages with increasing timestamps
  const topics = ["recent projects", "interests", "professional goals", "insights", "experiences"];
  
  for (let i = 1; i < messageCount; i++) {
    const messageTime = now + (i * 5 * 60 * 1000); // Add 5 minutes per message
    
    if (i % 2 === 0) {
      // otherName's response
      conversation.push({
        role: otherName,
        content: `That's fascinating! Tell me more about your approach to ${topics[Math.floor(Math.random() * topics.length)]}.`,
        timestamp: messageTime
      });
    } else {
      // name's response
      conversation.push({
        role: name,
        content: `I'm really passionate about ${topics[Math.floor(Math.random() * topics.length)]}. It's been a focus of mine for quite some time now.`,
        timestamp: messageTime
      });
    }
  }
  
  return conversation;
} 