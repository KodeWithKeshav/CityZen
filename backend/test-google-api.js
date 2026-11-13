const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const axios = require('axios');

async function testGooglePlacesAPI() {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

    console.log('Testing Google Places API...');
    console.log(`API Key present: ${apiKey ? 'YES' : 'NO'}`);

    if (!apiKey) {
        console.error('No GOOGLE_PLACES_API_KEY found!');
        process.exitCode = 1;
        return;
    }

    console.log(`API Key length: ${apiKey.length} chars`);

    // Test with Mumbai coordinates
    const testLocation = {
        latitude: 19.0760,
        longitude: 72.8777,
        name: 'Mumbai, India'
    };

    console.log(`\nTesting location: ${testLocation.name} (${testLocation.latitude}, ${testLocation.longitude})`);

    try {
        console.log('\nTesting Places API (New) [places:searchNearby]...');
        const newApiRes = await axios.post(
            'https://places.googleapis.com/v1/places:searchNearby',
            {
                includedTypes: ['hospital'],
                maxResultCount: 5,
                locationRestriction: {
                    circle: {
                        center: { latitude: testLocation.latitude, longitude: testLocation.longitude },
                        radius: 1000.0
                    }
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating'
                },
                timeout: 10000
            }
        );
        console.log(`Places API (New) Status: ${newApiRes.status}`);
        const places = newApiRes.data?.places || [];
        console.log(`Places Found: ${places.length}`);
        if (places.length > 0) {
            console.log('\nTop hospitals found:');
            places.slice(0, 3).forEach((p, i) => {
                console.log(`${i + 1}. ${p.displayName?.text} (${p.formattedAddress})`);
            });
        }
        return;
    } catch (newErr) {
        console.warn('Places API (New) failed:', newErr.response?.data?.error?.message || newErr.message);
        console.log('Falling back to testing legacy nearbysearch...');
    }

    try {
        const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
        const params = {
            location: `${testLocation.latitude},${testLocation.longitude}`,
            radius: 1000,
            type: 'hospital',
            key: apiKey
        };

        console.log('\nMaking API request to legacy nearbysearch...');
        const response = await axios.get(url, { params, timeout: 10000 });
        const apiStatus = response.data?.status;
        const results = Array.isArray(response.data?.results) ? response.data.results : [];

        console.log(`\nStatus Code: ${response.status}`);
        console.log(`API Status: ${apiStatus}`);
        console.log(`Results Found: ${results.length}`);

        if (apiStatus === 'REQUEST_DENIED') {
            console.error('\nAPI REQUEST DENIED!');
            console.error(`Error: ${response.data?.error_message || 'No error message'}`);
            console.error('\nPossible causes:');
            console.error('1. API key restrictions (check allowed IPs/referrers)');
            console.error('2. Places API not enabled in Google Cloud Console');
            console.error('3. Billing not set up');
            process.exitCode = 1;
        } else if (apiStatus === 'OVER_QUERY_LIMIT') {
            console.error('\nOVER QUERY LIMIT!');
            console.error('Your API quota has been exceeded');
            process.exitCode = 1;
        } else if (apiStatus === 'OK' || apiStatus === 'ZERO_RESULTS') {
            console.log('\nAPI is working correctly!');
            if (results.length > 0) {
                console.log('\nTop 3 hospitals found:');
                results.slice(0, 3).forEach((place, i) => {
                    console.log(`${i + 1}. ${place.name} (${place.vicinity})`);
                });
            }
        } else {
            console.warn(`\nUnexpected status: ${apiStatus}`);
            process.exitCode = 1;
        }
    } catch (error) {
        console.error('\nRequest failed:', error.message);
        if (error.response) {
            console.error(`Response status: ${error.response.status}`);
            console.error('Response data:', error.response.data);
        }
        process.exitCode = 1;
    }
}

testGooglePlacesAPI().catch((err) => {
    console.error('Unexpected error testing Google Places API:', err);
    process.exitCode = 1;
});
