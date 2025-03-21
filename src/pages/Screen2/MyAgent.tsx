
import React, {  useState, useEffect } from 'react'
import { Text, Box, Image } from '@chakra-ui/react'
import { GeneralButton, BasePopup, CreateInput } from '@/components'
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAppDispatch, useAppSelector } from '@/redux/hooks.js';
import { alertInfoAction, openConnectWalletAction, openCreateAction, selectOpenCreate } from '@/redux/reducer/agentReducer.js';
import { RANDOM_ENCOUNTER_FEE, CREATE_AGENT_FEE, RECIPIENT_ADDRESS, STPT_ADDRESS } from '@/config'
import {  useWaitForTransactionReceipt, useAccount, useWriteContract, type BaseError, useChainId } from 'wagmi'
import STPT_ABI from '@/contract/STPT_ABI.json'
import { Logo } from '@/images'
import { parseUnits } from 'viem'

interface iInput {
    value: string
    maxLen: number
    msg: string
    disable: boolean
}

export const MyAgent:React.FC<{ worldId: any }> = ({ worldId }) => {

    const { address, isConnected } = useAccount()
    const [myAgentOpen, setMyAgentOpen] = useState<boolean>(false)
    const [createOpen, setCreateOpen] = useState<boolean>(false)
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false)
    const [confirmOpen, setConfirmOpen] = useState<boolean>(false)
    const [name, setName] = useState<iInput>({
            value: '',
            maxLen: 15,
            msg: '',
            disable: true
    })
    
    const [prompt, setPrompt] = useState<iInput>({
        value: '',
        maxLen: 50,
        msg: '',
        disable: true
    })
    const dispatch = useAppDispatch()
    

    const createdPlayers = useQuery(api.player.getPlayersByWallet, { walletAddress: address as string ?? ''})
    const createPlayer = useMutation(api.player.createPlayer)
    const deletePlayer = useMutation(api.player.deletePlayer)

    const AGENT_CREATED = createdPlayers && !!createdPlayers.players.length

    const { data: hash, writeContract, isPending, error } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({hash})

    const [btnLoading, setBtnLoading] = useState(false)
    
    
    const [myAgentInfo, setMyAgentInfo] = useState<any>({
        character: '',
        createdAt: 0,
        description: '',
        gamePlayerId: '',
        name: '',
        walletAddress: '',
        worldId: '',
        _creationTime: 0,
        _id: '',
    })

    const openCreate = useAppSelector(selectOpenCreate)    


    useEffect(() => {
        openCreate && setCreateOpen(true)
    },[openCreate])

    useEffect(() => {
        if(hash && isConfirmed) {
           startCreate()            
        }
    },[hash, isConfirmed])
   
    useEffect(() => {
        if (error) {
            setBtnLoading(false)
            if ((error as any).code === 4001 || error?.message?.includes('User rejected')) {
                dispatch(alertInfoAction({
                open: true,
                title: 'Warning',
                content: 'User rejected the request.',
            }))
          }
        }
    }, [error])

        
    useEffect(() => {
        if(AGENT_CREATED) {
            setMyAgentInfo(createdPlayers.players[0])
        }
    },[createdPlayers])

    const startCreate = async() => {
        if(worldId) {
            setBtnLoading(true)
            const a = await createPlayer({
                walletAddress: address as  `0x${string}`,
                name: name.value,
                prompt: prompt.value,
                worldId,
                showInGame: false
            })
            setBtnLoading(false)
            if(a && a.success) {
               
                closeCreateModal() 
                dispatch(alertInfoAction({
                    open: true,
                    title: 'Successful',
                    content: 'Agent created! World Points +500.'
                }))              
            }
           
        }
    }

    const handleAgent = () => {
        if(isConnected && address) {
            if(AGENT_CREATED) {    
                setMyAgentOpen(true)
            }else {
                setCreateOpen(true)
            }
        }else {
            dispatch(openConnectWalletAction(true))
        }
    }


     const handleCreateClose = () => {
        if(!!name.value.length || !!prompt.value.length) {
            setCreateOpen(false)
            dispatch(alertInfoAction({
                open: true,
                title: 'Warning',
                content: 'Cancelled'
            }))
        }else {
            setCreateOpen(false)
        }
        dispatch(openCreateAction(false))
    }

    const onChangeName = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value

        if(val.length === 0) {
            return setName({...name, value: '', msg: '', disable: true})
        }
        if(val.length > name.maxLen) {
           return setName({...name, msg: `${name.maxLen} characters max`, value: val, disable: true})
        }
        setName({...name, value: val, msg: '', disable: false})
    }

    const onChangePrompt = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        if(val.length === 0) {
            return setPrompt({...prompt, value: '', msg: '', disable: true})
        }
        if(val.length > prompt.maxLen) {
           return setPrompt({...prompt, msg: `${prompt.maxLen} characters max`, value: val, disable: true})
        }
        setPrompt({...prompt, value: val, msg: '', disable: false})
    } 

    const onCreateAgent = async() => {

      
        if(!!name.value.length && !!prompt.value.length && !name.disable && !prompt.disable) {
            setCreateOpen(false)
            setBtnLoading(true)      
            
            const a = await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: '0x2105' }],
            })
            setTimeout(async() => {
                await writeContract({
                    address: STPT_ADDRESS,
                    abi:STPT_ABI,
                    functionName: 'transfer',
                    // args: [RECIPIENT_ADDRESS, parseUnits(`0.2`, 18)],
                    args: [RECIPIENT_ADDRESS, parseUnits(`${CREATE_AGENT_FEE}`, 18)],
                })
            },500)
           
        }
    }   

    const closeCreateModal = () => {
        setName({
            value: '',
            maxLen: 15,
            msg: '',
            disable: true
        })
        setPrompt({
            value: '',
            maxLen: 50,
            msg: '',
            disable: true
        })
    }

    const deleteAgent = async() => {
        if(address) {
            setDeleteLoading(true)
            const a = await deletePlayer({walletAddress: address})
            setDeleteLoading(false)
            if(a && a.success) {
                setConfirmOpen(false)
                setMyAgentOpen(false)

                dispatch(alertInfoAction({
                    open: true,
                    title: 'Successful',
                    content: 'Agent has been deleted.'
                }))
            }
        }
    }


    return (
        <Box>
            <GeneralButton 
                onClick={handleAgent}
                title={AGENT_CREATED ? 'My Agent' : 'Create Agent'}
                size='sm'
                loading={btnLoading}
            />

            <BasePopup
                visible={createOpen}
                onClose={handleCreateClose}
                title="Create Agent"
                content={
                    <Box mt="30px">
                        <CreateInput 
                            title='Name'
                            maxLen={name.maxLen}
                            currentLen={name.value.length}
                        >
                            <input value={name.value} placeholder={`your agent's name – can be anything`} className="agent_input" onChange={onChangeName}/>
                        </CreateInput>    
                        <CreateInput title="Prompt"  maxLen={prompt.maxLen} currentLen={prompt.value.length}>
                            <textarea 
                                className="agent_textarea" 
                                placeholder={`Describe your agent`} 
                                value={prompt.value} style={{ minHeight: '100px', }}  
                                onChange={onChangePrompt}/>
                        </CreateInput>
                    </Box>
                }
                onOK={onCreateAgent}
               
                okText={`Create Agent For ${CREATE_AGENT_FEE} $STPT`}
            >
            </BasePopup>

            <BasePopup
                visible={myAgentOpen}
                onClose={() => setMyAgentOpen(false)}
                title="My Agent"
                content={
                    <Box mt="30px">
                        <Box className='fx-row ai-ct'>
                            <Image src={Logo} w="80px" h="80px"  borderRadius="50%"/>
                            <Box ml="24px">
                                <Text className='fz24 gray fw700'>Name</Text>
                                <Text className='fz24 gray' mt="10px">{myAgentInfo.name}</Text>
                            </Box>
                        </Box>

                        <Text className='fz24 gray fw700' mt="70px">Description</Text>
                        <Box className='center box_clip' p="24px 28px" mt="10px" w="553px" h="116px" bgColor="#838B8D">                        
                            <Text className='gray2 fz400'>{myAgentInfo.description}</Text>
                        </Box>
                    </Box>
                }
                onOK={() => {
                    setMyAgentOpen(false)
                    setConfirmOpen(true)
                }}
                okText="Delete Agent"
            >
            </BasePopup>

            <BasePopup
                visible={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Delete"
                content={
                    <Box className='h100 fx-col ai-ct'>
                        <Text className='gray fz20' mt="200px" maxW="376px" textAlign="center">
                            Are you sure you want to delete this agent? 
                            <br/>
                            This action cannot be undone.
                        </Text>
                        <Box className='fx-row ai-ct w100' mt="192px">
                            <GeneralButton 
                                size='sm' 
                                loading={deleteLoading} 
                                title="Ok" 
                                onClick={deleteAgent} 
                            />
                            <GeneralButton 
                                style={{ marginLeft: '40px' }}
                                size='sm' 
                                title="Cancel" 
                                onClick={() => setConfirmOpen(false)} 
                            />
                        </Box>
                    </Box>
                }
            >
            </BasePopup>


        </Box>
    )
}