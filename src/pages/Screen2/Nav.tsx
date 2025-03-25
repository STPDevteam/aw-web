import React, {  useState, useEffect, useRef } from 'react'
import { Box, Text,Button, Image, Tooltip} from '@chakra-ui/react'
import { Font16, SvgButton, BorderButton} from '@/components'
import { ConnectWallet } from './ConnectWallet'
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { alertInfoAction, myAgentPopupVisibleAction, openConnectWalletAction, selectMyAgentPopupVisible } from '@/redux/reducer/agentReducer'
import {  useAccount, useSignMessage} from 'wagmi'
import { MyAgent } from './MyAgent'
import { Chat } from './Chat'
import { PointsImg } from '@/images'
import { motion } from "framer-motion"
import { openLink } from '@/utils/tool'

const MotionBox = motion(Box)

export const Nav = () => {
    const [countdown, setCountdown] = useState<string>('--')
    const [canCheckIn, setCanCheckIn] = useState<any>(false)
    const [visible, setVisible] = useState<boolean>(false)
    const [walletOpen, setWalletOpen] = useState<boolean>(false)
    const { address, isConnected } = useAccount()
    const dispatch = useAppDispatch()
    const myAgentPopupVisible = useAppSelector(selectMyAgentPopupVisible)  
    const dailyCheckIn = useMutation(api.wallet.dailyCheckIn)       
    const checkStatus = useQuery(api.wallet.getCheckInStatus,{ walletAddress: address ?? '' })
      
    // console.log('canCheckIn', canCheckIn)

    const worldStatus = useQuery(api.world.defaultWorldStatus)
    const worldId = worldStatus?.worldId   

    const { signMessageAsync } = useSignMessage();
    const createChallenge = useMutation(api.wallet.createAuthChallenge);
    const verifySignature = useMutation(api.wallet.verifySignature);
    const walletLogin = useMutation(api.wallet.walletLogin);
    const createdPlayers = useQuery(api.player.getPlayersByWallet, { walletAddress: address as string ?? ''})

    const AGENT_CREATED = createdPlayers && !!createdPlayers.players.length
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {   
        setCanCheckIn(checkStatus?.canCheckIn || false)
    }, [checkStatus?.canCheckIn])

    const isClaimed = isConnected && checkStatus && checkStatus?.canCheckIn === false

    

    useEffect(() => {
        if (isClaimed && checkStatus) {
          const { nextResetTime } = checkStatus;
          if (nextResetTime) {
            const updateCountdown = () => {
              const remainingSeconds = Math.max(0, Math.floor((nextResetTime - Date.now()) / 1000));
              setCountdown(formatTime(remainingSeconds));
              if (remainingSeconds === 0) {
                setCanCheckIn(true);
              }
            };
      
            updateCountdown(); 
            const timerId = setInterval(updateCountdown, 1000);
            return () => clearInterval(timerId);
          }
        }
    }, [isClaimed, checkStatus, setCanCheckIn])
      
    

    useEffect(() => {
        if(address && isConnected) {
            const loginAddress = localStorage.getItem('loginAddress')
            if(loginAddress && loginAddress === address) {
                // Already logged in
            }else {
                onLogin()
            }
           
        }else {
            localStorage.removeItem('loginAddress')
        }
    },[address, isConnected])

    useEffect(() => {
        function handleClickOutside(event:MouseEvent) {
            if (menuRef.current && 
                event.target instanceof Node &&
                !menuRef.current.contains(event.target)) {
                setVisible(false)
            }
        }
        if (visible) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [visible])

    const onLogin = async() => {
        const w = await walletLogin({ walletAddress: address as string })
        localStorage.setItem('loginAddress', `${address}`)        
    }

    const signInWithWallet = async() => { 
        try {
            if (!isConnected || !address) {
                return
            }
            const { challenge } = await createChallenge({ walletAddress: address })
            const signature = await signMessageAsync({ message: challenge })
            const result = await verifySignature({
                walletAddress: address,
                signature,
            });
            return result
        } catch (error:any) {
            // console.log('errorerror', error)
            if ((error as any).code === 4001 || error?.message?.includes('User rejected')) {
                dispatch(alertInfoAction({
                    open: true,
                    title: 'Warning',
                    content: 'User rejected the request.',
                }))
            }            
            return false
            
        }
    }
      
  

    const checkWalletConnected = (cb:() => void) => {
        if(isConnected && address) {
            cb()
        }else {
            dispatch(openConnectWalletAction(true))
        }
    }

    const onClaim = () => {
        checkWalletConnected(async() => {
            signInWithWallet().then(async(res: any) => {
                if(res) {
                    const a = await dailyCheckIn({ walletAddress: address as `0x${string}` })
                    if(a && a.success) {
                        dispatch(alertInfoAction({
                            open: true, 
                            title: 'Claim',
                            content: 'Claimed! World Points +10'
                        }))
                        setCanCheckIn(false)
                    }
                }
            })

        })
    }    


    const memu = AGENT_CREATED ? [ // 
        { name: 'Wallet', event: () => setWalletOpen(true) },
        { name: 'Agent Profile', event: () => dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, myOpen: true })) },
        { name: 'Delete Agent', event: () => dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, confirmOpen: true }))  }
    ]: [
        { name: 'Wallet', event: () => setWalletOpen(true) },
        { name: 'Create Agent', event: () => dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, createOpen: true })) },
    ]

   

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        const formattedHours = String(hours).padStart(2, '0');
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(secs).padStart(2, '0');
        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    }


    return( 
        <Box className='w100' maxW="1720px" mb="20px">
            <Box className='fx-row ai-ct jc-sb w100'>
                {/*  left */}
                <Box className='fx-row ai-ct jc-sb' gap={['8px','8px','8px','12px','12px','24px']}>
                    <MyAgent 
                        worldId={worldId} 
                        createdPlayers={createdPlayers}
                    />
                    <Chat 
                        worldId={worldId} 
                        agentCreated={AGENT_CREATED as boolean}
                    />

                    <BorderButton
                        disable={true}
                        w={180}
                        h={46}
                        title='Join World'
                        onClick={() => null}
                        tooltip = {{
                            label: 'Coming Soon',
                            size: 'sm'
                        }}

                    />                   
                </Box>      

                {/*  right */}
                <Box className='fx-row ai-ct' gap={['8px','8px','8px','12px','12px','24px']}>

                    <BorderButton
                        disable={isConnected ? (!!!canCheckIn) : false}
                        w={180}
                        h={46}
                        title={
                            // isClaimed ? countdown : 'Daily Clock-in'
                            checkStatus === null ? 'Daily Clock-in' :
                            (isConnected ? ((checkStatus && canCheckIn) ? 'Daily Clock-in' : 'Claimed') : 'Daily Clock-in')
                        }
                        onClick={onClaim}
                    />  
                     <BorderButton
                        w={180}
                        h={46}
                        title='Get $STPT'
                        onClick={() => openLink('https://aerodrome.finance/swap?from=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&to=0x4489d0a0345ecb216a3994de780d453c7fa6312c&chain0=8453&chain1=8453')}
                    />

                    
                    <Box pos='relative' className='' >
                        <ConnectWallet 
                            menuIsOpen={visible}
                            points={checkStatus ? checkStatus?.currentPoints : 0}
                            menuOpen={() => setVisible(!visible)}
                            walletOpen={walletOpen}
                            closeWalletOpen={() => setWalletOpen(false)}
                        />    
                         
                        {visible && (
                            <MotionBox 
                                ref={menuRef}
                                zIndex={9}
                                className="fx-col ai-ct "
                                pos="absolute"
                                top='50px'
                                right={0}
                                w={[180]}
                                initial={{ opacity: 0, scale: 0.9, y: -10 }} 
                                animate={{ opacity: 1, scale: 1, y: 0 }} 
                                exit={{ opacity: 0, scale: 0.9, y: -10 }} 
                                transition={{ duration: 0.2 }} 
                            >
                                <Button 
                                    mb="1px"
                                    w={[180]}
                                    h={[46]}
                                    bgColor='#838B8D' 
                                    className="fx-row ai-ct jc-sb click box_clip" 
                                    boxShadow=" 1px 1px 1px 0px rgba(0, 0, 0, 0.40) inset"
                                    px={['12px','12px','12px','15px','15px']}
                                    _hover={{
                                        bgColor: '#838B8D'
                                    }}
                                >
                                    <Image src={PointsImg} w="24px" h="25px" mr="5px" />     
                                    <div className='fm2'>
                                        <Font16 t={`World Points: ${checkStatus ? checkStatus?.currentPoints : 0}`}/>     
                                    </div>                  
                                </Button>

                                {
                                    memu.map(item => (
                                        <SvgButton
                                            loading={false}
                                            onClick={item.event}
                                            name={item.name}
                                            w={[180]}
                                            h={[46]}
                                        />                                          
                                    ))
                                }
                            </MotionBox>
                            )
                        }                     
                    </Box>
                </Box>
            </Box>      
        </Box>    
    )
}


148/ 180