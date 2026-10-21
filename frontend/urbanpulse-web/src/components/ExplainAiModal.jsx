import React, { useState, useEffect } from 'react';
import { HiX, HiPhotograph, HiSparkles, HiRefresh, HiShieldCheck } from 'react-icons/hi';
import { makeApiCall, apiClient } from '../services/api';

export default function ExplainAiModal({ isOpen, onClose, imageUrl, title = 'Civic Incident', category }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeView, setActiveView] = useState('segmented'); // 'segmented' | 'original' | 'split'

  const fetchExplanation = async () => {
    if (!imageUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await makeApiCall(apiClient.imageAnalysis.explain, {
        method: 'POST',
        body: JSON.stringify({ imageUrl, category }),
      });

      if (res && res.success) {
        setData(res);
      } else {
        setError(res?.error || res?.message || 'Failed to generate SAM-3 neural explanation.');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to image analysis engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && imageUrl) {
      fetchExplanation();
    } else if (!isOpen) {
      setData(null);
      setError(null);
      setActiveView('segmented');
    }
  }, [isOpen, imageUrl]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const annotatedSrc = data?.annotatedImage?.value
    ? `data:image/jpeg;base64,${data.annotatedImage.value}`
    : data?.annotatedImageUrl || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div 
        className="relative w-full max-w-4xl bg-white border border-black max-h-[90vh] flex flex-col font-sans animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
            <HiSparkles className="w-4 h-4 text-neutral-300" />
            <span>EXPLAIN AI · SAM-3 VISION WORKFLOW</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-bar */}
        <div className="px-6 py-2 border-b border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <div className="text-neutral-600 truncate max-w-md">
            TARGET: <span className="font-bold text-neutral-900">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveView('segmented')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold border ${
                activeView === 'segmented'
                  ? 'bg-neutral-900 text-white border-black'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >
              SAM-3 Mask
            </button>
            <button
              onClick={() => setActiveView('original')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold border ${
                activeView === 'original'
                  ? 'bg-neutral-900 text-white border-black'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setActiveView('split')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold border ${
                activeView === 'split'
                  ? 'bg-neutral-900 text-white border-black'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >
              Side-by-Side
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="inline-block p-4 border border-black bg-neutral-50 animate-pulse">
                <HiSparkles className="w-8 h-8 text-neutral-900 mx-auto" />
              </div>
              <div className="font-mono text-xs uppercase tracking-wider text-neutral-700">
                EXECUTING SAM-3 NEURAL SEGMENTATION PIPELINE...
              </div>
              <p className="text-xs text-neutral-500 font-sans max-w-sm mx-auto">
                Synthesizing semantic bounding masks, contour detection, and model feature rationale.
              </p>
            </div>
          ) : error ? (
            <div className="border border-neutral-300 bg-neutral-50 p-6 text-center space-y-4 font-mono text-xs">
              <div className="text-neutral-900 font-bold uppercase">
                EXPLANATION PIPELINE UNAVAILABLE
              </div>
              <p className="text-neutral-600 font-sans text-xs max-w-md mx-auto">
                {error}
              </p>
              <button
                onClick={fetchExplanation}
                className="inline-flex items-center gap-2 px-4 py-2 border border-black bg-white text-black hover:bg-black hover:text-white uppercase tracking-wider font-bold transition-colors"
              >
                <HiRefresh className="w-4 h-4" /> RETRY WORKFLOW
              </button>
            </div>
          ) : data ? (
            <>
              {/* Visual Display */}
              <div className="border border-neutral-200 bg-neutral-950 p-2">
                {activeView === 'segmented' && (
                  <div className="relative flex items-center justify-center min-h-[300px] max-h-[420px]">
                    {annotatedSrc ? (
                      <img
                        src={annotatedSrc}
                        alt="SAM-3 Segmentation Output"
                        className="max-h-[400px] w-auto object-contain mx-auto"
                      />
                    ) : (
                      <div className="text-neutral-400 font-mono text-xs p-6 text-center">
                        NO SEGMENTATION MASK GENERATED BY ENGINE
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 uppercase border border-neutral-700">
                      SAM-3 SEGMENTATION OVERLAY
                    </span>
                  </div>
                )}

                {activeView === 'original' && (
                  <div className="relative flex items-center justify-center min-h-[300px] max-h-[420px]">
                    <img
                      src={imageUrl}
                      alt="Original Citizen Report Evidence"
                      className="max-h-[400px] w-auto object-contain mx-auto"
                    />
                    <span className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 uppercase border border-neutral-700">
                      ORIGINAL FIELD EVIDENCE
                    </span>
                  </div>
                )}

                {activeView === 'split' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="relative bg-neutral-900 p-1 flex items-center justify-center min-h-[260px]">
                      <img
                        src={imageUrl}
                        alt="Original"
                        className="max-h-[260px] w-auto object-contain mx-auto"
                      />
                      <span className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 uppercase border border-neutral-700">
                        ORIGINAL FIELD PHOTO
                      </span>
                    </div>
                    <div className="relative bg-neutral-900 p-1 flex items-center justify-center min-h-[260px]">
                      {annotatedSrc ? (
                        <img
                          src={annotatedSrc}
                          alt="SAM-3 Segmented"
                          className="max-h-[260px] w-auto object-contain mx-auto"
                        />
                      ) : (
                        <div className="text-neutral-400 font-mono text-xs">
                          NO SEGMENTATION DATA
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 uppercase border border-neutral-700">
                        SAM-3 SEGMENTATION
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Detections Summary */}
              {Array.isArray(data.detections) && data.detections.length > 0 && (
                <div className="space-y-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block">
                    DETECTED CIVIC CONTOURS &amp; OBJECT INSTANCES
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {data.detections.map((det, idx) => (
                      <div
                        key={idx}
                        className="border border-neutral-300 bg-neutral-50 px-3 py-1.5 font-mono text-xs flex items-center gap-2"
                      >
                        <span className="font-bold text-neutral-900 uppercase">
                          {det.label || det.class || det.category || `DETECTION #${idx + 1}`}
                        </span>
                        {det.confidence !== undefined && (
                          <span className="text-[10px] text-neutral-500 border-l border-neutral-200 pl-2">
                            CONF: {Math.round(det.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation Narrative */}
              <div className="border border-neutral-200 p-5 bg-neutral-50 space-y-2">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-900 font-bold border-b border-neutral-200 pb-2">
                  <HiShieldCheck className="w-4 h-4 text-black" />
                  <span>NEURAL INFERENCE &amp; REASONING REPORT</span>
                </div>
                <p className="font-sans text-sm text-neutral-800 leading-relaxed whitespace-pre-line pt-1">
                  {data.explanationText || 'No diagnostic explanation text was provided by the neural model.'}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between font-mono text-xs">
          <div className="text-neutral-500 text-[11px]">
            MODEL: <span className="text-neutral-900 font-bold">SAM-3 / RESNET CONV-AI</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-black bg-black text-white hover:bg-neutral-800 uppercase tracking-wider font-bold transition-colors"
          >
            DISMISS REPORT
          </button>
        </div>
      </div>
    </div>
  );
}
