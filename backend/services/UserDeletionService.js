/**
 * UserDeletionService
 *
 * Cascade-deletes a citizen account and everything that references it
 * (complaint votes, complaint_updates, complaint_workflow rows, the
 * citizen's own complaints, then the user row itself). Extracted from
 * routes/adminMinimal.js's citizen-delete handler so the same logic backs
 * both the admin "Delete Citizen" action and the citizen's own
 * self-service "Delete Account" action (routes/auth.js) instead of two
 * copies drifting apart.
 */
async function deleteCitizenCascade(supabase, citizenId) {
  // 1. Delete dependent records for this citizen's complaints
  const { data: userComplaints, error: fetchComplaintsError } = await supabase
    .from('complaints')
    .select('id')
    .eq('user_id', citizenId);

  if (fetchComplaintsError) {
    return { success: false, status: 500, message: 'Failed to look up citizen complaints' };
  }

  if (userComplaints && userComplaints.length > 0) {
    const complaintIds = userComplaints.map(c => c.id);

    const { error: votesError } = await supabase
      .from('complaint_votes')
      .delete()
      .in('complaint_id', complaintIds);
    if (votesError) {
      console.warn('Error deleting complaint_votes:', votesError.message);
    }

    const { error: updatesError } = await supabase
      .from('complaint_updates')
      .delete()
      .in('complaint_id', complaintIds);
    if (updatesError) {
      console.error('Error deleting complaint_updates:', updatesError);
    }

    const { error: workflowError } = await supabase
      .from('complaint_workflow')
      .delete()
      .in('complaint_id', complaintIds);
    if (workflowError) {
      console.error('Error deleting complaint_workflow:', workflowError);
    }
  }

  // Delete any votes cast by this user on other complaints
  const { error: userVotesError } = await supabase
    .from('complaint_votes')
    .delete()
    .eq('user_id', citizenId);
  if (userVotesError) {
    console.warn('Error deleting user complaint_votes:', userVotesError.message);
  }

  // 2. Delete all complaints by this citizen
  const { error: complaintsError } = await supabase
    .from('complaints')
    .delete()
    .eq('user_id', citizenId);

  if (complaintsError) {
    console.error('Error deleting complaints:', complaintsError);
    return { success: false, status: 500, message: 'Failed to delete citizen complaints' };
  }

  // 3. Delete the citizen/user
  const { error: userError } = await supabase
    .from('users')
    .delete()
    .eq('id', citizenId)
    .eq('user_type', 'citizen');

  if (userError) {
    console.error('Error deleting user:', userError);
    return { success: false, status: 500, message: 'Failed to delete citizen' };
  }

  return { success: true };
}

module.exports = { deleteCitizenCascade };
