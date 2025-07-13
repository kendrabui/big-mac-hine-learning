import React from 'react';
import type { PromotionCampaign } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface PromotionPanelProps {
  campaign: PromotionCampaign;
  imageUrl: string | null;
  onApprove: () => void;
  onReject: () => void;
}

export const PromotionPanel: React.FC<PromotionPanelProps> = ({ campaign, imageUrl, onApprove, onReject }) => {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-orange-900/50 rounded-xl p-6 shadow-md border border-orange-500">
        <h3 className="text-lg font-bold text-orange-300 mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Overstock Alert & Promotion Plan
        </h3>
        <p className="text-orange-300/90 leading-relaxed whitespace-pre-wrap">{campaign.reasoning}</p>
        <div className="mt-4 text-sm">
            <p className="text-gray-300"><span className="font-bold text-white">Recommendation:</span> {campaign.recommendedPromotion}</p>
            <p className="text-gray-300"><span className="font-bold text-white">Potential Spoilage Impact:</span> <span className="text-red-400 font-semibold">{campaign.financialImpact} HKD</span></p>
        </div>
      </div>
      
      <div className="bg-gray-800/80 rounded-xl shadow-md border border-gray-700 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="relative aspect-square md:aspect-auto">
                {imageUrl ? (
                    <>
                        <img 
                            src={`data:image/jpeg;base64,${imageUrl}`} 
                            alt={campaign.productName} 
                            className="absolute inset-0 w-full h-full object-cover" 
                        />
                        <a
                            href={`data:image/jpeg;base64,${imageUrl}`}
                            download={`promotion-${campaign.productName.replace(/\s+/g, '-')}.jpeg`}
                            className="absolute top-4 right-4 bg-black/60 p-2 rounded-full text-white hover:bg-black/80 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
                            aria-label="Download promotional image"
                        >
                            <DownloadIcon className="h-6 w-6" />
                        </a>
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900 min-h-[300px]">
                        <p className="text-gray-500">Generating image...</p>
                    </div>
                )}
            </div>
            <div className="flex flex-col justify-center p-8 bg-gray-800 text-center md:text-left">
                <h4 className="text-3xl font-extrabold text-white tracking-tight uppercase sm:text-4xl">{campaign.productName}</h4>
                <p className="mt-2 text-4xl font-bold sm:text-5xl" style={{color: '#FFC72C'}}>{campaign.promotionName}</p>
                <p className="mt-6 text-xs text-gray-400">*Limited time only. While supplies last. Cannot be combined with other offers.</p>
            </div>
        </div>
      </div>

       <div className="mt-2 pt-4 border-t border-gray-700 flex justify-end gap-4">
            <button onClick={onReject} className="flex items-center gap-2 bg-red-600/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors">
                <XIcon />
                Reject Promotion
            </button>
            <button onClick={onApprove} className="flex items-center gap-2 bg-green-600/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors">
                <CheckIcon />
                Approve & Send to POS
            </button>
        </div>
    </div>
  );
};
