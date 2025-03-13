import React from "react"
import { motion } from "framer-motion"

interface ClickButtonWrapperProps {
  onClick: () => void;
  disable?: boolean;
  clickableDisabled?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const ClickButtonWrapper: React.FC<ClickButtonWrapperProps> = ({
  onClick,
  disable = false,
  children,
  className,
  style,
  clickableDisabled
}) => {
  return (
    <motion.div
      style={{
        cursor: disable ? "not-allowed" : "pointer",
        ...style,
      }}
      onClick={clickableDisabled ? onClick : (disable ? undefined : onClick) }
    >
      {children}
    </motion.div>
  );
};
