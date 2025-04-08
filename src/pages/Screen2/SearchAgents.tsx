import React, { useState } from 'react'
import {  Box, Text, Image } from '@chakra-ui/react'
import { Search } from '@/images'

export const SearchAgents = () => {  
    
    const [keyword, setKeyword] = useState<string>('')

    const onChange = (e:any) => {
        const v = e.target.value
        setKeyword(v)
    }

    return(
        <Box>
            <Box h="64px" className='w100 fx-row ai-ct'>
                <Image src={Search} h='20px' w='20px'/>
                <input value={keyword} onChange={onChange}/>
            </Box>
        </Box> 
    )
}

export const Item = () => {
    return( 
        <Box className='fx-row ai-ct jc-sb' h="100px" w="386px" borderRadius="10px" bgColor='rgba(255, 255, 255, 0.5)'  backdropBlur={80}>
            <Box>
                <Image src={Search} w="68px" h="68px"/>
                <Box className='fx-col' ml="15px">
                    <Text className='' fontSize='20px' color='#000' fontWeight={700}>Matthew</Text>
                    <Text fontSize="14px" color='rgba(83, 92, 95, 1)'>Inferences</Text>
                    <Text fontSize='14px' color='#000' fontWeight={700}>Matthew</Text>
                </Box>
            </Box>
            <Box bgColor='white' w='1px' h='33px' mx='26px'/>
            <Box>
                <Text fontSize="14px" color='rgba(83, 92, 95, 1)'>Inferences</Text>
                <Box>
                    
                </Box>
            </Box>
            
        </Box>
    )
}
