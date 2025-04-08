import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";

// 定义类型
type AgentStatus = Array<{
  title: string;
  icon: string;
}>;

type OldAgentStatus = {
  emotion: string;
  status: string;
  current_work: string;
  energy_level: string;
  location: string;
  mood_trend: string;
};

type AgentEvent = {
  time: string;
  action: string;
  details: string;
};

/**
 * Get all agents for batch processing
 */
export const getAllAgents = query({
  args: {},
  handler: async (ctx) => {
    // Get all agents
    return await ctx.db.query("agentDescriptions").collect();
  }
});

/**
 * Get agent by ID
 */
export const getAgentById = query({
  args: {
    id: v.id("agentDescriptions")
  },
  handler: async (ctx, args) => {
    const { id } = args;
    return await ctx.db.get(id);
  }
});

/**
 * Update agent status and events
 */
export const updateAgentStatusAndEvents = mutation({
  args: {
    id: v.id("agentDescriptions"),
    status: v.union(
      v.array(v.object({
        title: v.string(),
        icon: v.string()
      })),
      v.object({
        emotion: v.string(),
        status: v.string(),
        current_work: v.string(),
        energy_level: v.string(),
        location: v.string(),
        mood_trend: v.string()
      })
    ),
    events: v.array(v.object({
      time: v.string(),
      action: v.string(),
      details: v.string()
    }))
  },
  handler: async (ctx, args) => {
    const { id, status, events } = args;
    await ctx.db.patch(id, {
      status,
      events
    });
    return { success: true };
  }
});

/**
 * Batch update existing agents to FORCE ADD/OVERWRITE status and events fields
 */
export const batchAddStatusAndEvents = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    try {
      // Use the public API references within the action
      const getAllAgentsFunc = api.aiTown.agentStatus.getAllAgents;
      const updateAgentFunc = api.aiTown.agentStatus.updateAgentStatusAndEvents;
      
      // Fetch all agents using the API reference
      const agents = await ctx.runQuery(getAllAgentsFunc, {}); 
      
      console.log(`Processing ${agents.length} agents all at once for forced update...`);
      
      let updatedCount = 0;
      let errorCount = 0;
      
      // Update each agent
      for (const agent of agents) {
        try {
          // Always generate new status and events, overwriting any existing data
          const status = generateAgentStatus(agent.identity, agent.plan);
          const events = generateAgentEvents(agent.plan);
          
          // Execute the update mutation using the API reference
          await ctx.runMutation(updateAgentFunc, { 
            id: agent._id,
            status, // Always use the newly generated status
            events  // Always use the newly generated events
          });
          
          updatedCount++;
        } catch (error) {
          console.error(`Error force updating agent ${agent.agentId}:`, error);
          errorCount++;
          // Continue with the next agent even if one fails
        }
      }
      
      // Updated success message
      return { 
        success: true, 
        message: `Forced update on ${updatedCount}/${agents.length} agents with status and events data. Errors: ${errorCount}` 
      };
    } catch (error) {
      console.error("Batch force update error:", error);
      return {
        success: false,
        message: `Error during batch force update: ${error}`
      };
    }
  }
});

/**
 * Update a single agent's status and events information
 */
