
import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Header } from './components/Header';
import { CameraFeed } from './components/CameraFeed';
import { PurchaseOrder } from './components/PurchaseOrder';
import { ReasoningPanel } from './components/ReasoningPanel';
import { suggestActionForInventory, analyzeImageForInventory, shouldAddStandardItems, generatePromotionImage } from './services/geminiService';
import { InventoryItem, PurchaseOrderItem, AppStatus, CameraFeedHandles, PromotionCampaign } from './types';
import { CheckIcon } from './components/icons/CheckIcon';
import { XIcon } from './components/icons/XIcon';
import { MASTER_INVENTORY_LIST, PRE_CALIBRATED_REFERENCES } from './lib/knowledgeBase';
import { NaturalLanguageProcessor } from './components/NaturalLanguageProcessor';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { PromotionPanel } from './components/PromotionPanel';
import { SideMenu } from './components/SideMenu';


const INITIAL_INVENTORY: InventoryItem[] = [];
const SCAN_INTERVAL_SECONDS = 30;

const STANDARD_ITEMS_TO_ADD = [
    { name: 'Regular Beef Patty 10:1', unit: 'cases' },
    { name: 'McSpicy Chicken Patty', unit: 'cases' },
    { name: 'Chicken McNuggets', unit: 'cases' },
    { name: 'Leaf Lettuce', unit: 'cases' },
    { name: 'Frozen French Fries', unit: 'cases' },
    { name: 'Coca-Cola Syrup', unit: 'cases' },
];

const getRandomQuantity = () => Math.floor(Math.random() * (30 - 5 + 1)) + 5;


