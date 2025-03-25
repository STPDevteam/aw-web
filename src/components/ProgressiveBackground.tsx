import React, { useState } from "react";
import { Box, Image } from "@chakra-ui/react";

interface ProgressiveBackgroundProps {
  src: string;
  alt?: string;
  blurAmount?: number;         // 模糊程度，单位 px，默认 20px
  transitionDuration?: string; // 过渡时间，默认 "0.5s"
  children?: React.ReactNode;
  // 其他 Box 属性可以通过 ...rest 传入
  [key: string]: any;
}

export const ProgressiveBackground: React.FC<ProgressiveBackgroundProps> = ({
  src,
  alt = "background",
  blurAmount = 20,
  transitionDuration = "0.5s",
  children,
  ...rest
}) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <Box
      bgSize="cover"
      bgPosition="center"
      bgRepeat="no-repeat"
      bgImage={loaded ? `url(${src})` : undefined}
      transition={`filter ${transitionDuration} ease-out`}
      filter={loaded ? "none" : `blur(${blurAmount}px)`}
      position="relative"
      {...rest}
    >
      <Image
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        display="none"
      />
      {children}
    </Box>
  );
};

