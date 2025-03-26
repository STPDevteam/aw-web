import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import { toastOnError } from '../toasts';
import { useSendInput } from '../hooks/sendInput';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { Box, Image, Text  } from '@chakra-ui/react'
import { Close } from '@/images'
import { ButtonBgMd, } from '@/images'  
import { useEffect, useMemo } from 'react';

export default function PlayerDetails({
  worldId,
  engineId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
  onClearFEAgent
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
  onClearFEAgent:() => void

}) {
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId });

  const players = [...game.world.players.values()];
  const humanPlayer = players.find((p) => p.human === humanTokenIdentifier);
  const humanConversation = humanPlayer ? game.world.playerConversation(humanPlayer) : undefined;
  // Always select the other player if we're in a conversation with them.
  if (humanPlayer && humanConversation) {
    const otherPlayerIds = [...humanConversation.participants.keys()].filter(
      (p) => p !== humanPlayer.id,
    );
    playerId = otherPlayerIds[0];
  }

  const player = playerId && game.world.players.get(playerId);
  const playerConversation = player && game.world.playerConversation(player);

  const previousConversation = useQuery(
    api.world.previousConversation,
    playerId ? { worldId, playerId } : 'skip',
  );


  const playerDescription = playerId && game.playerDescriptions.get(playerId);

  const startConversation = useSendInput(engineId, 'startConversation');
  const acceptInvite = useSendInput(engineId, 'acceptInvite');
  const rejectInvite = useSendInput(engineId, 'rejectInvite');
  const leaveConversation = useSendInput(engineId, 'leaveConversation');
  

  const descriptionFun = (d: string | React.ReactNode) => (
    <Box 
      className='box_clip center w100'
      bgColor='#838B8D' 
      mt="10px"
      p={['10px','10px','10px','14px','16px', '20px']}
     
    >
      <Text className='gray4 fm3' fontSize={['14px','14px','14px','14px','14px','16px']}>{d}</Text>
    </Box>
  ) 
  const descriptionFun2 = (d: string | React.ReactNode) => (
    <Box 
      className='box_clip center w100'
      bgColor='#838B8D' 
      mt="10px"
      p={['10px','10px','10px','10px','10px', '12px','20px']}
     
    >
      <Text className='gray4 fm3' fontSize={['12px','12px','12px','12px','12px','14px','16px']}>{d}</Text>
    </Box>
  ) 

 

  if (!playerId) {
    return (
      <Box className='h100'>
        {/* <Box
          mb="10px"
          h="10px"
          w="10px"
           borderWidth="1px"
        borderStyle='solid'
        borderColor={['red','green','yellow','blue','pink','green','red']}
        /> */}
        <Box 
          className='center gradient_border'
          w="100%"
          h="46px"
        >
          <Text className="fm1 fw600 gray gradient_content" fontSize={['14px','14px','14px','14px','16px','20px']}>Autonomous World Demo: AI Town</Text>         
        </Box>
        { descriptionFun2('Welcome to AI Town, the first demo of World.Fun autonomous world launchpad, featuring 1,000 live agents living, evolving and socializing in a world of endless possibilities.')}
        <Box 
          mt="22px"
          className='center gradient_border'
          w="100%"
          h="46px"
        >
          <Text className="fm1 fw600 gray gradient_content" fontSize={['14px','14px','14px','14px','16px','20px']}>Engage to Earn World Points</Text>         
        </Box>

       
        { descriptionFun2(
          <div>
            <p>Be the first to engage with World.Fun and earn World Points for future airdrops! </p>
            <p>⏰ Daily clock-in (free) to earn 10 World Points</p>
            <p>🤖Create agent (10 $STPT) to earn 500 World Points</p>
            <p>💬 Engage agents (1 $STPT) to earn 40 World Points</p>
            <p>🌍 Join world (coming soon)</p>
          </div>)}
      </Box>
    )
  }
 
  
 





  if (!player) {
    return null;
  }
  const isMe = humanPlayer && player.id === humanPlayer.id;
  const canInvite = !isMe && !playerConversation && humanPlayer && !humanConversation;
  const sameConversation =
    !isMe &&
    humanPlayer &&
    humanConversation &&
    playerConversation &&
    humanConversation.id === playerConversation.id;

  const humanStatus =
    humanPlayer && humanConversation && humanConversation.participants.get(humanPlayer.id)?.status;
  const playerStatus = playerConversation && playerConversation.participants.get(playerId)?.status;

  const haveInvite = sameConversation && humanStatus?.kind === 'invited';
  const waitingForAccept =
    sameConversation && playerConversation.participants.get(playerId)?.status.kind === 'invited';
  const waitingForNearby =
    sameConversation && playerStatus?.kind === 'walkingOver' && humanStatus?.kind === 'walkingOver';

  const inConversationWithMe =
    sameConversation &&
    playerStatus?.kind === 'participating' &&
    humanStatus?.kind === 'participating';

  const onStartConversation = async () => {
    if (!humanPlayer || !playerId) {
      return;
    }
    console.log(`Starting conversation`);
    await toastOnError(startConversation({ playerId: humanPlayer.id, invitee: playerId }));
  };
  const onAcceptInvite = async () => {
    if (!humanPlayer || !humanConversation || !playerId) {
      return;
    }
    await toastOnError(
      acceptInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onRejectInvite = async () => {
    if (!humanPlayer || !humanConversation) {
      return;
    }
    await toastOnError(
      rejectInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onLeaveConversation = async () => {
    if (!humanPlayer || !inConversationWithMe || !humanConversation) {
      return;
    }
    await toastOnError(
      leaveConversation({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };


  const pendingSuffix = (s: string) => ''; 

  return (
    <Box className='w100' >      
   
      <Box className='fx-row ai-ct jc-sb'>     
          
          <Box 
            className='center gradient_border'
            w="100%"
            h="46px"
          >
            <Text className="fm2 gradient_content" color="#E0E0E0" fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>{playerDescription?.name || ''}</Text>         
          </Box>

        <Image src={Close} w="34px" h="34px" className='click' onClick={() => {
          setSelectedElement(undefined)
          onClearFEAgent()
        }}/>
      </Box>

      {canInvite && <Box  onClick={onStartConversation} className='click'>{descriptionFun('Start conversation')}</Box> }
      {waitingForAccept && descriptionFun('Waiting for accept...')}
      {waitingForNearby && descriptionFun('Walking over...')}
      {inConversationWithMe && <Box className='click' onClick={onLeaveConversation}>{descriptionFun('Leave conversation')}</Box>}
      {haveInvite && (
        <>
          {/* <a
            className={
              'mt-6  text-white shadow-solid text-xl cursor-pointer pointer-events-auto' +
              pendingSuffix('acceptInvite')
            }
            onClick={onAcceptInvite}
          >
            <div className="h-full text-center">
              <span>Accept</span>
            </div>
          </a>
          <a
            className={
              'mt-6 button text-white shadow-solid text-xl cursor-pointer pointer-events-auto' +
              pendingSuffix('rejectInvite')
            }
            onClick={onRejectInvite}
          >
            <div className="h-full text-center">
              <span>Reject</span>
            </div>
          </a> */}
        </>
      )}
      { !playerConversation && player.activity && player.activity.until > Date.now()  && descriptionFun(player.activity.description) }
      
      { descriptionFun(isMe ? 'This is you!' : (playerDescription?.description || '') ) }

      { !isMe && inConversationWithMe && descriptionFun('Conversing with you!')}
     
      {!isMe && playerConversation && playerStatus?.kind === 'participating' && (
        <Messages
          worldId={worldId}
          engineId={engineId}
          inConversationWithMe={inConversationWithMe ?? false}
          conversation={{ kind: 'active', doc: playerConversation }}
          humanPlayer={humanPlayer}
          scrollViewRef={scrollViewRef}
        />
      )}
      {!playerConversation && previousConversation && (
        <div style={{ }} className=''>
          {/* { descriptionFun('Previous conversation')} */}

          <Messages
            worldId={worldId}
            engineId={engineId}
            inConversationWithMe={false}
            conversation={{ kind: 'archived', doc: previousConversation }}
            humanPlayer={humanPlayer}
            scrollViewRef={scrollViewRef}
          />
        </div>
      )}
    </Box>
  );
}
