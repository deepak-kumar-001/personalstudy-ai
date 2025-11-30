// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://aakrfjwsmxefzkyovaqc.supabase.co'; // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFha3JmandzbXhlZnpreW92YXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE4MTksImV4cCI6MjA3OTMwNzgxOX0.5vYKyCV6jCStC-Pb1i5MvIt1Xhztwptl8D6vqjDzaSQ'; // Your anon/public key

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);