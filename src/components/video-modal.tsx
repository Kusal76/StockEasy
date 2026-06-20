"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface VideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoUrl: string;
}

export function VideoModal({ isOpen, onClose, videoUrl }: VideoModalProps) {
    // Prevent scrolling on the main page when the modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#051424]/90 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-300">

            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(80,200,120,0.15)] border border-[#3e4a3f]/50 animate-in zoom-in-95 duration-300 z-10">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-primary text-white hover:text-[#051424] rounded-full transition-colors backdrop-blur-sm cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Video Player */}
                <video
                    controls
                    autoPlay
                    className="w-full h-full object-cover"
                >
                    <source src={videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
}