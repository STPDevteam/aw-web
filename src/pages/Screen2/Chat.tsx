
import React, {  useState, useEffect, useMemo } from 'react'
import { Text, Box, Tooltip } from '@chakra-ui/react'
import { BorderButton, BasePopup } from '@/components'
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAppDispatch } from '@/redux/hooks.js';
import { alertInfoAction, openConnectWalletAction, openCreateAction } from '@/redux/reducer/agentReducer.js';
import { AGENTS_CHAT_FEE, CHAT_AGENT_ADDRESS, STPT_ADDRESS, AGENT_ADDRESS} from '@/config'
import {  useWaitForTransactionReceipt, useAccount, useWriteContract,  Config, useConnectorClient } from 'wagmi'
import STPT_ABI from '@/contract/STPT_ABI.json'
import AGENT_ABI from '@/contract/AGENT_ABI.json'
import { ERC20Approve, parseUnits } from "@/utils/tool"
import { providers } from 'ethers'
import type { Account, Chain, Client, Transport } from 'viem'

interface iChat {
    worldId: any
    agentCreated: boolean
 
}
export const Chat:React.FC<iChat> = ({ worldId, agentCreated}) => {

    const [randomOpen, setRandomOpen] = useState<boolean>(false)
    const [btnLoading, setBtnLoading] = useState<boolean>(false)
    const [conversationList, setConversationList] = useState<{speaker: string, text: string}[]>([])
    const [title, setTitle] = useState('')

    const { address, isConnected } = useAccount()
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({hash})

    const dispatch = useAppDispatch()        
    const simulateConversationWithAgent = useAction(api.player.simulateConversationWithAgent)



  
    
   function clientToSigner(client: Client<Transport, Chain, Account>) {
      const { account, chain, transport } = client
      const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
      }
      const provider = new providers.Web3Provider(transport, network)
      if(account && account.address) {
          const signer = provider.getSigner(account.address)
          return signer
      }
      return null
    }
    

   function useEthersSigner({ chainId }: { chainId?: number } = {}) {
      const { data: client } = useConnectorClient<Config>({ chainId })
      return useMemo(() => (client ? clientToSigner(client) : undefined), [client])
    }

    const signer = useEthersSigner()


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
               
            dispatch(alertInfoAction({
                open: true,
                title: 'Successful',
                content: 'Engage NPC complete! World Points +40.',
                closeModal:() =>  startEncounter() 
            }))   

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

                const a = await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: '0x2105' }],
                })

                setBtnLoading(true)
                setTimeout(async() => {
                    const amount = parseUnits(AGENTS_CHAT_FEE, 18)
                    const { hash, message }: any = await ERC20Approve({                    
                        tokenContractAddress: STPT_ADDRESS,
                        tokenABI: STPT_ABI,
                        approveAddress: AGENT_ADDRESS,
                        approveAmount: amount,
                        signer
                    })

                    // console.log('hash', hash)
                    // console.log('message', message)

                    if(hash) {
                        await writeContract({
                            address: AGENT_ADDRESS,
                            abi: AGENT_ABI,
                            functionName: 'agentInterfacing',
                            args: [CHAT_AGENT_ADDRESS,amount],
                        })               
                    }
                    if(message) {
                        setBtnLoading(false)
                        dispatch(alertInfoAction({
                            open: true,
                            title: 'Warning',
                            content: message
                        }))  
                    }
                },500)    
            }
        }else {
            dispatch(openConnectWalletAction(true))
        }

    }

    const onClose = () => {
        setRandomOpen(false)
        setConversationList([])
        setBtnLoading(false)
    }
    return (
        <Box>
            <BorderButton
                    loading={btnLoading} 
                    w={180}
                    h={46}
                    onClick={handleRandomEncounter}
                    title='Engage Agents'
                    tooltip = {{
                        label: agentCreated ? 'Send your agent to engage other agents' : 'Create agent first',
                        size: agentCreated ? 'lg' : 'sm'
                    }}
                /> 
            <BasePopup
                visible={randomOpen}
                onClose={onClose}
                title={title}
                content={
                    <Box 
                        p="40px" 
                        className=''  
                        overflowY="scroll" 
                        maxH="514px" 
                        mt="20px"
                        onWheel={(e) => e.stopPropagation()} >
                        {
                            conversationList.map((item:any) => (
                                <Box key={item.text} mt="10px">
                                    <Box className='fx-row ai-ct jc-sb'>
                                        {
                                            item.isAgent ? <Text className='gray fm2' fontWeight={600} fontSize={['16px','16px','16px','16px','18px','20px']}>{item.speaker}</Text> : <div/>
                                        }
                                        {
                                            item.isAgent ? <div/> : <Text className='gray fm2' fontWeight={600} fontSize={['16px','16px','16px','16px','18px','20px']}>{item.speaker}</Text>
                                        }
                                    </Box>

                                    <Box  className='center box_clip fm3' p="20px" mt="10px" w="515px"  bgColor="#838B8D">                        
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