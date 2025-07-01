# Deploying Licensed Audio Assets to Vercel

Since the `public/sounds/Earwax` folder contains licensed content that can't be included in your GitHub repository, you have several options for making these files available on Vercel:

## Option 1: External CDN/Cloud Storage (Recommended)

This is the most scalable and secure approach:

### Step 1: Upload Assets to Cloud Storage

Upload your `public/sounds/Earwax` folder to one of these services:

- **AWS S3** (with CloudFront CDN)
- **Google Cloud Storage** (with Cloud CDN)
- **Azure Blob Storage** (with Azure CDN)
- **Any other CDN service**

### Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env.production`
2. Set `NEXT_PUBLIC_SOUND_BASE_URL` to your CDN URL:
   ```bash
   NEXT_PUBLIC_SOUND_BASE_URL=https://your-cdn-domain.com/sounds
   ```

### Step 3: Set Vercel Environment Variables

In your Vercel dashboard:

1. Go to your project → Settings → Environment Variables
2. Add `NEXT_PUBLIC_SOUND_BASE_URL` with your CDN URL
3. Set it for "Production" environment

## Option 2: Private GitHub Repository

Create a separate private repository for your assets:

### Step 1: Create Private Asset Repository

1. Create a new private GitHub repository (e.g., `fartnoises-assets`)
2. Upload your `Earwax` folder to this repository
3. Create a GitHub release with the assets as a zip file

### Step 2: Configure Asset Download

1. Generate a GitHub Personal Access Token with repo access
2. Set environment variables in Vercel:
   - `ASSETS_DOWNLOAD_URL`: URL to your GitHub release zip
   - `ASSETS_ACCESS_TOKEN`: Your GitHub token

### Step 3: The build script will automatically download assets during deployment

## Option 3: Vercel's Built-in CDN + Build-time Download

Vercel automatically serves files from your `public` folder via their global CDN. You can download assets during the build process:

### Step 1: Use the Build Script

The included `scripts/download-assets.js` downloads assets during deployment:

```bash
# Set these environment variables in Vercel:
ASSETS_DOWNLOAD_URL=https://github.com/your-username/fartnoises-assets/releases/download/v1.0.0/earwax-sounds.zip
ASSETS_ACCESS_TOKEN=your_github_token
```

### Step 2: Automatic CDN Distribution

Once downloaded to `public/sounds/Earwax/`, Vercel's CDN automatically serves them globally with optimal caching.

## Option 4: Vercel Blob Storage (Advanced)

For dynamic asset management, use Vercel's blob storage:

### Step 1: Upload to Vercel Blob

```bash
npm install @vercel/blob
# Upload your files using Vercel CLI or their API
```

### Step 2: Configure blob URLs in your environment variables

## Current Implementation

The code has been updated to support configurable sound sources:

- `SOUND_BASE_URL` environment variable controls where sounds are loaded from
- Falls back to `/sounds` for local development
- Both `soundLoader.ts` and `audioSystem.ts` use the configurable URL

## Local Development

For local development with the actual sound files:

1. Copy `.env.local.example` to `.env.local`
2. Ensure your `public/sounds/Earwax` folder exists locally
3. The app will load sounds from the local path

## Testing

To test without the licensed sounds:

1. Set `NEXT_PUBLIC_SOUND_BASE_URL` to a non-existent URL
2. The game should gracefully handle missing audio files
3. You can replace with placeholder sounds for testing

## Security Considerations

- Never commit actual sound files to your public repository
- Use environment variables for sensitive URLs/tokens
- Consider using signed URLs for additional security
- Monitor your CDN usage to prevent unexpected costs

## Recommended Setup for Production

1. **Vercel CDN + Build-time Download**: Easiest setup, uses Vercel's excellent global CDN
2. **AWS S3 + CloudFront**: Most control and potentially lower costs for high traffic
3. **Set CORS headers** on your CDN to allow your domain (if using external CDN)
4. **Use environment variables** for easy switching between environments
5. **Monitor access logs** to ensure only your app is accessing the files

## CDN Comparison

| Option                  | Pros                                                 | Cons                              |
| ----------------------- | ---------------------------------------------------- | --------------------------------- |
| **Vercel CDN**          | Free, automatic, excellent performance, zero config  | Assets downloaded on every build  |
| **AWS S3 + CloudFront** | Full control, persistent storage, detailed analytics | Setup complexity, potential costs |
| **Vercel Blob Storage** | Integrated with Vercel, persistent, API-driven       | More complex implementation       |
