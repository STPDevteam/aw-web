import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text  } from '@chakra-ui/react'


interface iSwitchTab {
 onChange:( i: number) => void
}
export const SwitchTab:React.FC<iSwitchTab> = ({
    onChange
}) => {
   
    const [selectedIdx, setSelectedIdx] = useState(0)

    useEffect(() => {
        onChange(selectedIdx)
    },[selectedIdx])

    return (
        <Box mt="20px"  className='w100 center'> 
            <Box className='fm2 fx-row ai-ct jc-sb' w="100%" maxW="280px">
                <Box 
                    borderTopLeftRadius="20px"
                    borderBottomLeftRadius="20px"
                    className={`click center `} 
                    bgColor={ selectedIdx === 0 ? '#B7EADF' : '#fff' } w="100%" h="30px" onClick={() => setSelectedIdx(0)}>
                    <Text textAlign="center" fontWeight={350} color={selectedIdx === 0 ? '#050609' : '#535C5F'} fontSize={['14px']}>Conversation</Text>
                </Box>
                <Box 
                    className={`click center `}  
                    borderTopRightRadius="20px"
                    borderBottomRightRadius="20px"
                    bgColor={ selectedIdx === 1 ? '#B7EADF' : '#fff' } w="100%" h="30px" onClick={() => setSelectedIdx(1)}>
                    <Text fontWeight={350}  color={selectedIdx === 1 ? '#050609' : '#535C5F'} fontSize={['14px',]}>Status</Text>
                </Box>          
            </Box>
        </Box>
    )
}
