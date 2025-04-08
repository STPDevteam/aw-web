import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { PageLoading } from './PageLoading';
import {  Box,  Text, Image, Button} from '@chakra-ui/react'

export const LoadingPortal = () => {
  const loadingRoot = document.getElementById('initial-loading');
  const [progress, setProgress] = useState<number>(0);

  const h = 0.351595 * window.innerWidth > 661 ? 661 : 0.351595 * window.innerWidth

  const _leftWidth = h / 0.56933 

  const welcomeText = () => (
    <Box  className='fx-col ai-ct' maxW="700px" >
      <Text fontWeight={400}  color='#838B8D'  className='fm3'  fontSize={['20px','20px','20px','24px','28px','32px']}>
        Welcome to AI Town
        </Text>
        <Text
          my={['30px','30px','30px','42px','48px','60px']}
          fontWeight={350} 
          fontSize={['14px','14px','14px','14px','14px','16px']}
          className='fm3'
          color='#838B8D'
        >
          <p>
            <span>Introducing the first-ever live demo of 1,000 AI agents running in real-time – our tribute to </span>
            <a className='gray click underline' href='https://github.com/joonspk-research/generative_agents' target='_blank'>Stanford Smallville</a> 
            <span> and </span>
            <a className='gray click underline' href='https://github.com/a16z-infra/ai-town'  target='_blank'>a16z AI Town</a>.
          </p>
          <p style={{ marginTop: '15px' }}>
            <span>Built in collaboration with our core AI contributor </span>
            <a className='gray click underline'  href='https://zhiqiangxie.com/'  target='_blank'>Zhiqiang Xie</a>
            <span> from Stanford University, this simulation brings his </span>
            <a className='gray click underline'  href='https://arxiv.org/abs/2411.03519'  target='_blank'>AI Metropolis</a>
            <span> paper to life, enabling massively multi-agent simulations while drastically reducing compute and inferencing costs.</span>

          </p>
          <p  style={{ marginTop: '15px' }}>
            <span>This is just the beginning – World.Fun is your launchpad to the Autonomous World era.</span>
          </p>
        </Text>
    </Box>
  )

  useEffect(() => {
    if (progress === 1 && loadingRoot) {
      loadingRoot.style.display = 'none';
    }
  }, [progress, loadingRoot]);

  return loadingRoot
    ? ReactDOM.createPortal(     
      <Box className='center w100 fx-col ai-ct' bgColor="#000" h="100vh">
        { welcomeText() }
        <PageLoading maxW={_leftWidth} onCompleted={p => setProgress(p)} />       
      </Box> as any,
        loadingRoot
      )
    : null;
};


