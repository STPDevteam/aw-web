import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Box, Image, Text  } from '@chakra-ui/react'
import { Close } from '@/images'
import { useEffect, useMemo, useState} from 'react';
import { formatYYYYMMDDHHMMSS } from '@/utils/tool';
import { SwitchTab } from "@/components"

interface iFEPlayerDetails {
    feAgendId: number
    width: number
}
export const FEPlayerDetails:React.FC<iFEPlayerDetails> = ({
    feAgendId,
    width
}) => {
    const [selectedIdx, setSelectedIdx] = useState(0)
    const feChatList = useQuery(api.frontendAgent.getFrontendAgentById,{ id: feAgendId })
    const descriptionFun = (d: string | React.ReactNode) => (
        <Box 
            className='box_clip center  ' 
            px="20px" 
            py="25px" 
            bgColor='#838B8D' 
            mt="10px">
          <Text className='gray4 gradient_content' fontSize={['14px','14px','14px','14px','14px','16px']}>{d}</Text>
        </Box>
    ) 
      

    return (
        <Box className='' w="100%" px={['12px','12px','12px','12px','24px','36px']}>
            {
                feChatList &&
                <Box className=''>
                    <Box className='  fx-row ai-ct jc-sb' mt="24px">     
                        
                        <Box className="center gradient_border " w="100%" h="46px">
                            <Text className="fw700 fz24 gray gradient_content">{feChatList.name}</Text>
                        </Box>
                        <Image ml={['24px','24px','24px','24px','36px','54px']} src={Close} w="34px" h="34px" className='click' onClick={() => localStorage.removeItem('agentId')}/>
                    </Box>
                    { descriptionFun(feChatList.description)}
                    <SwitchTab onChange={i => setSelectedIdx(i)}/>
                    {
                        selectedIdx === 0 ? <>
                            {
                                feChatList.conversation.map((item:any) => (
                                <Box key={item.timestamp} className='fx-col' mt="10px">
                                    <Box className='fx-row ai-ct jc-sb'>
                                        <Text color="#E0E0E0" fontWeight={600} fontSize={['14px','14px','14px','14px','14px','16px']}>{item.role}</Text>
                                        <Text color="#838B8D" fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>{formatYYYYMMDDHHMMSS(item.timestamp) }</Text>
                                    </Box>
                                    { descriptionFun(item.content)}
                                </Box>
                                ))
                            }
                        </>:
                        <>
                            { descriptionFun('6:30 to 7:30 - Morning yoga')}
                        </>
                    }
                </Box>
            }
        </Box>
    )
}
