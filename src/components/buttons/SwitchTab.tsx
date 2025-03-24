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
        <Box gap={['4px','4px','4px','4px','8px','10px']} mt="20px" className='fm2 fx-row ai-ct jc-sb' w="100%" >
             <Box className={`click center gradient_left_border ${selectedIdx === 0 ? 'selected' : '' }`} w="100%" h="46px" onClick={() => setSelectedIdx(0)}>
                <Text textAlign="center" fontWeight={350} color={selectedIdx === 0 ? '#293033' : '#E0E0E0'} className="gradient_left_content" fontSize={['14px','14px','14px','14px','14px','16px']}>Conversation</Text>
            </Box>
             <Box className={`click center gradient_right_border ${selectedIdx === 1 ? 'selected' : ''}`} w="100%" h="46px" onClick={() => setSelectedIdx(1)}>
                <Text fontWeight={350}  color={selectedIdx === 1 ? '#293033' : '#E0E0E0'} className="  gradient_right_content" fontSize={['14px','14px','14px','14px','14px','16px']}>Status</Text>
            </Box>          
        </Box>
    )
}
