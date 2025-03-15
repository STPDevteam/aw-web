import { data as f0SpritesheetData } from './spritesheets/f0';
import {  SimulatedAgent } from '../src/components/createSimulatedAgentSprite';
import * as map from './gentle';


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
    textureUrl: '/ai-town/assets/avatar/1.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f2',
    textureUrl: '/ai-town/assets/avatar/2.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f3',
    textureUrl: '/ai-town/assets/avatar/3.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f4',
    textureUrl: '/ai-town/assets/avatar/4.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f5',
    textureUrl: '/ai-town/assets/avatar/5.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f6',
    textureUrl: '/ai-town/assets/avatar/6.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f7',
    textureUrl: '/ai-town/assets/avatar/7.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f8',
    textureUrl: '/ai-town/assets/avatar/8.png',
    spritesheetData: f0SpritesheetData,
    speed: 0.1,
  },
];

// random count
const randomCount = 42;
const randomDescriptions = Array.from({ length: randomCount }, (_, i) => {
  const id = i + 9;
  const randomName = getRandomName(id);
  return {
    name: randomName,
    character: `f${id}`,
    identity: randomIdentity(randomName),
    plan: randomPlan(),
  };
});

// Merge fixed and randomly generated description objects
export const Descriptions = fixedDescriptions.concat(randomDescriptions);

export const randomCharacters = Array.from({ length: randomCount }, (_, i) => {
  const id = i + 9;
  return {
    name: `f${id}`,                                                                                                                                                                               
    textureUrl: `/ai-town/assets/avatar/${id}.png`,
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

// export const mockAgents = () => {

//   return Array.from({ length: 400}, (_, i) => {
//     const num = 500 - i;
//     return {
//       activity: { description: 'reading a book', emoji: '📖', until: 0 },
//       facing: getRandomDirection(),
//       human: undefined,
//       id: `p:${num}`,
//       lastInput: 0,
//       pathfinding: undefined,
 
//       position: { x: getRandomNumber(4, 205), y: getRandomNumber(4, 197) },
//       speed: 0.1,
//       textureUrl: `/ai-town/assets/avatar/${(i % 10) + 10}.png`,
//       spritesheetData: f0SpritesheetData,
//     };
//   });
// };
function isPositionObstacle(x: number, y: number, tileDim: number): boolean {
  // 将像素坐标转换为瓦片坐标
  const tileX = x;
  const tileY = y;
  
  // 检查坐标是否在地图范围内
  const isOutOfBounds = tileX < 0 || tileY < 0 || 
                         tileX >= map.objmap[0].length || 
                         tileY >= (map.objmap[0][0]?.length || 0);
  
  if (isOutOfBounds) return true; // 将地图边界视为障碍物
  
  // 检查对象图层是否有障碍物
  const blockedInObj = map.objmap.some(layer => {
    return layer[tileX] && layer[tileX][tileY] !== -1;
  });
  
  // 检查背景图层是否有障碍物（如果需要）
  // 根据你的地图设置，可能需要调整背景图层的检查逻辑
  const blockedInBg = false; // 暂时忽略背景图层

  return blockedInBg || blockedInObj;
}



function getRandomPassablePosition(minX: number, maxX: number, minY: number, maxY: number, tileDim: number): { x: number, y: number } {
  // 最大尝试次数，避免无限循环
  const maxAttempts = 3;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // 生成随机位置
    const x = getRandomNumber(minX, maxX);
    const y = getRandomNumber(minY, maxY);
    
    // 检查位置是否可通行
    if (!isPositionObstacle(x, y, tileDim)) {
      return { x, y };
    }
    
    attempts++;
  }
  
  // 如果找不到可通行位置，返回默认安全位置
  // 你可以指定一个你确定安全的位置作为后备
  console.warn("无法找到可通行的随机位置，使用默认安全位置");
  return { x: 10, y: 10 }; // 假设这是一个安全位置，需要根据你的地图调整
}

export const mockAgents = (tileDim: number = 32) => { 
  return Array.from({ length: 400}, (_, i) => {
    const num = 500 - i;
    
    // 获取随机的可通行位置
    const position = getRandomPassablePosition(5, 168, 5, 192, tileDim);
    
    return {
      activity: { description: 'reading a book', emoji: '📖', until: 0 },
      facing: getRandomDirection(),
      human: undefined,
      id: `p:${num}`,
      lastInput: 0,
      pathfinding: undefined,
      position: position, // 使用可通行的位置
      speed: 0.1,
      textureUrl: `/ai-town/assets/avatar/${(i % 10) + 10}.png`,
      spritesheetData: f0SpritesheetData,
    };
  });
};