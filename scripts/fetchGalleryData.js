// scripts/fetchGalleryData.js
import { google } from 'googleapis';
import { writeFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url'; // For ES Modules __dirname equivalent

// Load environment variables from .env file
dotenv.config();

// Polyfill for __dirname in ES Modules (Node.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
const FOLDER_ID = process.env.GOOGLE_DRIVE_GALLERY_FOLDER_ID;

if (!API_KEY || !FOLDER_ID) {
    console.error("Error: GOOGLE_DRIVE_API_KEY or GOOGLE_DRIVE_GALLERY_FOLDER_ID environment variables are not set. Please check your .env file.");
    process.exit(1);
}

const drive = google.drive({
    version: 'v3',
    auth: API_KEY,
});

async function fetchGalleryImages() {
    try {
        console.log('Fetching image data from Google Drive...');
        const response = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and mimeType contains 'image/'`,
            fields: 'files(id, name, thumbnailLink, webContentLink, imageMediaMetadata, description)', // Added 'description'
            pageSize: 100, // Adjust as needed, max 1000
            orderBy: 'name asc', // Order by filename
        });

        const files = response.data.files;
        if (!files || files.length === 0) {
            console.log('No images found in the specified Google Drive folder. Please check the Folder ID and permissions.');
            return [];
        }

        const galleryImages = files.map(file => {
            // Construct a direct download link (requires "Anyone with the link" permission)
            // This pattern is generally reliable for direct image embedding.
            // The '=s1200' parameter scales the image to a width of 1200px. Adjust as needed.
            const directDownloadLink = file.id ? `https://lh3.googleusercontent.com/d/${file.id}=s${file.imageMediaMetadata?.width || 1200}` : '';


            // --- Logic for Title and Category ---
            // This is where you'll define how to extract the title and category.
            // I'm providing a more robust example than before.
            let title = file.name; // Default to filename
            let category = "General"; // Default category

            // Option 1: Derive from filename (e.g., "Architecture - Modern Home.jpg")
            const fileNameParts = file.name.split('.').slice(0, -1).join('.').split(' - ');
            if (fileNameParts.length > 1) {
                category = fileNameParts[0].trim();
                title = fileNameParts.slice(1).join(' - ').trim();
            } else {
                // Fallback: Clean up filename for title
                title = file.name.replace(/\.(jpeg|jpg|png|gif|webp)$/i, '')
                                 .replace(/[-_]/g, ' ')
                                 .split(' ')
                                 .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                 .join(' ');
            }

            // Option 2: Use Google Drive's description field (you'd manually add this in Drive)
            // If you add a description to your image in Google Drive like "Category: Architecture, Title: XYZ"
            // This parsing would need to be more sophisticated.
            if (file.description) {
                // Example: Parse "Title: My Project, Category: Residential" from description
                const descParts = file.description.split(',').map(s => s.trim());
                for (const part of descParts) {
                    if (part.startsWith('Title:')) {
                        title = part.substring(6).trim();
                    } else if (part.startsWith('Category:')) {
                        category = part.substring(9).trim();
                    }
                }
            }


            return {
                id: file.id,
                name: file.name,
                title: title,
                category: category,
                thumbnail: file.thumbnailLink,
                fullSize: directDownloadLink,
            };
        });

        const outputPath = path.join(__dirname, '../src/data/galleryImages.json'); // Save in src/data
        writeFileSync(outputPath, JSON.stringify(galleryImages, null, 2));
        console.log(`Successfully fetched ${galleryImages.length} images and saved to ${outputPath}`);

        return galleryImages;

    } catch (error) {
        console.error('Error fetching gallery images from Google Drive:', error.message);
        if (error.code === 403) {
            console.error("Action required: Check your Google Cloud API Key restrictions (ensure Google Drive API is enabled and application restrictions are set correctly) and your Google Drive folder's sharing permissions (must be 'Anyone with the link' and 'Viewer').");
        }
        if (error.errors) {
            error.errors.forEach(err => console.error(`  Reason: ${err.reason}, Message: ${err.message}`));
        }
        process.exit(1); // Exit with an error code to signal build failure
    }
}

fetchGalleryImages();