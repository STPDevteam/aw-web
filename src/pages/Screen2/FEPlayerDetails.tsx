
import { Box, Image, Text  } from '@chakra-ui/react'
import { Close } from '@/images'
import { useEffect, useMemo, useState} from 'react';
import { formatYYYYMMDDHHMMSS } from '@/utils/tool';
import { SwitchTab} from "@/components"

interface iFEPlayerDetails {
    currentFEAgent: any
    onClearFEAgent: () => void
}
export const FEPlayerDetails:React.FC<iFEPlayerDetails> = ({
    currentFEAgent,
    onClearFEAgent
   
}) => {
    // console.log('currentFEAgent', currentFEAgent)
    const [selectedIdx, setSelectedIdx] = useState(0)
    const descriptionFun = (d: string | React.ReactNode) => (
        <Box 
            className='box_clip ' 
            px="20px" 
            py="25px" 
            bgColor='#838B8D' 
            mt="10px">
          <Text className='gradient_content' fontWeight={400} color="#101010" fontSize={['14px','14px','14px','14px','14px','16px']}>{d}</Text>
        </Box>
    ) 
      

   
    return (
        <Box className='w100' >
            {
                currentFEAgent &&
                <Box className=''>
                    <Box className='  fx-row ai-ct jc-sb' >     
                        
                        <Box className="center gradient_border " w="100%" h="46px">
                            <Text className="gradient_content" color="#E0E0E0" fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>{currentFEAgent.name}</Text>
                        </Box>
                        <Image 
                            ml={['24px','24px','24px','24px','36px','54px']} 
                            src={Close} w="34px" h="34px" 
                            className='click' 
                            onClick={onClearFEAgent}
                        />
                    </Box>
                    { descriptionFun(currentFEAgent.description)}
                    <SwitchTab onChange={i => setSelectedIdx(i)}/>
                    {
                        selectedIdx === 0 ? <>
                            {
                                currentFEAgent.conversation.map((item:any) => (
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
                        <Box>
                            <Box 
                                className='box_clip center  ' 
                                p="20px" 
                                bgColor='#838B8D' 
                                mt="10px">
                                    <Box className='fx-row ai-ct jc-sb' flexWrap="wrap">
                                            {
                                                currentFEAgent.status.map((item:any) => (
                                                    <Text 
                                                        w="50%"
                                                        key={item.title} 
                                                        color="#293033"
                                                        fontSize={['14px','14px','14px','14px','14px','16px']}>
                                                        {item.title}<span>:{item.icon}</span>
                                                    </Text>

                                                ))
                                            }
                                    </Box>
                            </Box>                            

                            {
                                currentFEAgent.events.map((item:any) => (
                                    <Box 
                                        key={item.action} 
                                        className='box_clip fx-row ai-ct jc-sb' 
                                        py="20px" 
                                        px="20px" 
                                        whiteSpace="nowrap"
                                        bgColor='#838B8D' 
                                        mt="10px"
                                        color="#293033"
                                        fontSize={['14px','14px','14px','14px','14px','16px']}
                                    >
                                        <Text >{`${item.time}-${item.action}`}</Text>
                                        <Text>{item.details}</Text>    
                                </Box>

                                ))
                            }
                        </Box>
                    }
                 
                </Box>
            }
        </Box>
    )
}
