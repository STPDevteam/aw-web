import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import { toastOnError } from '../toasts';
import { useSendInput } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { Box, Image, Text  } from '@chakra-ui/react'
import { Title } from '@/components'
import { Close } from '@/images'
import { ButtonBgMd, } from '@/images'  
import { useAppSelector } from '@/redux/hooks';
import { selectActiveFEAgentId } from '@/redux/reducer';

export default function PlayerDetails({
  worldId,
  engineId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
  width,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
  width: number
}) {
  // const activeFEAgentId = useAppSelector(selectActiveFEAgentId)
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
  
  // console.log('activeFEAgentId', activeFEAgentId)


  const descriptionFun = (d: string) => (
    <Box className='box_clip center ' w={`${width}px`} px="20px" py="25px" bgColor='#838B8D' mt="10px">
      <Text className='gray4 fz16'>{d}</Text>
    </Box>
  )

  if (!playerId) {
    return (
      <Box mt="25px">
        <Box 
          bgImage={ButtonBgMd}
          bgSize="cover"
          bgPosition='center'
          bgRepeat="no-repeat"    
          className="center "
          h={`${width * 0.788 * 0.19637}px`}
          w={`${width * 0.788}px`}
        >
            <Text className="fw600 fz20 gray">Introduction</Text>
        </Box>
        { descriptionFun('Alice, it’s great to meet you! I’ve always been fascinated by the mysteries of the universe. What’s the most intriguing riddle you’re encountered in your research?')}
      </Box>

    )
  }
  // if (!playerId) {
  //   return (
  //     <div className="h-full text-xl flex text-center items-center white" >
  //       Click on an agent on the map to see chat history.
  //     </div>
  //   );
  // }

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
  // const pendingSuffix = (inputName: string) =>
  //   [...inflightInputs.values()].find((i) => i.name === inputName) ? ' opacity-50' : '';

  const pendingSuffix = (s: string) => '';


 

  return (
    <Box className='' w={`${width}px`}>      
   
      <Box className='fx-row ai-ct jc-sb' mt="24px">     
          <Box 
              bgImage={ButtonBgMd}
              bgSize="cover"
              bgPosition='center'
              bgRepeat="no-repeat"    
              className="center "
              h={`${width * 0.788 * 0.19637}px`}
              w={`${width * 0.788}px`}
          >
              <Text className="fw700 fz24 gray">{playerDescription?.name || ''}</Text>
          </Box>


        <Image src={Close} w="50px" h="50px" className='click' onClick={() => setSelectedElement(undefined)}/>
      </Box>

      {canInvite && <Box  onClick={onStartConversation} className='click'>{descriptionFun('Start conversation')}</Box> }
      {waitingForAccept && descriptionFun('Waiting for accept...')
     
      }
      {waitingForNearby && descriptionFun('Walking over...')}
      {inConversationWithMe && <Box className='click' onClick={onLeaveConversation}>{descriptionFun('Leave conversation')}</Box>}
      {haveInvite && (
        <>
          <a
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
          </a>
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
          { descriptionFun('Previous conversation')}

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
