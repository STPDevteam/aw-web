import { BaseTexture, ISpritesheetData, Spritesheet } from 'pixi.js';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatedSprite, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';

export const Character = ({
  textureUrl,
  spritesheetData,
  x,
  y,
  orientation,
  isMoving = false,
  isThinking = false,
  isSpeaking = false,
  emoji = '',
  isViewer = false,
  speed = 0.1,
  onClick,
}: {
  // Path to the texture packed image.
  textureUrl: string;
  // The data for the spritesheet.
  spritesheetData: ISpritesheetData;
  // The pose of the NPC.
  x: number;
  y: number;
  orientation: number;
  isMoving?: boolean;
  // Shows a thought bubble if true.
  isThinking?: boolean;
  // Shows a speech bubble if true.
  isSpeaking?: boolean;
  emoji?: string;
  // Highlights the player.
  isViewer?: boolean;
  // The speed of the animation. Can be tuned depending on the side and speed of the NPC.
  speed?: number;
  onClick: () => void;
}) => {
  const [spriteSheet, setSpriteSheet] = useState<Spritesheet>();

  const getRandomEmoji = () => {
    const emojis = ['❓', '😀', '😉', '😎', '😐', '😑', '😪', '😫'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  };

  const [randomEmoji, setRandomEmoji] = useState<string>(getRandomEmoji());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRandomEmoji(getRandomEmoji());
    }, 30000); 
    return () => clearInterval(intervalId);
  }, []);


  useEffect(() => {
    const parseSheet = async () => {
      const sheet = new Spritesheet(
        BaseTexture.from(textureUrl, {
          scaleMode: PIXI.SCALE_MODES.NEAREST,
        }),
        spritesheetData,
      );
      await sheet.parse();
      setSpriteSheet(sheet);
    };
    void parseSheet();
  }, []);

  // The first "left" is "right" but reflected.
  const roundedOrientation = Math.floor(orientation / 90);
  const direction = ['right', 'down', 'left', 'up'][roundedOrientation];

  // console.log('direction', direction)

  // Prevents the animation from stopping when the texture changes
  // (see https://github.com/pixijs/pixi-react/issues/359)
  const ref = useRef<PIXI.AnimatedSprite | null>(null);
  useEffect(() => {
    if (isMoving) {
      ref.current?.play();
    }
  }, [direction, isMoving]);

  if (!spriteSheet) return null;

  let blockOffset = { x: 0, y: 0 };
  switch (roundedOrientation) {
    case 2:
      blockOffset = { x: -20, y: 0 };
      break;
    case 0:
      blockOffset = { x: 20, y: 0 };
      break;
    case 3:
      blockOffset = { x: 0, y: -20 };
      break;
    case 1:
      blockOffset = { x: 0, y: 20 };
      break;
  }

  const emojiText = (e:string, x?: number) => (
    <Text x={x || 12} y={-36} scale={{ x: 1, y: 1 }} text={e} anchor={{ x: 0.5, y: 0.5 }} />
  )
  return (
    <Container x={x} y={y} interactive={true} pointerdown={onClick} cursor="pointer">
      {isThinking && (
        // TODO: We'll eventually have separate assets for thinking and speech animations.
        <>{emojiText('💭')}</>
      )}
      {isSpeaking && ( // 
        // TODO: We'll eventually have separate assets for thinking and speech animations.
        <>{emojiText('💬')}</>
      )}
      {isViewer && <ViewerIndicator />}
      <AnimatedSprite
        ref={ref}
        isPlaying={isMoving}
        textures={spriteSheet.animations[direction]}
        animationSpeed={speed}
        anchor={{ x: 0.5, y: 0.5 }}
        scale={{ x: 1, y: 1 }} 
      />
      {emoji && (
        <>{emojiText(emoji)}</>
      )}
      
       {
        !isThinking && !isSpeaking && !!!emoji  &&  
        <>{emojiText(randomEmoji)}</>
      }
    </Container>
  );
};

function ViewerIndicator() {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.beginFill(0xffff0b, 0.5);
    g.drawRoundedRect(-20, 20, 40, 20, 200);
    g.endFill();
  }, []);

  return <Graphics draw={draw} />;
}

