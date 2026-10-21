import React, { useState } from 'react';
import { HiCubeTransparent, HiRefresh } from 'react-icons/hi';
import { makeApiCall, apiClient } from '../services/api';
import toast from 'react-hot-toast';

export default function GeometryEstimateCard({ complaint, onGeometryUpdated }) {
  const [retrying, setRetrying] = useState(false);

  if (!complaint) return null;

  const isPothole = (complaint.category || complaint.issueType || '').toLowerCase() === 'pothole';
  const hasGeometry = complaint.geometry_status || complaint.estimated_width_cm;

  // Only render for potholes or if geometry data exists
  if (!isPothole && !hasGeometry) return null;

  const handleRetryGeometry = async () => {
    const imageUrl = complaint.imageUrl || (Array.isArray(complaint.image_urls) ? complaint.image_urls[0] : null);
    const complaintId = complaint.id || complaint._id;

    if (!complaintId || !imageUrl) {
      toast.error('Complaint ID and field image are required for geometry estimation.');
      return;
    }

    setRetrying(true);
    try {
      const res = await makeApiCall(apiClient.imageAnalysis.estimateGeometry, {
        method: 'POST',
        body: JSON.stringify({
          complaintId,
          imageUrl,
          category: complaint.category || 'pothole',
        }),
      });

      if (res && res.success && res.geometry) {
        toast.success('Pothole geometric dimensions re-calculated');
        if (onGeometryUpdated) {
          onGeometryUpdated(res.geometry);
        }
      } else {
        toast.error(res?.message || res?.error || 'Geometry estimation could not be completed.');
      }
    } catch (err) {
      toast.error(err.message || 'Geometry service communication error.');
    } finally {
      setRetrying(false);
    }
  };

  const status = complaint.geometry_status;

  return (
    <div className="border border-neutral-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-2 font-serif font-bold text-sm uppercase text-neutral-900">
          <HiCubeTransparent className="w-5 h-5 text-neutral-800" />
          <span>Geometric Dimensions Profile</span>
        </div>
        <span className="font-mono text-[10px] uppercase px-2 py-0.5 border border-neutral-300 bg-neutral-50 text-neutral-600">
          {status ? `STATUS: ${status}` : 'GEOMETRIC ESTIMATION'}
        </span>
      </div>

      {status === 'completed' || complaint.estimated_width_cm ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">SURFACE FOOTPRINT</span>
              <span className="font-bold text-neutral-900 text-sm">
                {complaint.estimated_width_cm} × {complaint.estimated_length_cm} <span className="text-[10px] font-normal text-neutral-500">cm</span>
              </span>
            </div>
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">ESTIMATED AREA</span>
              <span className="font-bold text-neutral-900 text-sm">
                {complaint.estimated_area_cm2} <span className="text-[10px] font-normal text-neutral-500">cm²</span>
              </span>
            </div>
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">CONFIDENCE METRIC</span>
              <span className="font-bold text-neutral-900 text-sm">
                {Math.round((complaint.geometry_confidence || 0.85) * 100)}%
              </span>
            </div>
          </div>

          <p className="font-mono text-[11px] text-neutral-500 leading-relaxed border-t border-neutral-100 pt-2">
            * Dimensions computed via computer-vision segmentation and standard asphalt reference perspective.
          </p>
        </div>
      ) : status === 'pending' ? (
        <div className="py-4 text-center font-mono text-xs text-neutral-600 animate-pulse">
          COMPUTING GEOMETRIC DIMENSIONS &amp; SPATIAL BOUNDARIES...
        </div>
      ) : (
        <div className="space-y-3 font-mono text-xs">
          <p className="text-neutral-600 font-sans text-xs">
            {complaint.geometry_error
              ? `Geometry computation error: ${complaint.geometry_error}`
              : 'Geometric measurement is pending or uncomputed for this road defect.'}
          </p>
          <button
            onClick={handleRetryGeometry}
            disabled={retrying}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-black bg-black text-white hover:bg-neutral-800 uppercase tracking-wider font-bold transition-colors disabled:opacity-50"
          >
            <HiRefresh className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'RUNNING ESTIMATION...' : 'EXECUTE GEOMETRY ESTIMATION'}
          </button>
        </div>
      )}
    </div>
  );
}
