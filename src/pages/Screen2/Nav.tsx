import React, {  useState, useEffect, useRef } from 'react'
import { Box, Text,Button, Image, Tooltip} from '@chakra-ui/react'
import { Font16, SvgButton } from '@/components'
import { ConnectWallet } from './ConnectWallet'
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAppDispatch } from '@/redux/hooks.js'
import { alertInfoAction, openConnectWalletAction } from '@/redux/reducer/agentReducer.js'
import {  useAccount, useSignMessage} from 'wagmi'
import { MyAgent } from './MyAgent'
import { Chat } from './Chat'
import { PointsImg } from '@/images'
import { motion } from "framer-motion"

const MotionBox = motion(Box)

export const Nav = () => {
    const [canCheckIn, setCanCheckIn] = useState<any>(false)

    const [visible, setVisible] = useState<boolean>(false)
    const [walletOpen, setWalletOpen] = useState<boolean>(false)
    const [createAgentOpen, setCreateAgentOpen] = useState<boolean>(false)
    const [myAgentOpen, setMyAgentOpen] = useState<boolean>(false)
    const [startChat, setStartChat] = useState<boolean>(false)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false)


    const { address, isConnected } = useAccount()
    const dispatch = useAppDispatch()
    const dailyCheckIn = useMutation(api.wallet.dailyCheckIn)       
    const checkStatus = useQuery(api.wallet.getCheckInStatus,{ walletAddress: address ?? '' })
      
    // console.log('checkStatus', checkStatus)
    // console.log('canCheckIn', canCheckIn)

    const worldStatus = useQuery(api.world.defaultWorldStatus)
    const worldId = worldStatus?.worldId   

    const { signMessageAsync } = useSignMessage();
    const createChallenge = useMutation(api.wallet.createAuthChallenge);
    const verifySignature = useMutation(api.wallet.verifySignature);
    const createdPlayers = useQuery(api.player.getPlayersByWallet, { walletAddress: address as string ?? ''})

    const AGENT_CREATED = createdPlayers && !!createdPlayers.players.length
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {   
        setCanCheckIn(checkStatus?.canCheckIn || false)
    }, [checkStatus?.canCheckIn])

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
    }, [visible]);

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
                            content: 'Claimed! World points +10'
                        }))
                        setCanCheckIn(false)
                    }
                }
            })

        })
    }    


    const memu = AGENT_CREATED ? [ // 
        { name: 'Wallet', event: () => setWalletOpen(true) },
        { name: 'Profile', event: () => setMyAgentOpen(true) },
        { name: 'Engage NPC', event: () => setStartChat(true) },
        { name: 'Join World', event: () => null, hover: 'Coming Soon' },
        { name: 'Delete Agent', event: () => setConfirmDeleteOpen(true) }
    ]: [
        { name: 'Create Agent', event: () => setCreateAgentOpen(true) },
    ]

   
    return(
        <Box className='w100' maxW="1720px" >
            <Box className='fx-row ai-ct jc-sb w100'>
                <Box className='fx-row ai-ct jc-sb'>
                    <Button 
                        onClick={onClaim}
                        w={[180]}
                        h={[46]}
                        bgColor='#293033' 
                        disabled={isConnected ? (!!!canCheckIn) : false}
                        className=" click box_clip" 
                        boxShadow=" 1px 1px 1px 0px rgba(0, 0, 0, 0.40) inset"
                        _hover={{
                            bgColor: '#838B8D'
                        }}
                    >
                        <Font16 t={checkStatus === null ? 'Daily Clock-in' :
                            (isConnected ? ((checkStatus && canCheckIn) ? 'Daily Clock-in' : 'Claimed') : 'Daily Clock-in')}/>
                    </Button>


                    <MyAgent 
                        worldId={worldId} 
                        createAgentOpen={createAgentOpen}
                        closeCreate={() => setCreateAgentOpen(false)}
                        myAgentOpen={myAgentOpen}
                        closeMy={() => setMyAgentOpen(false)}
                        createdPlayers={createdPlayers}
                        createAutoOpen={() => setCreateAgentOpen(true)}
                        confirmDeleteOpen={confirmDeleteOpen}
                        closeConfirmDelete={(v: boolean) => setConfirmDeleteOpen(v)}
                    />
                    <Chat 
                        worldId={worldId} 
                        startChat={startChat}
                        agentCreated={AGENT_CREATED as boolean}
                        endChat={() => setStartChat(false)}
                    />
                  
                </Box>               
                <Box className='fx-row ai-ct '>
                    <Button 
                        mr="20px"
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
                        <Font16 t={`World Points: ${checkStatus ? checkStatus?.currentPoints : 0}`}/>                       
                    </Button>
                   
                  


                    <Box pos='relative' className='' >
                        <ConnectWallet 
                            menuIsOpen={visible}
                            points={checkStatus ? checkStatus?.currentPoints : 0}
                            menuOpen={() => setVisible(true)}
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
                                {
                                    memu.map(item => (
                                        <SvgButton
                                            loading={false}
                                            hover={item.hover}
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