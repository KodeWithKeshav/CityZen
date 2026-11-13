const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error(
        'Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).'
    );
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CHUNK_SIZE = 100;
const confirmed = process.argv.includes('--confirm') || process.argv.includes('--yes');

async function deleteComplaints() {
    console.log("Locating complaints in Coimbatore...");

    // First, select them to see exactly how many we are deleting
    const { data: complaints, error: selectError } = await supabase
        .from('complaints')
        .select('id')
        .gte('location_latitude', 10.9)
        .lte('location_latitude', 11.2)
        .gte('location_longitude', 76.8)
        .lte('location_longitude', 77.2);

    if (selectError) {
        console.error("Error fetching complaints:", selectError.message || selectError);
        process.exitCode = 1;
        return;
    }

    if (!complaints || complaints.length === 0) {
        console.log("No complaints found in Coimbatore region. Nothing to delete.");
        return;
    }

    const complaintIds = complaints.map(c => c.id);
    if (!confirmed) {
        console.log(`Dry-run: found ${complaintIds.length} complaints in Coimbatore region.`);
        console.log("Re-run with --confirm to delete these complaints.");
        return;
    }

    console.log(`Ready to delete ${complaintIds.length} complaints.`);

    let totalDeleted = 0;
    for (let i = 0; i < complaintIds.length; i += CHUNK_SIZE) {
        const batch = complaintIds.slice(i, i + CHUNK_SIZE);
        const { data: deleted, error: deleteError } = await supabase
            .from('complaints')
            .delete()
            .in('id', batch)
            .select('id');

        if (deleteError) {
            console.error("Error during deletion:", deleteError.message);
            process.exitCode = 1;
            return;
        }
        totalDeleted += Array.isArray(deleted) ? deleted.length : 0;
    }

    console.log(`Successfully deleted ${totalDeleted} of ${complaintIds.length} complaints.`);

    // Verify deletion
    const { count, error: countError } = await supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .gte('location_latitude', 10.9)
        .lte('location_latitude', 11.2)
        .gte('location_longitude', 76.8)
        .lte('location_longitude', 77.2);

    if (countError) {
        console.error("Error verifying deletion:", countError.message || countError);
        process.exitCode = 1;
    } else {
        console.log(`Verification: ${count} complaints remaining in Coimbatore area.`);
    }
}

deleteComplaints().catch((err) => {
    console.error("Unexpected error deleting complaints:", err);
    process.exitCode = 1;
});
