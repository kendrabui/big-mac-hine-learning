
import React from 'react';
import { XIcon } from './icons/XIcon';

interface SideMenuProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export const SideMenu: React.FC<SideMenuProps> = ({ isOpen, onClose, children }) => {
    return (
        <>
            {/* Backdrop Overlay */}
            <div
                className={`fixed inset-0 bg-black/60 z-20 transition-opacity duration-300 ease-in-out ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
                aria-hidden="true"
            ></div>

            {/* Side Panel */}
            <div
                className={`fixed top-0 left-0 h-full w-full max-w-md bg-gray-900 text-gray-100 shadow-xl z-30 transform transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="menu-title"
            >
                <div className="absolute top-0 right-0 pt-4 pr-4">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Close menu"
                    >
                        <XIcon />
                    </button>
                </div>
                <div className="py-6 px-4 sm:px-6 overflow-y-auto h-full">
                    {children}
                </div>
            </div>
        </>
    );
};
