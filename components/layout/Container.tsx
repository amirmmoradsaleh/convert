import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Container({ children, className = '', id }: ContainerProps) {
  return (
    <div
      id={id}
      className={`w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}

export default Container;
