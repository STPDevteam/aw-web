
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
        <Box mt="30px" className=" fx-col ai-start"> 
            {
                title ?
                <Box className="fx-row ai-ct">
                    <Text className="fz24 gray fw700" >{title}</Text>
                </Box>
                : <Box h="50px"/>
            }
            { children }
            <Box className="fx-row ai-ct jc-sb w100">
                <Box />
                <Box  >
                    {/* { currentLen > maxLen && <span className="fz12 red mr10">{maxLen} characters max</span>} */}
                    <span className="fz20" style={{ color: currentLen < maxLen ? '#838B8D' : (currentLen === maxLen ? '#fff' : 'red') }}>{currentLen}</span>
                    <span className="fz20 gray1">/{maxLen}</span>
                </Box>
            </Box>
        </Box>
    )
}