export const refreshAgentStatusAndEvents = action({
  args: {
    agentId: v.id("agentDescriptions"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    try {
      const { agentId } = args;
      
      // 获取函数引用
      const getAgentByIdFunc = (api as any).aiTown.agentStatus.getAgentById;
      const updateAgentFunc = (api as any).aiTown.agentStatus.updateAgentStatusAndEvents;
      
      // 获取agent
      const agent = await ctx.runQuery(getAgentByIdFunc, { id: agentId });
      
      if (!agent) {
        return { success: false, message: "Agent not found" };
      }
      
      // Generate new status in the new array format
      const status = generateAgentStatus(agent.identity, agent.plan);
      const events = generateAgentEvents(agent.plan);
      
      // 更新agent
      await ctx.runMutation(updateAgentFunc, {
        id: agent._id,
        status,
        events
      });
      
      return { success: true, message: "Agent status and events refreshed" };
    } catch (error) {
      console.error("Refresh error:", error);
      return {
        success: false,
        message: `Error refreshing agent: ${error}`
      };
    }
  }
});

/**
 * Generate a random status for an agent based on their description
 */
function generateAgentStatus(name: string, description: string): AgentStatus {
  // Status items with titles and icons
  const statusItems = [
    { title: 'Current Work', possibleIcons: ["💻", "📱", "📊", "🔍", "🎨", "📝", "📚", "🎬", "🔧", "🏗️", "🧪", "🔬", "📡", "🎼"] },
    { title: 'Emotion', possibleIcons: ["😄", "😎", "🤔", "😌", "🙂", "😊", "🧐", "🤓", "😴", "🥱", "😯", "🤠", "🤩", "😇"] },
    { title: 'Status', possibleIcons: ["🚶", "🏃", "🧘", "💼", "🚴", "🏋️", "📚", "🎮", "🎧", "💻", "🍽️", "🛌", "🧗", "🏊"] },
    { title: 'Health Status', possibleIcons: ["💖", "🩺", "💊", "🧬", "🧘‍♂️"] },
    { title: 'Location', possibleIcons: ["🏠", "🏢", "🏙️", "🌃", "🏫", "🏕️", "🏝️", "🏟️", "🏪", "🏨", "🌲", "🌊", "🏞️", "🗻"] },
    { title: 'Mood Trend', possibleIcons: ["📈", "📉", "➖", "〰️", "🔄"] }
  ];
  
  // Create the status array with random icons for all status items
  const status: AgentStatus = statusItems.map(item => {
    const randomIcon = item.possibleIcons[Math.floor(Math.random() * item.possibleIcons.length)];
    
    return {
      title: item.title,
      icon: randomIcon
    };
  });
  
  return status;
}

/**
 * Generate random daily events for an agent based on their description
 */
function generateAgentEvents(description: string): AgentEvent[] {
  // Define possible time slots
  const timeSlots = [
    "6:00 to 7:00", "7:30 to 8:30", "9:00 to 12:00", "12:30 to 13:30",
    "14:00 to 16:30", "17:00 to 18:00", "18:30 to 19:30", "20:00 to 21:30",
    "22:00 to 23:00"
  ];
  
  // Define possible activities with their emojis
  const activities = [
    { action: "Morning run", details: "🏃" },
    { action: "Cycling around the park", details: "🚴" },
    { action: "Meditation session", details: "🧘" },
    { action: "Breakfast and news", details: "🥓" },
    { action: "Remote work", details: "💻" },
    { action: "Team meeting", details: "👥" },
    { action: "Creative brainstorming", details: "🧠" },
    { action: "Lunch with friends", details: "🍔" },
    { action: "Coffee break", details: "☕" },
    { action: "Video editing project", details: "🎬" },
    { action: "Writing session", details: "✍️" },
    { action: "Coding project", details: "👨‍💻" },
    { action: "Gaming session", details: "🎮" },
    { action: "Gym workout", details: "🏋️" },
    { action: "Yoga class", details: "🧘‍♀️" },
    { action: "Swimming", details: "🏊" },
    { action: "Dinner and chill", details: "🍣" },
    { action: "Reading a book", details: "📚" },
    { action: "Watching a movie", details: "🎬" },
    { action: "Stargazing on rooftop", details: "🌌" },
    { action: "Evening walk", details: "🚶‍♂️" },
    { action: "Journaling", details: "📓" },
    { action: "Planning tomorrow", details: "📆" },
    { action: "Video call with family", details: "📱" },
    { action: "Podcast recording", details: "🎙️" },
    { action: "Art project", details: "🎨" },
    { action: "Music practice", details: "🎸" },
    { action: "Language learning", details: "🗣️" },
    { action: "Gardening", details: "🌱" },
    { action: "Cooking new recipe", details: "👨‍🍳" }
  ];
  
  // Create a unique set of events for the day
  // Randomly select 9 activities for the 9 time slots
  const shuffledActivities = [...activities].sort(() => 0.5 - Math.random());
  const selectedActivities = shuffledActivities.slice(0, timeSlots.length);
  
  // Create events array
  const events: AgentEvent[] = timeSlots.map((time, index) => ({
    time,
    action: selectedActivities[index].action,
    details: selectedActivities[index].details
  }));
  
  return events;
} 