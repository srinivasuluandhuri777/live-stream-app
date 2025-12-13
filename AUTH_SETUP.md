# Authentication Setup

## Email/Password Authentication

This app uses Supabase Email/Password authentication (no magic links).

### Setup Steps

1. **Enable Email Provider in Supabase:**
   - Go to your Supabase project dashboard
   - Navigate to **Authentication** → **Providers**
   - Find **Email** provider
   - Toggle **Enable Email provider** ON
   - (Optional) Configure email templates if needed
   - Click **Save**

2. **User Registration:**
   - Users can sign up directly from the login page
   - No email confirmation required by default (can be enabled in Supabase settings)
   - Minimum password length: 6 characters

3. **Testing:**
   - Go to `/login` page
   - Click "Don't have an account? Sign up"
   - Enter email and password
   - Click "Sign Up"
   - You'll be automatically signed in and redirected to dashboard

### Security Notes

- Passwords are hashed and stored securely by Supabase
- You can enable email confirmation in Supabase settings if needed
- Rate limiting is handled by Supabase automatically
- Consider enabling 2FA for production use

