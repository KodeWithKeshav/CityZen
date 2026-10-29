/**
 * Runs before every test file. Defense-in-depth alongside the per-file
 * `jest.mock('dotenv', ...)` stubs in __tests__/integration and
 * __tests__/system: strips any live third-party credentials a developer's
 * real backend/.env may have set on this process already, so a test file
 * that forgets to stub dotenv still can't silently start making real
 * network calls (Roboflow/Groq/Hugging Face/Google Places/Sarvam/Supabase).
 */
const SENSITIVE_ENV_VARS = [
  'ROBOFLOW_API_KEY', 'ROBOFLOW_WORKSPACE', 'ROBOFLOW_WORKFLOW', 'ROBOFLOW_GEOMETRY_WORKFLOW',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'HUGGING_FACE_API_KEY', 'HUGGINGFACE_API_TOKEN', 'HF_AUTHENTICITY_MODEL',
  'SARVAM_API_KEY', 'WIT_AI_TOKEN',
  'GOOGLE_PLACES_API_KEY', 'GOOGLE_GEOCODING_API_KEY', 'GOOGLE_DISTANCE_MATRIX_API_KEY', 'GOOGLE_MOBILE_API_KEY',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'X_CONSUMER_KEY', 'X_CONSUMER_SECRET', 'X_BEARER_TOKEN', 'TWITTER_BEARER_TOKEN',
];

SENSITIVE_ENV_VARS.forEach((key) => { delete process.env[key]; });
