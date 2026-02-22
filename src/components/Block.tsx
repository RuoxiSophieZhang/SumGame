import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Block } from '../types';
import { COLORS } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BlockProps {
  block: Block;
  isSelected: boolean;
  isHinted?: boolean;
  onClick: (id: string) => void;
}

const BLOCK_STYLES: Record<number, { bg: string, text: string, border: string }> = {
  1: { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' }, // Sky Blue
  2: { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' }, // Green
  3: { bg: '#FEF9C3', text: '#A16207', border: '#FEF08A' }, // Yellow
  4: { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' }, // Red
  5: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' }, // Indigo
  6: { bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' }, // Cyan
  7: { bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' }, // Orange
  8: { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' }, // Purple
  9: { bg: '#F0FDF4', text: '#166534', border: '#DCFCE7' }, // Emerald
};

export const BlockComponent: React.FC<BlockProps> = ({ block, isSelected, isHinted, onClick }) => {
  const style = BLOCK_STYLES[block.value] || BLOCK_STYLES[1];

  return (
    <div
      onClick={() => onClick(block.id)}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: isSelected ? '#6366f1' : (isHinted ? '#F59E0B' : style.border),
        borderWidth: isHinted ? '3px' : '1px',
        transform: isSelected ? 'scale(0.85)' : 'scale(1)',
      }}
      className={cn(
        "flex items-center justify-center w-full h-full rounded-lg cursor-pointer transition-all duration-200 select-none relative",
        isSelected ? "ring-2 ring-indigo-500 ring-offset-1 z-10 shadow-md" : "shadow-sm hover:shadow-md",
        isHinted && "animate-pulse ring-4 ring-amber-400 z-20",
        "font-display text-base md:text-lg font-bold"
      )}
    >
      <span className="relative z-20 leading-none">{block.value}</span>
      
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center text-[8px] text-white border border-white z-30">
          ✓
        </div>
      )}
    </div>
  );
};
