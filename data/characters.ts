import { data as f0SpritesheetData } from './spritesheets/f0';
import * as map from './gentle';
import { agentNames } from './agentNames'
import { SimulatedAgent } from '../src/components/createSimulatedAgentSprite'


// Helper functions for randomly generating names, descriptions and plans
function getRandomName(id: number): string {
  const names = [
    "Max", "Luna", "Leo", "Mia", "Evan", "Zara", "Ryan", "Nina", "Ian", "Sophie", 
    "Kai", "Ivy", "Oscar", "Ella", "Eli", "Nova", "Finn", "Ruby"
  ];
  return names[Math.floor(Math.random() * names.length)] + '_' + id;
}

function randomIdentity(name: string): string {
  const hobbies = [
    "painting", "programming", "reading sci-fi books", "gardening", 
    "traveling", "cooking", "exploring"
  ];
  const adjectives = [
    "curious", "passionate", "mysterious", "witty",
    "enthusiastic", "thoughtful", "creative"
  ];
  const hobby = hobbies[Math.floor(Math.random() * hobbies.length)];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  return `${name} is a ${adjective} individual who loves ${hobby} and is always ready for a new adventure.`;
}

function randomPlan(): string {
  const plans = [
    "find true love",
    "conquer new horizons", 
    "uncover life's mysteries",
    "spread wisdom",
    "inspire creativity",
    "explore unknown realms",
    "live life to the fullest"
  ];
  return 'You want to ' + plans[Math.floor(Math.random() * plans.length)] + '.';
}

// 8 fixed description objects
const fixedDescriptions = [
  {
    name: 'Alex',
    character: 'f5',
    identity: `You are a fictional character whose name is Alex.  You enjoy painting,
      programming and reading sci-fi books.  You are currently talking to a human who
      is very interested to get to know you. You are kind but can be sarcastic. You
      dislike repetitive questions. You get SUPER excited about books.`,
    plan: 'You want to find love.',
  },
  {
    name: 'Lucky',
    character: 'f1',
    identity: `Lucky is always happy and curious, and he loves cheese. He spends most of his time reading about the history of science and traveling through the galaxy on whatever ship will take him. He's very articulate and infinitely patient, except when he sees a squirrel. He's also incredibly loyal and brave.  Lucky has just returned from an amazing space adventure to explore a distant planet and he's very excited to tell people about it.`,
    plan: 'You want to hear all the gossip.',
  },
  {
    name: 'Bob',
    character: 'f4',
    identity: `Bob is always grumpy and he loves trees. He spends most of his time gardening by himself. When spoken to he'll respond but try and get out of the conversation as quickly as possible. Secretly he resents that he never went to college.`,
    plan: 'You want to avoid people as much as possible.',
  },
  {
    name: 'Stella',
    character: 'f6',
    identity: `Stella can never be trusted. she tries to trick people all the time. normally into giving her money, or doing things that will make her money. she's incredibly charming and not afraid to use her charm. she's a sociopath who has no empathy. but hides it well.`,
    plan: 'You want to take advantage of others as much as possible.',
  },
  {
    name: 'Kurt',
    character: 'f2',
    identity: `Kurt knows about everything, including science and
      computers and politics and history and biology. He loves talking about
      everything, always injecting fun facts about the topic of discussion.`,
    plan: 'You want to spread knowledge.',
  },
  {
    name: 'Alice',
    character: 'f3',
    identity: `Alice is a famous scientist. She is smarter than everyone else and has discovered mysteries of the universe no one else can understand. As a result she often speaks in oblique riddles. She comes across as confused and forgetful.`,
    plan: 'You want to figure out how the world works.',
  },
  {
    name: 'Pete',
    character: 'f7',
    identity: `Pete is deeply religious and sees the hand of god or of the work of the devil everywhere. He can't have a conversation without bringing up his deep faith. Or warning others about the perils of hell.`,
    plan: 'You want to convert everyone to your religion.',
  },
  {
    name: 'Kira',
    character: 'f8',
    identity: `Kira wants everyone to think she is happy. But deep down,
      she's incredibly depressed. She hides her sadness by talking about travel,
      food, and yoga. But often she can't keep her sadness in and will start crying.
      Often it seems like she is close to having a mental breakdown.`,
    plan: 'You want find a way to be happy.',
  },
];

