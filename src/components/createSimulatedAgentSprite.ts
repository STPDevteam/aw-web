import * as PIXI from 'pixi.js';
import { Spritesheet, BaseTexture } from 'pixi.js';
import { orientationDegrees } from '../../convex/util/geometry.ts';

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
}

export async function createSimulatedAgentSprite(
  agent: SimulatedAgent,
  tileDim: number
): Promise<PIXI.AnimatedSprite> {

    const sheet = new Spritesheet(
        BaseTexture.from(agent.textureUrl, {
            scaleMode: PIXI.SCALE_MODES.NEAREST,
        }),
        agent.spritesheetData,
    )
    await sheet.parse();
   
    const orientation = orientationDegrees(agent.facing)

    const roundedOrientation = Math.floor(orientation / 90);
    const animationName = ['right', 'down', 'left', 'up'][roundedOrientation];
    const textures = sheet.animations[animationName];

    const animatedSprite = new PIXI.AnimatedSprite(textures);
    animatedSprite.anchor.set(0.5);
    animatedSprite.scale.set(1.5);
    animatedSprite.x = agent.position.x * tileDim;
    animatedSprite.y = agent.position.y * tileDim;
    animatedSprite.animationSpeed = agent.speed;
    animatedSprite.play();

    
    return animatedSprite;
}
