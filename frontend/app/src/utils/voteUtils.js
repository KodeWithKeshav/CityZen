import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeApiCall } from '../../config/supabase';

/**
 * Get guest vote status from local storage
 */
const getGuestVoteStatus = async (complaintId) => {
  try {
    const guestVotes = await AsyncStorage.getItem('guestVotes');
    if (guestVotes) {
      const votesMap = JSON.parse(guestVotes);
      return votesMap[complaintId] || false;
    }
    return false;
  } catch (error) {
    console.error('❌ Error getting guest vote status:', error);
    return false;
  }
};

// Utility function to refetch vote count for a specific complaint
export const refetchComplaintVotes = async (complaintId, apiClient) => {
  try {
    console.log(`🔄 Refetching votes for complaint: ${complaintId}`);

    // Was using a raw fetch() with `apiClient.token`, a property that
    // doesn't exist anywhere in config/supabase.js - every refetch was
    // sent as "Bearer " (empty), so the backend never recognized the
    // request as authenticated and userVoted always came back false for
    // logged-in users right after they'd just voted. makeApiCall() reads
    // the real stored authToken (the same one the vote POST itself uses).
    const data = await makeApiCall(`${apiClient.baseUrl}/api/complaints/${complaintId}`);

    if (data.success && data.complaint) {
      console.log(`✅ Refetched vote count: ${data.complaint.vote_count}`);
      
      // For authenticated users, use server response
      // For guest users, check local storage for vote status
      let userVoted = data.complaint.userVoted || false;
      
      // If not authenticated (userVoted is false), check guest vote status
      if (!userVoted) {
        const guestVoted = await getGuestVoteStatus(complaintId);
        userVoted = guestVoted;
        console.log(`🔍 Guest vote status for complaint ${complaintId}: ${guestVoted}`);
      }
      
      return {
        success: true,
        voteCount: data.complaint.vote_count || 0,
        userVoted: userVoted
      };
    } else {
      throw new Error('Invalid response format');
    }
    
  } catch (error) {
    console.error('❌ Error refetching complaint votes:', error);
    return {
      success: false,
      error: error.message
    };
  }
};