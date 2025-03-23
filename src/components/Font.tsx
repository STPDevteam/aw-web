
import React, { FC } from 'react'
import { Text } from '@chakra-ui/react'

export const Font16:FC<{ t: string | React.ReactNode}> = ({t}) => {
    return (
        <Text color="#E0E0E0" fontWeight={350} fontSize={['14px','14px','14px','14px','14px','16px']}>{t}</Text>
    )
}