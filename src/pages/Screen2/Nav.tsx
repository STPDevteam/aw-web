


import React, { FC, useState, useEffect } from 'react'
import { Text, Link, Box, Image } from '@chakra-ui/react'
import { Screen2Bg } from '@/images'
import { GeneralButton, Notification, BasePopup, CreateInput } from '@/components'
import { ConnectWallet } from './ConnectWallet'
import { useAppSelector } from '@/redux/hooks'
import { selectedAgentInfo } from '@/redux/reducer'


interface iInput {
    value: string
    maxLen: number
    msg: string
    disable: boolean
}

export const Nav = () => {

    const [claimOpen, setClaimOpen] = useState<boolean>(false)
    const [createAgentOpen, setCreateAgentOpen] = useState<boolean>(false)
    const [myAgentOpen, setMyAgentOpen] = useState<boolean>(false)
    const [randomOpen, setRandomOpen] = useState<boolean>(false)

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


    // const agentInfo = useAppSelector(selectedAgentInfo)
  
    // console.log('222222222222222222222', agentInfo)

    const onClaim = () => {
        setClaimOpen(true)
    }
  
    const onCreateAgent = () => {
        setCreateAgentOpen(false)
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
    const deleteAgent = () => {
        setMyAgentOpen(false)
    }
    
    const onRandom = () => {
        setRandomOpen(true)
    }
    return(
        <Box>
            <Box className='fx-row ai-ct jc-sb w-100'>
                <Box className='fx-row ai-ct jc-sb'>
                    <GeneralButton 
                        onClick={onClaim}
                        title='Claim'
                        size='sm'
                    />
                    <GeneralButton 
                        onClick={() => setCreateAgentOpen(true)}
                        title='Create agent'
                        size='sm'
                    />
                    <GeneralButton 
                        onClick={onRandom}
                        title='Random encounter (1 $STPT)'
                        size="lg"
                    />
                </Box>               
                <ConnectWallet/>    
            </Box>      

            
            <Notification
                visible={claimOpen}
                onClose={() => setClaimOpen(false)}
                title="Claim"
                content="Claimed! World points +10"
            />
            <BasePopup
                visible={createAgentOpen}
                onClose={() => setCreateAgentOpen(false)}
                title="Create agent"
                content={
                    <Box mt="30px">
                        <CreateInput 
                            title="Name"
                            maxLen={name.maxLen}
                            currentLen={name.value.length}
                        >
                            <input value={name.value} placeholder={`your agent's name – can be anything`} className="agent_input" onChange={onChangeName}/>
                        </CreateInput>    
                        <CreateInput title="prompt"  maxLen={prompt.maxLen} currentLen={prompt.value.length}>
                            <textarea 
                                className="agent_textarea" 
                                placeholder={`Describe your agent`} 
                                value={prompt.value} style={{ minHeight: '100px', }}  
                                onChange={onChangePrompt}/>
                        </CreateInput>
                    </Box>
                }
                onOK={onCreateAgent}
                okText="Create agent for 10 $STPT"
            >
            </BasePopup>

            <BasePopup
                visible={myAgentOpen}
                onClose={() => setMyAgentOpen(false)}
                title="My agent"
                content={
                    <Box mt="30px">
                        <Box className='fx-row ai-ct'>
                            <Box  w="80px" h="80px" bgColor='white' borderRadius="50%"/>
                            <Box ml="24px">
                                <Text className='fz24 gray fw700'>Name</Text>
                                <Text className='fz24 gray' mt="10px">123</Text>
                            </Box>
                        </Box>

                        <Text className='fz24 gray fw700' mt="70px">Name</Text>
                        <Box className='center box_clip' p="24px 28px" mt="10px" w="553px" h="116px" bgColor="#838B8D">                        
                            <Text className='gray2 fz400'>Luna, 28 - collects antique joke books and speaks fluent sarcasm. Secretly trains squirrels to high-five, believes coffee is a personality trait.</Text>
                        </Box>
                    </Box>
                }
                onOK={deleteAgent}
                okText="Delete agent"
            >
            </BasePopup>
            <BasePopup
                visible={randomOpen}
                onClose={() => setRandomOpen(false)}
                title="Name"
                content={
                    <Box mt="30px" overflowY="scroll" maxH="432px">
                        
                        {
                            [1,2,3,4,5].map(item => (
                                <Box key={item} className='' mt="20px">
                                    <Text className='fz24 gray fw700'>Name</Text>
                                    <Box  className='center box_clip' p="24px 28px" mt="10px" w="553px" h="116px" bgColor="#838B8D">                        
                                        <Text className='gray2 fz400'>Luna, 28 - collects antique joke books and speaks fluent sarcasm. Secretly trains squirrels to high-five, believes coffee is a personality trait.</Text>
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
