import { SpritesheetData } from './types';

const baseSize = 144 // 576/4


export const data: SpritesheetData = {
  frames: {
    left: {
      frame: { x: 0, y: baseSize, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    left2: {
      frame: { x: baseSize, y: baseSize, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    left3: {
      frame: { x: baseSize * 2, y: baseSize, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    right: {
      frame: { x: 0, y: baseSize * 2, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    right2: {
      frame: { x: baseSize, y: baseSize * 2, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    right3: {
      frame: { x: baseSize * 2, y: baseSize * 2, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    up: {
      frame: { x: 0, y: baseSize * 3, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    up2: {
      frame: { x: baseSize, y: baseSize * 3, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    up3: {
      frame: { x: baseSize * 2, y: baseSize * 3, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    down: {
      frame: { x: 0, y: 0, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    down2: {
      frame: { x: baseSize, y: 0, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
    down3: {
      frame: { x: baseSize * 2, y: 0, w: 144, h: 144 },
      sourceSize: { w: 144, h: 144 },
      spriteSourceSize: { x: 0, y: 0 },
    },
  },
  meta: {
    scale: '1',
  },
  animations: {
    left: ['left', 'left2', 'left3'],
    right: ['right', 'right2', 'right3'],
    up: ['up', 'up2', 'up3'],
    down: ['down', 'down2', 'down3'],
  },
};
