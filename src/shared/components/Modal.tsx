"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY, 10) * -1);
      }
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-none md:flex md:items-start md:justify-center md:py-8"
    >
      <div className="bg-white shadow-xl w-full relative min-h-screen overscroll-none md:min-h-0 md:rounded-lg md:max-w-5xl md:mx-4">
        <button
          onClick={onClose}
          className="sticky top-0 float-right z-10 mt-3 mr-3 text-gray-400 hover:text-gray-600 text-xl leading-none w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          x
        </button>
        <div className="p-4 pt-2 md:p-6 clear-both">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