const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [currentInventory, setCurrentInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderItem[]>([]);
  const [reasoning, setReasoning] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [referenceImages, setReferenceImages] = useState<Record<string, string>>({});
  const [isCalibrationMode, setIsCalibrationMode] = useState(false);
  const [calibrationItemId, setCalibrationItemId] = useState<string | null>(null);

  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [countdown, setCountdown] = useState(SCAN_INTERVAL_SECONDS);
  const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraFeedRef = useRef<CameraFeedHandles>(null);
  
  const [isProcessingNL, setIsProcessingNL] = useState(false);
  const [promotionCampaign, setPromotionCampaign] = useState<PromotionCampaign | null>(null);
  const [promotionImage, setPromotionImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadItemId, setUploadItemId] = useState<string | null>(null);


  useEffect(() => {
    // Load reference images from localStorage, falling back to pre-calibrated ones
    const loadedReferences = localStorage.getItem('inventory-reference-images');
    if (loadedReferences) {
      setReferenceImages(JSON.parse(loadedReferences));
    } else {
      setReferenceImages(PRE_CALIBRATED_REFERENCES);
    }
  }, []);

  useEffect(() => {
    let countdownInterval: NodeJS.Timeout | undefined;
    if (isAutoScanning) {
      countdownInterval = setInterval(() => {
        setCountdown(prev => (prev <= 1 ? SCAN_INTERVAL_SECONDS : prev - 1));
      }, 1000);
    }
    return () => clearInterval(countdownInterval);
  }, [isAutoScanning]);


  const runAnalysisCycle = async () => {
    if (!cameraFeedRef.current) return;

    const base64ImageData = cameraFeedRef.current.captureFrame();
    if (base64ImageData) {
        await handleAnalyzeAndSuggest(base64ImageData);
    } else {
        console.error("Could not capture image for analysis. Retrying in a moment.");
        // If capture fails, try again after a short delay
        timerIdRef.current = setTimeout(runAnalysisCycle, 5000);
    }
  };

  const stopMonitoring = () => {
    if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
        timerIdRef.current = null;
    }
    setIsAutoScanning(false);
  };

  const handleToggleAutoScan = () => {
    if (isAutoScanning) {
        stopMonitoring();
    } else {
        // This block starts a new analysis. We should clear previous state.
        setIsAutoScanning(true);
        setStatus('loading');
        setPurchaseOrder([]);
        setReasoning('');
        setCurrentInventory(INITIAL_INVENTORY);
        setError(null);
        runAnalysisCycle();
    }
  };

  const handleStartCalibration = (itemId: string) => {
    setCalibrationItemId(itemId);
  };

  const handleCaptureReference = (itemId: string, imageData: string) => {
    const updatedReferences = { ...referenceImages, [itemId]: imageData };
    setReferenceImages(updatedReferences);
    setCalibrationItemId(null); // Exit calibration mode for this item
    localStorage.setItem('inventory-reference-images', JSON.stringify(updatedReferences));
  };

   const handleUploadClick = (itemId: string) => {
    if (status !== 'idle' || isAutoScanning) return;
    setUploadItemId(itemId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadItemId) return;

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Invalid file type. Please upload a JPG, PNG, or WEBP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const base64String = (loadEvent.target?.result as string)?.split(',')[1];
      if (base64String) {
        handleCaptureReference(uploadItemId, base64String);
      } else {
        setError('Could not process the uploaded image.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read the uploaded image file.');
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setUploadItemId(null);
  };

  const handleAnalyzeAndSuggest = async (base64ImageData: string) => {
    setStatus('loading');
    setError(null);
    setPromotionCampaign(null);
    setPromotionImage(null);

    try {
      const referenceData = MASTER_INVENTORY_LIST.reduce((acc, item) => {
        if (referenceImages[item.id]) {
          acc[item.id] = { name: item.name, data: referenceImages[item.id] };
        }
        return acc;
      }, {} as Record<string, { name: string; data: string }>);

      const visionAnalyzedInventory = await analyzeImageForInventory(base64ImageData, referenceData);
      
      const inventoryMap: Map<string, InventoryItem> = new Map(MASTER_INVENTORY_LIST.map(item => [item.id, {...item, quantity: 0}]));
      
      visionAnalyzedInventory.forEach(seenItem => {
          if (inventoryMap.has(seenItem.id)) {
              inventoryMap.get(seenItem.id)!.quantity = seenItem.quantity;
          }
      });
      const newCurrentInventory = Array.from(inventoryMap.values());
      setCurrentInventory(newCurrentInventory);

      const actionResponse = await suggestActionForInventory(newCurrentInventory);
      setReasoning(actionResponse.reasoning || "Analysis complete.");

      if (actionResponse.promotionCampaign) {
          setPromotionCampaign(actionResponse.promotionCampaign);
          setPurchaseOrder([]);
          setStatus('loading'); // For image generation
          
          const baseImage = await generatePromotionImage(actionResponse.promotionCampaign.imagePrompt);
          setPromotionImage(baseImage);
          
          setStatus('promotionSuggested');
      } else {
          setPurchaseOrder(actionResponse.purchaseOrderItems || []);
          setStatus('generated');
      }
      
      // If auto-scanning is on, schedule the next cycle. The loop is only broken
      // by user actions (Stop, Approve, Reject) or an error.
      setCountdown(SCAN_INTERVAL_SECONDS);
      timerIdRef.current = setTimeout(runAnalysisCycle, SCAN_INTERVAL_SECONDS * 1000);
      
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An error occurred during AI analysis. Please check the API key and try again.');
      setStatus('error');
      stopMonitoring();
    }
  };

  const resetState = () => {
    stopMonitoring();
    setStatus('idle');
    setCurrentInventory(INITIAL_INVENTORY);
    setPurchaseOrder([]);
    setReasoning('');
    setError(null);
    setIsCalibrationMode(false);
    setCalibrationItemId(null);
    setPromotionCampaign(null);
    setPromotionImage(null);
  };
  
  const handleUpdateItemQuantity = (itemId: string, newQuantity: number) => {
    setPurchaseOrder(prevOrder =>
      prevOrder.map(item =>
        item.id === itemId ? { ...item, quantity: Math.max(0, newQuantity) } : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setPurchaseOrder(prevOrder => prevOrder.filter(item => item.id !== itemId));
  };
  
  const handleAddItem = () => {
    const newItem: PurchaseOrderItem = {
        id: `custom-${Date.now()}`,
        name: 'New Item',
        quantity: 1,
        unit: 'units'
    };
    setPurchaseOrder(prev => [...prev, newItem]);
  };

  const handleUpdateItemDetails = (itemId: string, field: 'name' | 'unit', value: string) => {
      setPurchaseOrder(prevOrder =>
      prevOrder.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  }

  const handleProcessPrompt = async (prompt: string) => {
    setIsProcessingNL(true);
    setError(null);
    try {
        const shouldAdd = await shouldAddStandardItems(prompt);
        if (shouldAdd) {
            setPurchaseOrder(prevOrder => {
                const existingNames = new Set(prevOrder.map(item => item.name));
                const itemsToAdd = STANDARD_ITEMS_TO_ADD
                    .filter(stdItem => !existingNames.has(stdItem.name))
                    .map(stdItem => ({
                        id: `custom-${Date.now()}-${stdItem.name.replace(/\s+/g, '-')}`,
                        name: stdItem.name,
                        quantity: getRandomQuantity(),
                        unit: stdItem.unit,
                    }));
                
                if(itemsToAdd.length > 0) {
                   setReasoning(prev => prev + `\n\nAI added ${itemsToAdd.length} standard item(s) based on your request.`);
                } else {
                   setReasoning(prev => prev + `\n\nAI determined the requested items are already in the order.`);
                }

                return [...prevOrder, ...itemsToAdd];
            });
        } else {
             setReasoning(prev => prev + `\n\nAI did not detect a request to add new items.`);
        }
    } catch (e: any) {
        setError(e.message || "An error occurred while processing your request.");
    } finally {
        setIsProcessingNL(false);
    }
};

  const handleApprove = () => {
    const doc = new jsPDF();
    const poNumber = Date.now();
    
    // Title
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text("Purchase Order", 190, 25, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    
    // Date and PO Number
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 190, 35, { align: 'right' });
    doc.text(`PO #: ${poNumber}`, 190, 40, { align: 'right' });


    // From Address
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("FROM", 20, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text("McDonald's", 20, 56);
    doc.text("37 Queen's Road Central, Yu To Sang Building", 20, 61);
    doc.text("Central, Hong Kong", 20, 66);

    // To Address
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("TO", 110, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text("Votee Limited", 110, 56);
    doc.text("4/F 9 Queen's Road Central,", 110, 61);
    doc.text("Central", 110, 66);
    doc.text("Hong Kong", 110, 71);

    // Line separator
    doc.setLineWidth(0.5);
    doc.line(20, 85, 190, 85);

    // Table Header
    let y = 92;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("ITEM NAME", 20, y);
    doc.text("QUANTITY", 140, y, { align: 'center' });
    doc.text("UNIT", 170, y);
    doc.setFont('helvetica', 'normal');
    y += 2;
    doc.setLineWidth(0.2);
    doc.line(20, y, 190, y);
    y += 6;
    
    // Table Rows
    doc.setFontSize(10);
    purchaseOrder.forEach(item => {
        if(item.quantity > 0){
            doc.text(item.name, 20, y);
            doc.text(item.quantity.toString(), 145, y, { align: 'center' });
            doc.text(item.unit, 170, y);
            y += 7;
        }
    });

    // Table bottom line
    y -= 3;
    doc.line(20, y, 190, y);

    doc.save(`PurchaseOrder-${poNumber}.pdf`);

    // --- Create and open mailto link ---
    const to = "pak@votee.com,jeff@votee.com,kendra@votee.com";
    const subject = `Purchase Order - PO #${poNumber}`;

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 2);
    const requestedDeliveryDate = deliveryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const emailBody = `Hi Supplier Team,\n\nHope you're having a great week!\n\nPlease find our latest purchase order, PO #${poNumber}, attached to this email. We'd like to request delivery for our usual slot on ${requestedDeliveryDate}.\n\nCould you please confirm receipt of this order and the scheduled delivery date at your earliest convenience?\n\nThanks as always for your great service and partnership.\n\nBest regards,\nKendra Bui\nRestaurant Manager\nMcDonald's - Central Hong Kong`;
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.open(mailtoLink);

    setStatus('approved');
    stopMonitoring();
  };

  const handleReject = () => {
    setStatus('rejected');
    stopMonitoring();
  };

  const handleApprovePromotion = () => {
    setStatus('promotionApproved');
    stopMonitoring();
  };
    
  const handleRejectPromotion = () => {
    setStatus('promotionRejected');
    stopMonitoring();
  };

  
  const handleDownloadCSV = () => {
    if (currentInventory.length === 0) return;

    const headers = ['id', 'name', 'quantity', 'unit'];
    const escapeCsvCell = (cell: string | number) => {
        const cellStr = String(cell);
        if (cellStr.includes(',')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
    }

    const rows = currentInventory.map(item =>
        [
            escapeCsvCell(item.id),
            escapeCsvCell(item.name),
            escapeCsvCell(item.quantity),
            escapeCsvCell(item.unit)
        ].join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory-scan-${date}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const currentCalibrationItemName = MASTER_INVENTORY_LIST.find(item => item.id === calibrationItemId)?.name || '';

  const KnowledgeBaseManager = () => (
    <div className="bg-gray-800/50 rounded-xl p-6 shadow-lg border border-gray-700">
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg, image/jpg, image/png, image/webp"
            style={{ display: 'none' }}
            aria-hidden="true"
        />
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white mb-4" id="menu-title">Update AI Knowledge Base</h3>
          <button onClick={() => setIsCalibrationMode(false)} className="bg-cyan-700 hover:bg-cyan-600 text-white font-semibold py-1 px-3 rounded-md">Done</button>
        </div>
        <p className="text-gray-400 mb-4 text-sm">Update an item's reference by uploading an image or capturing a new one with the camera.</p>
        <ul className="space-y-3">
            {MASTER_INVENTORY_LIST.map(item => (
                <li key={item.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                    <div className="flex items-center gap-4">
                       {referenceImages[item.id] ? (
                            <img src={`data:image/jpeg;base64,${referenceImages[item.id]}`} alt={`${item.name} reference`} className="w-12 h-12 object-cover rounded-md border-2 border-green-500" />
                        ) : (
                            <div className="w-12 h-12 bg-gray-600 rounded-md flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                            </div>
                        )}
                        <span className="font-medium text-gray-300">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleUploadClick(item.id)}
                            disabled={status !== 'idle' || isAutoScanning}
                            className="flex items-center py-1 px-3 rounded-md text-sm font-semibold transition-colors bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Upload
                        </button>
                        <button
                            onClick={() => handleStartCalibration(item.id)}
                            disabled={status !== 'idle' || isAutoScanning}
                            className="flex items-center py-1 px-3 rounded-md text-sm font-semibold transition-colors bg-cyan-700 hover:bg-cyan-600 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Capture
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    </div>
  );
  
  const renderRightPanelContent = () => {
    if (status === 'approved' || status === 'rejected' || status === 'promotionApproved' || status === 'promotionRejected') {
      const isApproved = status === 'approved' || status === 'promotionApproved';
      const isPromotion = status === 'promotionApproved' || status === 'promotionRejected';

      return (
        <div className="mt-8 flex flex-col items-center justify-center flex-grow">
          {isApproved ? (
            <div className="text-center p-6 rounded-lg bg-green-900/50 border border-green-500">
              <h3 className="text-xl font-bold text-green-300 flex items-center justify-center gap-2"><CheckIcon/> Action Complete</h3>
              {isPromotion ? (
                 <p className="text-green-400 mt-2">Promotion campaign approved and sent to POS channels.</p>
              ): (
                <>
                  <p className="text-green-400 mt-2">Purchase order PDF has been downloaded.</p>
                  <p className="text-yellow-300 mt-1 font-semibold">Your email client should now be open.</p>
                  <p className="text-gray-300 mt-1">Please attach the PDF to the email and send it.</p>
                </>
              )}
            </div>
          ) : (
             <div className="text-center p-4 rounded-lg bg-red-900/50 border border-red-500">
              <h3 className="text-xl font-bold text-red-300 flex items-center justify-center gap-2"><XIcon /> {isPromotion ? 'Promotion Rejected' : 'Purchase Order Rejected'}</h3>
            </div>
          )}
          <button onClick={resetState} className="mt-6 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Start New Analysis
          </button>
        </div>
      );
    }

    if (error) {
       return (
         <div className="flex-grow flex flex-col items-center justify-center text-center text-red-400">
            <h3 className="text-xl font-bold mb-2">Error</h3>
            <p className="max-w-md">{error}</p>
             <button onClick={resetState} className="mt-6 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Try Again
            </button>
        </div>
      );
    }
    
    if (status === 'loading') {
       const message = promotionCampaign
        ? "AI is designing a promotional image..."
        : "AI Agent is analyzing the inventory image...";

       return (
        <div className="flex-grow flex flex-col items-center justify-center text-center">
            <svg className="animate-spin h-10 w-10 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-lg text-gray-300">{message}</p>
        </div>
       );
    }

    if (status === 'promotionSuggested' && promotionCampaign) {
        return (
            <PromotionPanel 
                campaign={promotionCampaign}
                imageUrl={promotionImage}
                onApprove={handleApprovePromotion}
                onReject={handleRejectPromotion}
            />
        )
    }
    
    if (status === 'generated') {
        return (
            <div className="flex flex-col gap-6">
                <ReasoningPanel reasoning={reasoning} />
                {purchaseOrder.length > 0 ? (
                    <>
                    <PurchaseOrder 
                        items={purchaseOrder}
                        onUpdateQuantity={handleUpdateItemQuantity}
                        onRemoveItem={handleRemoveItem}
                        onAddItem={handleAddItem}
                        onUpdateDetails={handleUpdateItemDetails}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        status={status}
                    />
                     <NaturalLanguageProcessor 
                        onProcessPrompt={handleProcessPrompt}
                        isProcessing={isProcessingNL}
                    />
                    </>
                ) : (
                    <div className="text-center p-6 rounded-lg bg-green-900/50 border border-green-500">
                        <h3 className="text-xl font-bold text-green-300 flex items-center justify-center gap-2"><CheckIcon/> Inventory Levels Optimal</h3>
                        <p className="text-green-400 mt-2">No action is required at this time.</p>
                    </div>
                )}
                 {isAutoScanning && (
                    <div className="text-center text-gray-400 text-sm">
                        <p>Monitoring is active. Next scan in <span className="font-bold text-white">{countdown}</span>s.</p>
                    </div>
                )}
            </div>
        );
    }
    
    return (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-400">
           <p className="text-lg">AI is calibrated and ready.</p>
           <p>Click "Start Automatic Monitoring" to begin.</p>
       </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header onMenuClick={() => setIsCalibrationMode(true)} />
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          
          <div className="flex flex-col gap-8">
            <div className="bg-gray-800/50 rounded-xl p-6 shadow-lg border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Last Scanned Inventory</h3>
                    {currentInventory.length > 0 && (
                        <button
                            onClick={handleDownloadCSV}
                            className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
                            aria-label="Download inventory as CSV"
                        >
                            <DownloadIcon />
                            Download CSV
                        </button>
                    )}
                </div>
                 {currentInventory.length > 0 ? (
                    <ul className="space-y-3">
                        {currentInventory.map(item => (
                            <li key={item.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                                <span className="font-medium text-gray-300">{item.name}</span>
                                <span className="text-cyan-400 font-semibold">{item.quantity} {item.unit}</span>
                            </li>
                        ))}
                    </ul>
                 ) : (
                    <div className="flex items-center justify-center py-8 text-gray-500 text-center">
                        <p>Awaiting first inventory scan...</p>
                    </div>
                 )}
            </div>
             <CameraFeed
                ref={cameraFeedRef}
                onToggleAutoScan={handleToggleAutoScan}
                status={status}
                isAutoScanning={isAutoScanning}
                isCalibrationMode={!!calibrationItemId}
                calibrationItemId={calibrationItemId}
                calibrationItemName={currentCalibrationItemName}
                onCaptureReference={handleCaptureReference}
                onCancelCalibration={() => setCalibrationItemId(null)}
            />
          </div>

          <div className="flex flex-col gap-8">
            <div className="bg-gray-800/50 rounded-xl p-6 shadow-lg border border-gray-700 min-h-[600px] flex flex-col">
                {renderRightPanelContent()}
            </div>
          </div>
        </div>
      </main>
      
      <SideMenu isOpen={isCalibrationMode} onClose={() => setIsCalibrationMode(false)}>
        <KnowledgeBaseManager />
      </SideMenu>

    </div>
  );
};

export default App;
