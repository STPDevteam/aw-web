export const ACTION_TIMEOUT = 120_000; // more time for local dev
// export const ACTION_TIMEOUT = 60_000;// normally fine

export const IDLE_WORLD_TIMEOUT = 5 * 60 * 1000;
export const WORLD_HEARTBEAT_INTERVAL = 60 * 1000;

export const MAX_STEP = 10 * 60 * 1000;
export const TICK = 16;
export const STEP_INTERVAL = 1000;

export const PATHFINDING_TIMEOUT = 60 * 1000;
export const PATHFINDING_BACKOFF = 500;
export const CONVERSATION_DISTANCE = 1.3;
export const MIDPOINT_THRESHOLD = 4;
export const TYPING_TIMEOUT = 15 * 1000;
export const COLLISION_THRESHOLD = 1.75;

// How many human players can be in a world at once.
export const MAX_HUMAN_PLAYERS = 100;

// Set conversation cooldown to 1 hour
export const CONVERSATION_COOLDOWN = 60 * 60 * 1000; // 1 hour = 3,600,000 milliseconds

// Don't do another activity for 10s after doing one.
export const ACTIVITY_COOLDOWN = 10_000;

// Set conversation cooldown to 1 hour
export const PLAYER_CONVERSATION_COOLDOWN = 60 * 60 * 1000; // 1 hour = 3,600,000 milliseconds

// Set invite acceptance probability to 1, ensuring 100% acceptance of invite
export const INVITE_ACCEPT_PROBABILITY = 1.0;

// Wait for 1m for invites to be accepted.
export const INVITE_TIMEOUT = 60000;

// Wait for another player to say something before jumping in.
export const AWKWARD_CONVERSATION_TIMEOUT = 90000;
// export const AWKWARD_CONVERSATION_TIMEOUT = 20_000;

// Leave a conversation after participating too long.
export const MAX_CONVERSATION_DURATION = 10 * 60_000; // more time locally
// export const MAX_CONVERSATION_DURATION = 2 * 60_000;

// Leave a conversation if it has more than 8 messages;
export const MAX_CONVERSATION_MESSAGES = 4;

// Wait for 1s after sending an input to the engine. We can remove this
// once we can await on an input being processed.
export const INPUT_DELAY = 1000;

// How many memories to get from the agent's memory.
// This is over-fetched by 10x so we can prioritize memories by more than relevance.
export const NUM_MEMORIES_TO_SEARCH = 3;

// Wait for at least two seconds before sending another message.
export const MESSAGE_COOLDOWN = 5000;

// Don't run a turn of the agent more than once a second.
export const AGENT_WAKEUP_THRESHOLD = 1000;

// How old we let memories be before we vacuum them
export const VACUUM_MAX_AGE = 2 * 7 * 24 * 60 * 60 * 1000;
export const DELETE_BATCH_SIZE = 64;

export const HUMAN_IDLE_TOO_LONG = 5 * 60 * 1000;

export const ACTIVITIES = [
  { description: 'reading a book', emoji: '📖', duration: 120_000 },
  { description: 'daydreaming', emoji: '🤔', duration: 120_000 },
  { description: 'gardening', emoji: '🥕', duration: 120_000 },
];

export const ENGINE_ACTION_DURATION = 30000;

// Bound the number of pathfinding searches we do per game step.
export const MAX_PATHFINDS_PER_STEP = 64;

export const DEFAULT_NAME = 'Me';

// Agent energy constants
export const AGENT_ENERGY_HOURLY_REDUCTION = 5; // Energy reduced every hour
export const AGENT_MAX_ENERGY = 100; // Maximum energy an agent can have
