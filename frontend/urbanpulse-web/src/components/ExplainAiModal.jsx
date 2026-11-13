import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HiX, HiSparkles, HiRefresh, HiShieldCheck } from 'react-icons/hi';
import { makeApiCall, apiClient } from '../services/api';
import { useTranslatedText } from '../context/TranslationContext';

export default function ExplainAiModal({ isOpen, onClose, imageUrl, title, category }) {
  const { t } = useTranslation(['admin', 'complaint']);
  const displayTitle = useTranslatedText(title || t('admin:complaintDossier.civicIncident'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeView, setActiveView] = useState('segmented'); // 'segmented' | 'original' | 'split'
  const requestIdRef = useRef(0);
  const translatedExplanation = useTranslatedText(data?.explanationText || '');
  const translatedError = useTranslatedText(error || '');

  const fetchExplanation = useCallback(async () => {
    if (!imageUrl) return;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await makeApiCall(apiClient.imageAnalysis.explain, {
        method: 'POST',
        body: JSON.stringify({ imageUrl, category }),
      });

      if (reqId !== requestIdRef.current) return;

      if (res && res.success) {
        setData(res);
      } else {
        setError(res?.error || res?.message || t('admin:explainAi.loadError'));
      }
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setError(err.message || t('admin:explainAi.connectError'));
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [imageUrl, category, t]);

  useEffect(() => {
    if (isOpen && imageUrl) {
      fetchExplanation();
    } else if (!isOpen) {
      requestIdRef.current += 1;
      setLoading(false);
      setData(null);
      setError(null);
      setActiveView('segmented');
    }
  }, [isOpen, imageUrl, category, fetchExplanation]);

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

  const rawAnnotated = data?.annotatedImage?.value;
  const annotatedSrc = rawAnnotated
    ? (rawAnnotated.startsWith('data:') || rawAnnotated.startsWith('http')
        ? rawAnnotated
        : `data:image/jpeg;base64,${rawAnnotated}`)
    : data?.annotatedImageUrl || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-4xl bg-white border border-black max-h-[92dvh] flex flex-col font-sans fade-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-200 flex items-center justify-between gap-2 bg-neutral-900 text-white">
          <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs uppercase tracking-widest min-w-0">
            <HiSparkles className="w-4 h-4 text-neutral-300 flex-shrink-0" />
            <span className="truncate">{t('admin:explainAi.header')}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors flex-shrink-0"
            aria-label={t('admin:explainAi.close')}
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-bar */}
        <div className="px-4 sm:px-6 py-2 border-b border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <div className="text-neutral-600 truncate max-w-full sm:max-w-md">
            {t('admin:explainAi.target')} <span className="font-bold text-neutral-900">{displayTitle}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveView('segmented')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold border ${
                activeView === 'segmented'
                  ? 'bg-neutral-900 text-white border-black'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >
              {t('admin:explainAi.maskTab')}
            </button>
            <button
              onClick={() => setActiveView('original')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold border ${
                activeView === 'original'
                  ? 'bg-neutral-900 text-white border-black'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >
              {t('admin:explainAi.originalTab')}
            </button>
            <button
              onClick={() => setActiveView('split')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold border ${
                activeView === 'split'
                  ? 'bg-neutral-900 text-white border-black'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
              }`}
            >
              {t('admin:explainAi.splitTab')}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="inline-block p-4 border border-black bg-neutral-50 animate-pulse">
                <HiSparkles className="w-8 h-8 text-neutral-900 mx-auto" />
              </div>
              <div className="font-mono text-xs uppercase tracking-wider text-neutral-700">
                {t('admin:explainAi.executing')}
              </div>
              <p className="text-xs text-neutral-500 font-sans max-w-sm mx-auto">
                {t('admin:explainAi.executingDesc')}
              </p>
            </div>
          ) : error ? (
            <div className="border border-neutral-300 bg-neutral-50 p-6 text-center space-y-4 font-mono text-xs">
              <div className="text-neutral-900 font-bold uppercase">
                {t('admin:explainAi.unavailable')}
              </div>
              <p className="text-neutral-600 font-sans text-xs max-w-md mx-auto">
                {translatedError || error}
              </p>
              <button
                onClick={fetchExplanation}
                className="inline-flex items-center gap-2 px-4 py-2 border border-black bg-white text-black hover:bg-black hover:text-white uppercase tracking-wider font-bold transition-colors"
              >
                <HiRefresh className="w-4 h-4" /> {t('admin:explainAi.retry')}
              </button>
            </div>
          ) : data ? (
            <>
              {/* Visual Display */}
              <div className="border border-neutral-200 bg-neutral-950 p-2">
                {activeView === 'segmented' && (
                  <div className="relative flex items-center justify-center min-h-[200px] sm:min-h-[300px] max-h-[340px] sm:max-h-[420px]">
                    {annotatedSrc ? (
                      <img
                        src={annotatedSrc}
                        alt={t('admin:explainAi.segmentation')}
                        className="max-h-[320px] sm:max-h-[400px] w-auto object-contain mx-auto"
                      />
                    ) : (
                      <div className="text-neutral-400 font-mono text-xs p-6 text-center">
                        {t('admin:explainAi.noMask')}
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 uppercase border border-neutral-700">
                      {t('admin:explainAi.maskOverlay')}
                    </span>
                  </div>
                )}

                {activeView === 'original' && (
                  <div className="relative flex items-center justify-center min-h-[200px] sm:min-h-[300px] max-h-[340px] sm:max-h-[420px]">
                    <img
                      src={imageUrl}
                      alt={t('admin:explainAi.originalEvidence')}
                      className="max-h-[320px] sm:max-h-[400px] w-auto object-contain mx-auto"
                    />
                    <span className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 uppercase border border-neutral-700">
                      {t('admin:explainAi.originalEvidence')}
                    </span>
                  </div>
                )}

                {activeView === 'split' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="relative bg-neutral-900 p-1 flex items-center justify-center min-h-[200px] sm:min-h-[260px]">
                      <img
                        src={imageUrl}
                        alt={t('admin:explainAi.originalTab')}
                        className="max-h-[220px] sm:max-h-[260px] w-auto object-contain mx-auto"
                      />
                      <span className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 uppercase border border-neutral-700">
                        {t('admin:explainAi.originalPhoto')}
                      </span>
                    </div>
                    <div className="relative bg-neutral-900 p-1 flex items-center justify-center min-h-[200px] sm:min-h-[260px]">
                      {annotatedSrc ? (
                        <img
                          src={annotatedSrc}
                          alt={t('admin:explainAi.segmentation')}
                          className="max-h-[220px] sm:max-h-[260px] w-auto object-contain mx-auto"
                        />
                      ) : (
                        <div className="text-neutral-400 font-mono text-xs">
                          {t('admin:explainAi.noSegData')}
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 uppercase border border-neutral-700">
                        {t('admin:explainAi.segmentation')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Detections Summary */}
              {Array.isArray(data.detections) && data.detections.length > 0 && (
                <div className="space-y-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block">
                    {t('admin:explainAi.detectedContours')}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {data.detections.map((det, idx) => {
                      const rawClass = det.label || det.class || det.category;
                      const catSlug = rawClass ? String(rawClass).toLowerCase().replace(/\s+/g, '_') : '';
                      const localizedClass = catSlug
                        ? t(`complaint:categories.${catSlug}.label`, rawClass)
                        : `#${idx + 1}`;
                      const pct = det.confidence > 1 ? Math.round(det.confidence) : Math.round(det.confidence * 100);
                      return (
                        <div
                          key={idx}
                          className="border border-neutral-300 bg-neutral-50 px-3 py-1.5 font-mono text-xs flex items-center gap-2"
                        >
                          <span className="font-bold text-neutral-900 uppercase">
                            {localizedClass}
                          </span>
                          {typeof det.confidence === 'number' && (
                            <span className="text-[10px] text-neutral-500 border-l border-neutral-200 pl-2">
                              {t('admin:explainAi.conf', { pct })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Explanation Narrative */}
              <div className="border border-neutral-200 p-5 bg-neutral-50 space-y-2">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-900 font-bold border-b border-neutral-200 pb-2">
                  <HiShieldCheck className="w-4 h-4 text-black" />
                  <span>{t('admin:explainAi.reasoningReport')}</span>
                </div>
                <p className="font-sans text-sm text-neutral-800 leading-relaxed whitespace-pre-line pt-1">
                  {translatedExplanation || t('admin:explainAi.noExplanation')}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <div className="text-neutral-500 text-[11px]">
            {t('admin:explainAi.modelLabel')} <span className="text-neutral-900 font-bold">SAM-3 / RESNET CONV-AI</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-black bg-black text-white hover:bg-neutral-800 uppercase tracking-wider font-bold transition-colors"
          >
            {t('admin:explainAi.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
