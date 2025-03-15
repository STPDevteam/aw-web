import * as PIXI from 'pixi.js';
import { Spritesheet, BaseTexture } from 'pixi.js';
import { orientationDegrees } from '../../convex/util/geometry';

export type SimulatedAgent = {
    id: string;
    position: { x: number; y: number };
    textureUrl: string;
    spritesheetData: PIXI.ISpritesheetData;
    activity:  {description: string, emoji: string, until: number},
    facing:  {dx: number, dy: number},
    human: any,
    lastInput: number,
    pathfinding: string | undefined,
    speed: number
    moveCounter: number
}

export interface ExtendedAnimatedSprite extends PIXI.AnimatedSprite {
    _sheet?: PIXI.Spritesheet;
}

  
export async function createSimulatedAgentSprite(
    agent: SimulatedAgent,
    tileDim: number
  ): Promise<ExtendedAnimatedSprite> {
    const baseTexture = PIXI.BaseTexture.from(agent.textureUrl, {
      scaleMode: PIXI.SCALE_MODES.NEAREST,
    });
    const sheet = new PIXI.Spritesheet(baseTexture, agent.spritesheetData);
    await sheet.parse();
    const orientation = orientationDegrees(agent.facing);
    const roundedOrientation = Math.floor(orientation / 90);
    const directions = ['right', 'down', 'left', 'up'];
    const animationName = directions[roundedOrientation];
    const textures = sheet.animations[animationName];
    const animatedSprite = new PIXI.AnimatedSprite(textures) as ExtendedAnimatedSprite;
    animatedSprite.anchor.set(0.5);
    animatedSprite.scale.set(1);
    animatedSprite.x = agent.position.x * tileDim;
    animatedSprite.y = agent.position.y * tileDim;
    animatedSprite.animationSpeed = agent.speed;
    animatedSprite.play();
    animatedSprite._sheet = sheet;
    return animatedSprite;
  }
  