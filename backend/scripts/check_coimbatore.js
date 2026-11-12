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

const CHUNK_SIZE = 200;

async function checkDatabase() {
    console.log("Checking Supabase tables...");

    const { data: complaints, error } = await supabase
        .from('complaints')
        .select('id')
        .gte('location_latitude', 10.9)
        .lte('location_latitude', 11.2)
        .gte('location_longitude', 76.8)
        .lte('location_longitude', 77.2);

    if (error) {
        console.error("Error fetching complaints:", error.message || error);
        process.exitCode = 1;
        return;
    }

    const rows = complaints || [];
    console.log(`Found ${rows.length} complaints in Coimbatore area.`);
    if (rows.length > 0) {
        console.log("Sample complaint IDs:", rows.slice(0, 3).map(c => c.id));
    } else {
        return;
    }

    const knownRelatedTables = [
        'complaint_stages',
        'complaint_votes',
        'complaint_feedback',
        'complaint_timeline',
        'complaint_updates',
        'complaint_workflow',
    ];
    const complaintIds = rows.map(c => c.id);

    for (const table of knownRelatedTables) {
        try {
            let totalCount = 0;
            let tableFailed = false;
            for (let i = 0; i < complaintIds.length; i += CHUNK_SIZE) {
                const batch = complaintIds.slice(i, i + CHUNK_SIZE);
                const { count, error: tableError } = await supabase
                    .from(table)
                    .select('id', { count: 'exact', head: true })
                    .in('complaint_id', batch);

                if (tableError) {
                    console.log(`Error querying ${table}:`, tableError.message);
                    tableFailed = true;
                    break;
                }
                totalCount += count || 0;
            }
            if (!tableFailed) {
                console.log(`Found ${totalCount} records in ${table} referencing these complaints.`);
            }
        } catch (err) {
            console.log(`Error checking table ${table}:`, err.message);
        }
    }
}

checkDatabase().catch((err) => {
    console.error("Unexpected error checking database:", err);
    process.exitCode = 1;
});
