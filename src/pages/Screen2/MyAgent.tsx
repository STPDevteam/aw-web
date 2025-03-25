
import React, {  useState, useEffect } from 'react'
import { Text, Box, Image } from '@chakra-ui/react'
import { GeneralButton, BasePopup, CreateInput, Font16, BorderButton } from '@/components'
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api.js'
import { useAppDispatch, useAppSelector } from '@/redux/hooks.js';
import { alertInfoAction, myAgentPopupVisibleAction, openConnectWalletAction, openCreateAction, selectMyAgentPopupVisible, selectOpenCreate } from '@/redux/reducer/agentReducer.js';
import { RANDOM_ENCOUNTER_FEE, CREATE_AGENT_FEE, CREATE_ADDRESS_ADDRESS, STPT_ADDRESS } from '@/config'
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

interface iMyAgent {
    worldId: any
    // createAgentOpen: boolean
    // closeCreate: () => void
    // myAgentOpen: boolean
    // closeMy: () => void
    // confirmDeleteOpen: boolean
    // closeConfirmDelete: (v: boolean) => void
    createdPlayers: any 
    // createAutoOpen:() => void



}
export const MyAgent:React.FC<iMyAgent> = ({ 
    worldId, 
    // createAgentOpen, 
    // closeCreate, 
    // myAgentOpen,
    // closeMy,
    // confirmDeleteOpen,
    // closeConfirmDelete
    // createAutoOpen,
    createdPlayers,
  

}) => {

    const { address, isConnected } = useAccount()
    
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false)
    const [btnLoading, setBtnLoading] = useState(false)
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
    

    const createPlayer = useMutation(api.player.createPlayer)
    const deletePlayer = useMutation(api.player.deletePlayer)

    const AGENT_CREATED = createdPlayers && !!createdPlayers.players.length

    const { data: hash, writeContract, isPending, error } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({hash})





    
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
    const myAgentPopupVisible = useAppSelector(selectMyAgentPopupVisible)  
    const dispatch = useAppDispatch()



    useEffect(() => {
        openCreate && dispatch(myAgentPopupVisibleAction({...myAgentPopupVisible, createOpen: true}))
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
            dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, createOpen: false }))
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
                    // args: [CREATE_ADDRESS_ADDRESS, parseUnits(`0.2`, 18)],
                    args: [CREATE_ADDRESS_ADDRESS, parseUnits(`${CREATE_AGENT_FEE}`, 18)],
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
        dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, createOpen: false }))

    }

    const deleteAgent = async() => {
        if(address) {
            setDeleteLoading(true)
            const a = await deletePlayer({walletAddress: address})
            setDeleteLoading(false)
            if(a && a.success) {
                dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, myOpen: false, confirmOpen: false }))


                dispatch(alertInfoAction({
                    open: true,
                    title: 'Successful',
                    content: 'Agent has been deleted.'
                }))
            }
        }
    }


     const handleAgent = () => {
        if(isConnected && address) {
            if(AGENT_CREATED) {    
                dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, myOpen: true }))
            }else {
                dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, createOpen: true }))
            }
        }else {
            dispatch(openConnectWalletAction(true))
        }
    }


    const handleCreateClose = () => {
        closeCreateModal()
        dispatch(alertInfoAction({
            open: true,
            title: 'Warning',
            content: 'Cancelled'
        }))
       
        dispatch(openCreateAction(false))
    }



    return (
        <Box>
             <BorderButton
                disable={AGENT_CREATED}
                loading={btnLoading} 
                w={180}
                h={46}
                onClick={handleAgent}
                title={'Create Agent'}
                tooltip = {AGENT_CREATED ? {
                    label: 'Already created',
                    size: 'sm'
                }: undefined}

            /> 
            <BasePopup
                visible={myAgentPopupVisible.createOpen} 
                onClose={handleCreateClose}
                title="Create Agent"
                content={
                    <Box p="40px">
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
                visible={myAgentPopupVisible.myOpen} // 
                onClose={() => dispatch(myAgentPopupVisibleAction({...myAgentPopupVisible, myOpen: false }))}
                title="My Agent"
                
                content={
                    <Box p="40px">
                        <Box className='fx-row ai-ct'>
                            <Image src={Logo} w={['60px','60px','60px','70px','80px','90px']} h={['60px','60px','60px','70px','80px','90px']} borderRadius="50%"/>
                            <Box ml="15px">
                                <Text className='gray fm2' fontWeight={600} fontSize={['16px','16px','16px','16px','18px','20px']}>Name</Text>
                                <Text className='fm3' mt="10px" color='#838B8D'  fontWeight={400} fontSize={['16px','16px','16px','16px','18px','20px']}>{myAgentInfo.name}</Text>
                            </Box>
                        </Box>

                        <Text className='fm2 gray'  fontWeight={600}  fontSize={['16px','16px','16px','16px','18px','20px']} mt="30px">Description</Text>
                        <Box className='center box_clip fm3' p="20px" mt="10px" w="515pxpx" bgColor="#838B8D">                        
                            <Font16 c="#293033" t={myAgentInfo.description}/>
                        </Box>
                    </Box>
                }
                onOK={() => {
                    dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, myOpen: false, confirmOpen: true }))
             
                }}
                okText="Delete Agent"
            >
            </BasePopup>

            <BasePopup
                visible={myAgentPopupVisible.confirmOpen}  // 
                onClose={() =>  dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, confirmOpen: false }))  }
                title="Delete"
                content={
                    <Box className='h100 fx-col ai-ct'>
                        <Box className=' w100 center ' h="calc(100% - 20px)">
                            <Text className='gray fm3' whiteSpace='nowrap' maxW="400px" fontSize={['16px','16px','16px','16px','18px','20px']}>
                                <p>Are you sure you want to delete this agent?</p> 
                                <p>This action cannot be undone.</p>
                                
                            </Text>
                        </Box>
                        <Box className='fx-row ai-ct w100 jc-sb' pos='absolute' bottom='20px' px="82px">
                        
                            <Box w="180px" h="46px" >
                                <BorderButton
                                    isFixedWidth={true}
                                    loading={deleteLoading} 
                                    w={180}
                                    h={46}
                                    onClick={deleteAgent}
                                    title='Ok'
                                /> 
                            </Box>
                            <Box w="180px" h="46px" className=''>
                                <BorderButton
                                    isFixedWidth={true}
                                    w={180}
                                    h={46}
                                    onClick={() => dispatch(myAgentPopupVisibleAction({ ...myAgentPopupVisible, confirmOpen: false })) }
                                    title='Cancel'
                                /> 
                            </Box>                           
                        </Box>
                    </Box>
                }
            >
            </BasePopup>
        </Box>
    )
}