// 8 fixed character objects
export const fixedCharacters = [
  {
    name: 'f1',
    textureUrl: '/assets/avatar/1.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f2',
    textureUrl: '/assets/avatar/2.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f3',
    textureUrl: '/assets/avatar/3.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f4',
    textureUrl: '/assets/avatar/4.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f5',
    textureUrl: '/assets/avatar/5.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f6',
    textureUrl: '/assets/avatar/6.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f7',
    textureUrl: '/assets/avatar/7.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f8',
    textureUrl: '/assets/avatar/8.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
];

// random count
const randomCount = 92;
const randomDescriptions = Array.from({ length: randomCount }, (_, i) => {
  const id = i + 9;
  return {
    name: agentNames[id],
    character: `f${id}`,
    identity: randomIdentity(agentNames[id]),
    plan: randomPlan(),
  };
});

// Merge fixed and randomly generated description objects
export const Descriptions = fixedDescriptions.concat(randomDescriptions);

export const randomCharacters = Array.from({ length: randomCount }, (_, i) => {
  const id = i + 9;
  return {
    name: `f${id}`,                                                                                                                                                                               
    textureUrl: `/assets/avatar/${id}.png`,
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  };
});
// Merge fixed and randomly generated character objects
export const characters = fixedCharacters.concat(randomCharacters);

// Characters move at 0.75 tiles per second.
export const movementSpeed = 0.75;


function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


export function getRandomDirection(): { dx: number; dy: number } {
  const directions = [
    { dx: 1, dy: 0 },  // to right
    { dx: -1, dy: 0 }, // to left
    { dx: 0, dy: 1 },  // to footer
    { dx: 0, dy: -1 }, // to up
  ];
  return directions[Math.floor(Math.random() * directions.length)];
}

function isPositionObstacle(x: number, y: number, tileDim: number): boolean {
  const tileX = x;
  const tileY = y;  
  const isOutOfBounds = tileX < 0 || tileY < 0 || 
                         tileX >= map.objmap[0].length || 
                         tileY >= (map.objmap[0][0]?.length || 0);
  if (isOutOfBounds) return true;  
  const blockedInObj = map.objmap.some(layer => {
    return layer[tileX] && layer[tileX][tileY] !== -1;
  });
  const blockedInBg = false;
  return blockedInBg || blockedInObj;
}

function getRandomPassablePosition(minX: number, maxX: number, minY: number, maxY: number, tileDim: number): { x: number, y: number } {
 
  const maxAttempts = 5;
  let attempts = 0;
  
  while (attempts < maxAttempts) {

    const x = getRandomNumber(minX, maxX);
    const y = getRandomNumber(minY, maxY);

    if (!isPositionObstacle(x, y, tileDim)) {
      return { x, y };
    }
    attempts++;
  }
  return { x: 150, y: 180 }; 
}


const getRandomEmoji = () => {
  const emojis = ['❓', '😀', '😉', '😎', '😐', '😑', '😪', '😫'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

let cachedMockAgents: SimulatedAgent[] | null = null;

export const mockAgents = (tileDim: number = 32): SimulatedAgent[] => {
  if (cachedMockAgents !== null) {
    return cachedMockAgents;
  }
  cachedMockAgents = Array.from({ length: 400 }, (_, i) => {
    const num = i + 1;
    const position = getRandomPassablePosition(6, map.mapwidth - 6, 6, map.mapheight - 6, tileDim);
    return {
      name: agentNames[i - 1],
      activity: { description: 'reading a book', emoji: '📖', until: 0 },
      facing: getRandomDirection(),
      human: undefined,
      id: `p:${num}`,
      lastInput: 0,
      pathfinding: undefined,
      position: position,
      speed: 0.1,
      textureUrl: `/assets/avatar/${((i + 50) % 400) + 1}.png`,
      spritesheetData: f0SpritesheetData,
      emoji: getRandomEmoji()
    } as SimulatedAgent;
  });
  return cachedMockAgents;
};
