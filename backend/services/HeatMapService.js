const { supabase } = require('../config/supabase');

class HeatMapService {
  constructor() {
    // Initialize status change cache
    this.statusChangeCache = new Map();
    this.lastStatusCheck = new Date();
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const { error } = await supabase
        .from('complaints')
        .select('id')
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Get all complaints for heat map visualization
   * Returns complaints with their coordinates and status
   */
  async getComplaintHeatMapData(filters = {}) {
    try {
      console.log('🗺️ Fetching complaint heat map data...');

      // First check for status changes
      await this.checkForStatusChanges();

      let query = supabase
        .from('complaints')
        .select(`
          id,
          location_latitude,
          location_longitude,
          status,
          category,
          priority_score,
          created_at,
          updated_at,
          resolved_at,
          location_address,
          title,
          description,
          image_urls
        `)
        .not('location_latitude', 'is', null)
        .not('location_longitude', 'is', null);

      // Apply date filter (only when a specific positive dateRange is requested)
      if (Number.isFinite(filters.dateRange) && filters.dateRange > 0) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - filters.dateRange);
        query = query.gte('created_at', startDate.toISOString());
      }

      // Apply status filter
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // Apply complaint type filter
      if (filters.complaintType) {
        query = query.eq('category', filters.complaintType);
      }

      // Apply optional geographic bounding box filters
      if (Number.isFinite(filters.minLat)) query = query.gte('location_latitude', filters.minLat);
      if (Number.isFinite(filters.maxLat)) query = query.lte('location_latitude', filters.maxLat);
      if (Number.isFinite(filters.minLng)) query = query.gte('location_longitude', filters.minLng);
      if (Number.isFinite(filters.maxLng)) query = query.lte('location_longitude', filters.maxLng);

      const { data: complaints, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching complaints:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Return empty array if no complaints found - no mock data
      if (!complaints || complaints.length === 0) {
        console.log('⚠️ No complaints found in database');
        return {
          points: [],
          statistics: {
            total: 0,
            resolved: 0,
            active: 0,
            pending: 0,
            resolutionRate: 0,
            averageResolutionDays: 0,
            byType: {},
            byPriority: {},
            oldestPending: null
          },
          lastUpdated: new Date().toISOString(),
          totalComplaints: 0,
          mockData: false
        };
      }

      console.log(`✅ Found ${complaints.length} complaints for heat map`);
      const formatted = this.formatHeatMapData(complaints);

      // Apply optional priorityLevel filter after normalizing scores
      if (filters.priorityLevel) {
        const targetPriority = String(filters.priorityLevel).toUpperCase();
        const filteredPoints = formatted.points.filter(p => p.priorityLevel === targetPriority);
        return {
          points: filteredPoints,
          statistics: this.calculateHeatMapStatistics(filteredPoints),
          lastUpdated: formatted.lastUpdated,
          totalComplaints: filteredPoints.length
        };
      }

      return formatted;

    } catch (error) {
      console.error('❌ Heat map service error:', error.message);
      // Return empty data structure instead of mock data
      return {
        points: [],
        statistics: {
          total: 0,
          resolved: 0,
          active: 0,
          pending: 0,
          resolutionRate: 0,
          averageResolutionDays: 0,
          byType: {},
          byPriority: {},
          oldestPending: null
        },
        lastUpdated: new Date().toISOString(),
        totalComplaints: 0,
        mockData: false
      };
    }
  }

  /**
   * Get heat map data with filters applied (used by GET /api/heat-map/filtered)
   */
  async getFilteredHeatMapData(filters = {}) {
    return this.getComplaintHeatMapData(filters);
  }

