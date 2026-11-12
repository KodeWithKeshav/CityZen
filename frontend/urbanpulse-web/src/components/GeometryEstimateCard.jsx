import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiCubeTransparent, HiRefresh } from 'react-icons/hi';
import { makeApiCall, apiClient } from '../services/api';
import toast from 'react-hot-toast';
import { useTranslatedText } from '../context/TranslationContext';

export default function GeometryEstimateCard({ complaint, onGeometryUpdated }) {
  const { t } = useTranslation('admin');
  const [retrying, setRetrying] = useState(false);
  const translatedGeomError = useTranslatedText(complaint?.geometry_error || '');

  if (!complaint) return null;

  const isPothole = (complaint.category || complaint.issueType || '').toLowerCase() === 'pothole';
  const hasCompletedGeometry = complaint.geometry_status === 'completed' || complaint.estimated_width_cm != null;

  // Only render for potholes or if completed geometry data exists
  if (complaint.geometry_status === 'not_applicable' || (!isPothole && !hasCompletedGeometry)) {
    return null;
  }

  const handleRetryGeometry = async () => {
    const imageUrl = complaint.imageUrl || (Array.isArray(complaint.image_urls) ? complaint.image_urls[0] : null);
    const complaintId = complaint.id || complaint._id;

    if (!complaintId || !imageUrl) {
      toast.error(t('geometry.missingInfo'));
      return;
    }

    setRetrying(true);
    try {
      const res = await makeApiCall(apiClient.imageAnalysis.estimateGeometry, {
        method: 'POST',
        body: JSON.stringify({
          complaintId,
          imageUrl,
          category: complaint.category || complaint.issueType || 'pothole',
          primaryClass: complaint.imagePrimaryClass || undefined,
        }),
      });

      if (res && res.success && res.geometry) {
        if (res.geometry.geometry_status === 'completed') {
          toast.success(t('geometry.recalculated'));
        } else if (res.geometry.geometry_status === 'failed') {
          toast.error(res.geometry.geometry_error || t('geometry.failed'));
        } else {
          toast(res.message || t('geometry.skipped'));
        }
        if (onGeometryUpdated) {
          onGeometryUpdated(res.geometry);
        }
      } else {
        toast.error(res?.message || res?.error || t('geometry.failed'));
      }
    } catch (err) {
      toast.error(err.message || t('geometry.commError'));
    } finally {
      setRetrying(false);
    }
  };

  const status = complaint.geometry_status;

  return (
    <div className="border border-neutral-200 bg-white p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-2 font-serif font-bold text-sm uppercase text-neutral-900">
          <HiCubeTransparent className="w-5 h-5 text-neutral-800" />
          <span>{t('geometry.title')}</span>
        </div>
        <span className="font-mono text-[10px] uppercase px-2 py-0.5 border border-neutral-300 bg-neutral-50 text-neutral-600">
          {status ? t('geometry.statusPrefix', { status }) : t('geometry.estimation')}
        </span>
      </div>

      {(status === 'completed' && complaint.estimated_width_cm != null) || complaint.estimated_width_cm != null ? (
        <div className="space-y-3">
          <div className={`grid grid-cols-1 ${complaint.estimated_depth_cm != null ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 font-mono text-xs`}>
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">{t('geometry.footprint')}</span>
              <span className="font-bold text-neutral-900 text-sm">
                {complaint.estimated_width_cm} × {complaint.estimated_length_cm} <span className="text-[10px] font-normal text-neutral-500">{t('geometry.cmUnit')}</span>
              </span>
            </div>
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">{t('geometry.area')}</span>
              <span className="font-bold text-neutral-900 text-sm">
                {complaint.estimated_area_cm2} <span className="text-[10px] font-normal text-neutral-500">{t('geometry.cm2Unit')}</span>
              </span>
            </div>
            {complaint.estimated_depth_cm != null && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-[10px] text-neutral-500 uppercase block">{t('geometry.depth')}</span>
                <span className="font-bold text-neutral-900 text-sm">
                  {complaint.estimated_depth_cm} <span className="text-[10px] font-normal text-neutral-500">{t('geometry.cmUnit')}</span>
                </span>
              </div>
            )}
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">{t('geometry.confidence')}</span>
              <span className="font-bold text-neutral-900 text-sm">
                {complaint.geometry_confidence != null ? `${Math.round(complaint.geometry_confidence * 100)}%` : '—'}
              </span>
            </div>
          </div>

          <p className="font-mono text-[11px] text-neutral-500 leading-relaxed border-t border-neutral-100 pt-2">
            {t('geometry.footnote')}
          </p>
        </div>
      ) : status === 'pending' ? (
        <div className="py-4 text-center font-mono text-xs text-neutral-600 animate-pulse">
          {t('geometry.computing')}
        </div>
      ) : (
        <div className="space-y-3 font-mono text-xs">
          <p className="text-neutral-600 font-sans text-xs">
            {complaint.geometry_error
              ? t('geometry.errorPrefix', { error: translatedGeomError || complaint.geometry_error })
              : t('geometry.pendingMsg')}
          </p>
          <button
            onClick={handleRetryGeometry}
            disabled={retrying}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-black bg-black text-white hover:bg-neutral-800 uppercase tracking-wider font-bold transition-colors disabled:opacity-50"
          >
            <HiRefresh className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? t('geometry.running') : t('geometry.execute')}
          </button>
        </div>
      )}
    </div>
  );
}
