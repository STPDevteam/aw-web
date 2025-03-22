
import React, {  useState, useEffect } from 'react'
import { Text, Box, Image } from '@chakra-ui/react'
import { GeneralButton, BasePopup } from '@/components'
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAppDispatch } from '@/redux/hooks.js';
import { alertInfoAction, openConnectWalletAction, openCreateAction } from '@/redux/reducer/agentReducer.js';
import { RANDOM_ENCOUNTER_FEE, CREATE_AGENT_FEE, RECIPIENT_ADDRESS, STPT_ADDRESS } from '@/config'
import {  useWaitForTransactionReceipt, useAccount, useWriteContract, type BaseError, } from 'wagmi'
import STPT_ABI from '@/contract/STPT_ABI.json'
import { parseUnits } from 'viem';


interface iChat {
    worldId: any
    startChat: boolean
    agentCreated: boolean
    endChat: () => void
}
export const Chat:React.FC<iChat> = ({ worldId, startChat, agentCreated, endChat}) => {

    const [randomOpen, setRandomOpen] = useState<boolean>(false)
    const [btnLoading, setBtnLoading] = useState<boolean>(false)
    const [conversationList, setConversationList] = useState<{speaker: string, text: string}[]>([])
    const [title, setTitle] = useState('')

    const { address, isConnected } = useAccount()
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({hash})

    const dispatch = useAppDispatch()        
    const simulateConversationWithAgent = useAction(api.player.simulateConversationWithAgent)
    

    useEffect(() => {
        if(startChat) {
            handleRandomEncounter()
        }else {
            onClose()
        }
    },[startChat])

    useEffect(() => {
        if (error) {
            setBtnLoading(false)
            if ((error as any).code === 4001 || error?.message?.includes('User rejected')) {
                dispatch(alertInfoAction({
                    open: true,
                    title: 'Warning',
                    content: 'User rejected the request.',
                    closeModal: () => onClose()
                }))
            }
        }
    }, [error])


    useEffect(() => {
        if(hash && isConfirmed) {
            startEncounter()            
        }
    },[hash, isConfirmed])

    const startEncounter = async() => {
        if(worldId) {
            setBtnLoading(true)
            const a = await simulateConversationWithAgent({
                walletAddress: address as `0x${string}`,
                worldId
            })
            setBtnLoading(false)
            if(a && a.success) {
                setRandomOpen(true)
                setTitle(a.agent.name)
                setConversationList(a.conversation)
            }
        }
    }

    const handleRandomEncounter = async() => {
        if(isConnected && address) {          
            if(!agentCreated) {
                dispatch(alertInfoAction({
                    open: true,
                    title: 'Warning',
                    content: 'You need to create an Agent first!',
                    closeModal:() => {
                        dispatch(openCreateAction(true))                        
                    }
                }))               
            }else {

                setBtnLoading(true)
                const a = await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: '0x2105' }],
                })

                setTimeout(async() => {
                    await writeContract({
                        address: STPT_ADDRESS,
                        abi: STPT_ABI,
                        functionName: 'transfer',
                        args: [RECIPIENT_ADDRESS, parseUnits(`${RANDOM_ENCOUNTER_FEE}`, 18)],
                    })               
                },500)
            }
        }else {
            dispatch(openConnectWalletAction(true))
        }

    }

    const onClose = () => {
        setRandomOpen(false)
        setConversationList([])
        endChat()
    }
    return (
        <Box>
            {/* <GeneralButton 
                onClick={handleRandomEncounter}
                title='Send to Chat with NPC'
                size="md2"
                loading={btnLoading}
            /> */}
            <BasePopup
                visible={randomOpen}
                onClose={onClose}
                title={title}
                content={
                    <Box mt="30px" overflowY="scroll" maxH="432px" onWheel={(e) => e.stopPropagation()} >
                        {
                            conversationList.map((item:any) => (
                                <Box key={item.text} mt="20px">
                                    <Box className='fx-row ai-ct jc-sb'>
                                        {
                                            item.isAgent ? <Text className='fz24 gray fw700'>{item.speaker}</Text> : <div/>
                                        }
                                        {
                                            item.isAgent ? <div/> : <Text className='fz24 gray fw700'>{item.speaker}</Text>
                                        }
                                    </Box>

                                    <Box  className='center box_clip' p="24px 28px" mt="10px" w="553px"  bgColor="#838B8D">                        
                                        <Text className='gray2 fz400'>{item.text}</Text>
                                    </Box>
                                </Box>
                            ))
                        }
                    </Box>
                }
            >
            </BasePopup>
        </Box>
    )
}