  /**
   * Format complaint data for heat map visualization
   */
  formatHeatMapData(complaints) {
    console.log(`🔄 Formatting ${complaints.length} complaints for heat map`);
    
    const heatMapPoints = complaints
      .filter(complaint => 
        // Filter out complaints without valid coordinates (preserve 0 as a valid coordinate)
        complaint && 
        complaint.location_latitude != null && 
        complaint.location_longitude != null && 
        complaint.location_latitude !== '' &&
        complaint.location_longitude !== '' &&
        Number.isFinite(parseFloat(complaint.location_latitude)) && 
        Number.isFinite(parseFloat(complaint.location_longitude))
      )
      .map(complaint => {
        // Only apply cached status if its updatedAt is strictly newer than the fetched row's updated_at
        let status = complaint.status;
        if (this.statusChangeCache && this.statusChangeCache.has(complaint.id)) {
          const cachedStatus = this.statusChangeCache.get(complaint.id);
          const cachedTime = cachedStatus.updatedAt ? new Date(cachedStatus.updatedAt).getTime() : 0;
          const rowTime = complaint.updated_at ? new Date(complaint.updated_at).getTime() : 0;
          if (cachedTime > rowTime) {
            status = cachedStatus.status;
          }
        }
        
        const isResolved = status === 'completed' || status === 'resolved';
        const isActive = status === 'pending' || status === 'in_progress' || status === 'under_review';
        
        // Parse coordinates to ensure they're valid numbers
        const lat = parseFloat(complaint.location_latitude);
        const lng = parseFloat(complaint.location_longitude);
        
        // Compute complaint weight based on resolved status, normalized priority, and age
        const complaintWithStatus = { ...complaint, status };
        const weight = this.getComplaintWeight(complaintWithStatus);
        
        // Return both lat/lng and latitude/longitude for maximum compatibility
        const firstImageUrl = Array.isArray(complaint.image_urls)
          ? (complaint.image_urls[0] || null)
          : (typeof complaint.image_urls === 'string' && complaint.image_urls.trim() ? complaint.image_urls.trim() : null);

        return {
          id: complaint.id,
          title: complaint.title || null,
          imageUrl: complaint.image_url || firstImageUrl,
          lat: lat,
          lng: lng,
          latitude: lat, // Add latitude for react-native-maps Heatmap component
          longitude: lng, // Add longitude for react-native-maps Heatmap component
          weight: weight,
          status: status,
          color: this.getStatusColor(status),
          markerType: isResolved ? 'resolved' : isActive ? 'active' : 'pending',
          complaintType: complaint.category,
          priorityLevel: this.getPriorityLevel(complaint.priority_score),
          priorityScore: complaint.priority_score ?? 0,
          createdAt: complaint.created_at,
          resolvedAt: isResolved ? (complaint.resolved_at || null) : null,
          location: complaint.location_address || 'Location not specified',
          daysSinceCreated: this.getDaysSince(complaint.created_at),
          tooltip: this.generateTooltip(complaintWithStatus)
        };
      });

    // Group data for statistics
    const statistics = this.calculateHeatMapStatistics(heatMapPoints);

    return {
      points: heatMapPoints,
      statistics,
      lastUpdated: new Date().toISOString(),
      totalComplaints: heatMapPoints.length
    };
  }

  /**
   * Normalize priority score from 0-1, 0-10, or 0-100 scales into 0-100
   */
  normalizePriorityScore(priorityScore) {
    if (priorityScore === null || priorityScore === undefined || priorityScore === '') return null;
    const num = Number(priorityScore);
    if (!Number.isFinite(num)) return null;
    if (num >= 0 && num <= 1) return num * 100;
    if (num > 1 && num <= 10) return num * 10;
    return Math.min(100, Math.max(0, num));
  }

  /**
   * Get weight for heat map intensity based on priority and age
   */
  getComplaintWeight(complaint) {
    let weight = 1;
    const score = this.normalizePriorityScore(complaint.priority_score) ?? 0;
    
    // Priority-based weight
    if (score >= 80) weight = 5;
    else if (score >= 60) weight = 4;
    else if (score >= 40) weight = 3;
    else if (score >= 20) weight = 2;
    else weight = 1;

    // Age-based multiplier (older unresolved complaints get higher weight)
    const daysSince = this.getDaysSince(complaint.created_at);
    if (complaint.status !== 'completed' && complaint.status !== 'resolved') {
      if (daysSince > 30) weight *= 3;
      else if (daysSince > 14) weight *= 2;
      else if (daysSince > 7) weight *= 1.5;
    }

    return weight;
  }

  /**
   * Get color based on complaint status
   */
  getStatusColor(status) {
    const colorMap = {
      'pending': '#FF4444',        // Red - New complaints
      'in_progress': '#FF8800',    // Orange - Being worked on
      'under_review': '#FFAA00',   // Yellow - Under review
      'completed': '#00AA44',      // Green - Completed
      'resolved': '#00CC44',       // Light Green - Resolved
      'cancelled': '#888888',      // Gray - Cancelled
      'rejected': '#CC0000'        // Dark Red - Rejected
    };
    return colorMap[status] || '#666666';
  }

