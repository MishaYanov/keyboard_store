import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

async function convertJpgToWebp() {
    const dir = path.resolve(scriptDir, '../public/assets');

    try {
        const files = await fs.promises.readdir(dir);
        const jpgFiles = files.filter(file => /\.(jpg|jpeg)$/i.test(file));

        if (jpgFiles.length === 0) {
            console.log('No JPG images found.');
            return;
        }

        // Dynamic import of native global image components if running in a supported runtime environment
        // Note: Node 22+ supports the standard web global 'createImageBitmap' and 'Canvas' APIs natively
        for (const file of jpgFiles) {
            const inputPath = path.join(dir, file);
            const outputPath = path.join(dir, `${path.parse(file).name}.webp`);

            const fileBuffer = await fs.promises.readFile(inputPath);
            const blob = new Blob([fileBuffer], { type: 'image/jpeg' });

            // Using standard web APIs natively available in modern JS runtimes
            const imageBitmap = await createImageBitmap(blob);

            // Construct a native canvas structure to export WebP
            const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageBitmap, 0, 0);

            const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
            const arrayBuffer = await webpBlob.arrayBuffer();

            await fs.promises.writeFile(outputPath, Buffer.from(arrayBuffer));
            console.log(`Successfully converted: ${file} -> ${path.parse(file).name}.webp`);
        }

        console.log('Batch processing complete!');
    } catch (err) {
        console.error('Error processing files:', err.message);
    }
}

convertJpgToWebp();
