
import type { FC } from "react"
import React from "react"
import { Box, Text, Image } from "@chakra-ui/react"

interface iCreateInput {
    title?: string
    children: React.ReactNode
    maxLen: number
    currentLen: number
}
export const CreateInput:FC<iCreateInput> = ({
    title,
    children,
    maxLen,
    currentLen
}) => {
    return (
        <Box className=" fx-col ai-start"> 
            {
                title ?
                <Box className="fx-row ai-ct">
                    <Text className="gray "  fontWeight={600} fontSize={['16px','16px','16px','16px','18px','20px']}>{title}</Text>
                </Box>
                : <Box h="60px"/>
            }
            { children }
            <Box className="fx-row ai-ct jc-sb w100">
                <Box />
                <Box  >
                    {/* { currentLen > maxLen && <span className="fz12 red mr10">{maxLen} characters max</span>} */}
                    <span className="fz16" style={{ color: currentLen < maxLen ? '#838B8D' : (currentLen === maxLen ? '#fff' : 'red') }}>{currentLen}</span>
                    <span className="fz16 gray1">/{maxLen}</span>
                </Box>
            </Box>
        </Box>
    )
}