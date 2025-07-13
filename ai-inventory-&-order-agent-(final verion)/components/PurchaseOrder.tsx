
import React from 'react';
import type { PurchaseOrderItem, AppStatus } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';

interface PurchaseOrderProps {
  items: PurchaseOrderItem[];
  status: AppStatus;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onAddItem: () => void;
  onUpdateDetails: (itemId: string, field: 'name' | 'unit', value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

const POItemRow: React.FC<{
  item: PurchaseOrderItem,
  onUpdateQuantity: (id: string, q: number) => void,
  onRemoveItem: (id: string) => void,
  onUpdateDetails: (id: string, field: 'name' | 'unit', value: string) => void,
  isEditable: boolean
}> = ({ item, onUpdateQuantity, onRemoveItem, onUpdateDetails, isEditable }) => (
    <div className="grid grid-cols-12 gap-2 items-center p-2 rounded-md hover:bg-gray-700/50 transition-colors">
        <div className="col-span-4">
          {isEditable && item.id.startsWith('custom-') ? (
             <input type="text" value={item.name} onChange={(e) => onUpdateDetails(item.id, 'name', e.target.value)} className="w-full bg-gray-600 rounded p-1 border border-gray-500 focus:ring-cyan-500 focus:border-cyan-500"/>
          ) : (
            <span className="text-gray-300">{item.name}</span>
          )}
        </div>
        <div className="col-span-2">
          {isEditable && item.id.startsWith('custom-') ? (
             <input type="text" value={item.unit} onChange={(e) => onUpdateDetails(item.id, 'unit', e.target.value)} className="w-full bg-gray-600 rounded p-1 border border-gray-500 focus:ring-cyan-500 focus:border-cyan-500"/>
          ) : (
             <span className="text-gray-400 text-sm">{item.unit}</span>
          )}
        </div>
        <div className="col-span-4 flex items-center justify-center">
            {isEditable && (
                <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white"><MinusIcon /></button>
            )}
            <input 
                type="number" 
                value={item.quantity} 
                onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value, 10) || 0)} 
                className="w-16 mx-2 text-center bg-gray-600 border border-gray-500 rounded-md p-1 focus:ring-cyan-500 focus:border-cyan-500"
                readOnly={!isEditable}
            />
            {isEditable && (
                <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="p-1 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white"><PlusIcon /></button>
            )}
        </div>
        <div className="col-span-2 flex justify-end">
            {isEditable && (
                <button onClick={() => onRemoveItem(item.id)} className="p-1 rounded-full text-red-400 hover:bg-red-900/50 hover:text-red-300"><TrashIcon /></button>
            )}
        </div>
    </div>
);


export const PurchaseOrder: React.FC<PurchaseOrderProps> = ({ items, status, onUpdateQuantity, onRemoveItem, onAddItem, onUpdateDetails, onApprove, onReject }) => {
  const isEditable = status === 'generated';

  return (
    <div className="bg-gray-800/80 rounded-xl p-6 shadow-md border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-cyan-400">Generated Purchase Order</h3>
        {isEditable && (
            <button onClick={onAddItem} className="flex items-center gap-1 text-sm bg-cyan-800/50 text-cyan-300 hover:bg-cyan-700/50 py-1 px-3 rounded-md transition-colors"><PlusIcon/> Add Item</button>
        )}
      </div>
      
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-bold uppercase pb-2 border-b border-gray-600">
          <div className="col-span-4">Item</div>
          <div className="col-span-2">Unit</div>
          <div className="col-span-4 text-center">Quantity</div>
          <div className="col-span-2"></div>
      </div>
      
      {/* Items List */}
      <div className="space-y-1 mt-2 max-h-64 overflow-y-auto">
        {items.length > 0 ? items.map(item => (
          <POItemRow key={item.id} item={item} onUpdateQuantity={onUpdateQuantity} onRemoveItem={onRemoveItem} onUpdateDetails={onUpdateDetails} isEditable={isEditable} />
        )) : <p className="text-center text-gray-500 p-4">No items in the purchase order.</p>}
      </div>
      
      {isEditable && (
        <div className="mt-6 pt-4 border-t border-gray-600 flex justify-end gap-4">
            <button onClick={onReject} className="flex items-center gap-2 bg-red-600/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors">
                <XIcon />
                Reject
            </button>
            <button onClick={onApprove} className="flex items-center gap-2 bg-green-600/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors">
                <CheckIcon />
                Approve & Generate PDF
            </button>
        </div>
      )}
    </div>
  );
};