  /**
   * Calculate statistics for the heat map
   */
  calculateHeatMapStatistics(points) {
    const total = points.length;
    const resolved = points.filter(p => p.markerType === 'resolved').length;
    const active = points.filter(p => p.markerType === 'active').length;
    const pending = points.filter(p => p.markerType === 'pending').length;
    
    // Resolution rate (percentage of complaints resolved)
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    
    // Group by complaint type
    const byType = {};
    points.forEach(point => {
      const type = point.complaintType || 'unknown';
      if (!byType[type]) byType[type] = 0;
      byType[type]++;
    });
    
    // Group by priority level
    const byPriority = {};
    points.forEach(point => {
      const priority = point.priorityLevel || 'unknown';
      if (!byPriority[priority]) byPriority[priority] = 0;
      byPriority[priority]++;
    });
    
    // Calculate average resolution time (for resolved complaints)
    const averageResolutionDays = this.calculateAverageResolutionTime(points);
    
    // Oldest unresolved complaint
    const oldestPending = this.getOldestPending(points);
    
    return {
      total,
      resolved,
      active,
      pending,
      resolutionRate,
      averageResolutionDays,
      byType,
      byPriority,
      oldestPending
    };
  }

  /**
   * Get priority level from score
   */
  getPriorityLevel(priorityScore) {
    const score = this.normalizePriorityScore(priorityScore);
    if (score === null) return 'UNKNOWN';
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Generate tooltip for complaint marker
   */
  generateTooltip(complaint) {
    const priorityLevel = this.getPriorityLevel(complaint.priority_score);
    const daysSince = this.getDaysSince(complaint.created_at);
    
    return `${complaint.title || 'Untitled Complaint'}
Status: ${complaint.status || 'Unknown'}
Priority: ${priorityLevel} (${complaint.priority_score ?? 0})
Days Since: ${daysSince}
Location: ${complaint.location_address || 'Unknown'}`;
  }

  /**
   * Calculate days since a date
   */
  getDaysSince(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 0;
    const diffTime = Math.max(0, Date.now() - date.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate average resolution time in days
   */
  calculateAverageResolutionTime(points) {
    const resolvedPoints = points.filter(p => 
      p.markerType === 'resolved' && p.createdAt && p.resolvedAt
    );
    
    if (resolvedPoints.length === 0) return 0;
    
    let validCount = 0;
    const totalDays = resolvedPoints.reduce((sum, point) => {
      const createdMs = new Date(point.createdAt).getTime();
      const resolvedMs = new Date(point.resolvedAt).getTime();
      if (Number.isNaN(createdMs) || Number.isNaN(resolvedMs)) return sum;
      validCount++;
      const diffTime = Math.max(0, resolvedMs - createdMs);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return sum + diffDays;
    }, 0);
    
    return validCount > 0 ? Math.round(totalDays / validCount) : 0;
  }

  /**
   * Get the oldest pending complaint
   */
  getOldestPending(points) {
    const pendingPoints = points.filter(p => 
      p.markerType !== 'resolved' && p.createdAt
    );
    
    if (pendingPoints.length === 0) return null;
    
    return pendingPoints.reduce((oldest, point) => {
      if (!oldest) return point;
      const oldestDate = new Date(oldest.createdAt);
      const currentDate = new Date(point.createdAt);
      return currentDate < oldestDate ? point : oldest;
    }, null);
  }

  /**
   * Check for recent status changes in complaints
   */
  async checkForStatusChanges() {
    try {
      // Only check if we have the last update timestamp
      if (!this.lastStatusCheck) {
        this.lastStatusCheck = new Date();
        this.statusChangeCache = new Map();
        return;
      }

      const now = new Date();
      // Check every 30 seconds at most
      if ((now - this.lastStatusCheck) < 30000) {
        return;
      }

      console.log('🔄 Checking for complaint status updates since', this.lastStatusCheck.toISOString());

      const { data, error } = await supabase
        .from('complaints')
        .select('id, status, updated_at')
        .gt('updated_at', this.lastStatusCheck.toISOString());

      if (error) {
        console.error('❌ Error checking for status changes:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} complaints with status changes`);
        
        // Update cache with new statuses
        data.forEach(complaint => {
          this.statusChangeCache.set(complaint.id, {
            status: complaint.status,
            updatedAt: complaint.updated_at
          });
        });
      }

      this.lastStatusCheck = now;
    } catch (error) {
      console.error('❌ Error checking for status changes:', error.message);
    }
  }
}

module.exports = HeatMapService;
